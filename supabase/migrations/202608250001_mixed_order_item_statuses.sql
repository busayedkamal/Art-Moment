-- Independent, auditable statuses for mixed store-order items.

do $add_attention_status$
begin
  alter type public.order_status_enum add value if not exists 'attention_required';
exception
  when duplicate_object then null;
end;
$add_attention_status$;

begin;

alter table public.store_order_items
  add column if not exists item_image text,
  add column if not exists status text,
  add column if not exists status_updated_at timestamptz,
  add column if not exists status_reason_code text,
  add column if not exists status_note text;

update public.store_order_items item
set
  item_name = coalesce(item.item_name, products.name),
  item_image = coalesce(item.item_image, products.image)
from public.products products
where item.product_id = products.id
  and (item.item_name is null or item.item_image is null);

update public.store_order_items item
set
  status = case
    when orders.status::text = 'cancelled' then 'cancelled'
    when orders.status::text in ('shipped', 'delivered', 'returned') then case when item.item_type = 'print' then 'ready' else 'fulfilled' end
    when orders.status::text = 'ready_for_delivery' then 'ready'
    when orders.status::text = 'processing' then case when item.item_type = 'print' then 'printing' else 'preparing' end
    when orders.status::text = 'confirmed' then case when item.item_type = 'print' then 'files_received' else 'reserved' end
    else case when item.item_type = 'print' then 'files_received' else 'pending' end
  end,
  status_updated_at = coalesce(item.status_updated_at, orders.created_at, now())
from public.store_orders orders
where item.store_order_id = orders.id
  and item.status is null;

alter table public.store_order_items
  alter column status set default 'pending',
  alter column status set not null,
  alter column status_updated_at set default now(),
  alter column status_updated_at set not null;

alter table public.store_order_items drop constraint if exists store_order_items_status_check;
alter table public.store_order_items add constraint store_order_items_status_check check (
  (coalesce(item_type, 'product') = 'product' and status in ('pending', 'reserved', 'preparing', 'ready', 'fulfilled', 'attention_required', 'cancelled'))
  or
  (item_type = 'print' and status in ('files_received', 'queued', 'printing', 'printed', 'ready', 'attention_required', 'cancelled'))
);

create table if not exists public.store_order_item_status_history (
  id uuid primary key default gen_random_uuid(),
  store_order_id uuid not null references public.store_orders(id) on delete cascade,
  store_order_item_id uuid not null references public.store_order_items(id) on delete cascade,
  old_status text,
  new_status text not null,
  reason_code text,
  note text,
  changed_by uuid,
  changed_by_email text,
  created_at timestamptz not null default now()
);

create index if not exists store_order_item_status_history_order_idx on public.store_order_item_status_history(store_order_id, created_at desc);
create index if not exists store_order_item_status_history_item_idx on public.store_order_item_status_history(store_order_item_id, created_at desc);

alter table public.store_order_item_status_history enable row level security;
revoke all on public.store_order_item_status_history from anon, authenticated;
grant all on public.store_order_item_status_history to authenticated, service_role;

drop policy if exists store_order_item_status_history_admin_all on public.store_order_item_status_history;
create policy store_order_item_status_history_admin_all
on public.store_order_item_status_history for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create or replace function public.prepare_store_order_item_status()
returns trigger language plpgsql set search_path = public
as $prepare_store_order_item_status$
begin
  if coalesce(new.item_type, 'product') = 'product' and new.product_id is not null
     and (new.item_name is null or new.item_image is null) then
    select coalesce(new.item_name, product.name), coalesce(new.item_image, product.image)
    into new.item_name, new.item_image
    from public.products product
    where product.id = new.product_id;
  end if;

  if new.item_type = 'print' and (new.status is null or new.status = 'pending') then
    new.status := 'files_received';
  elsif new.status is null then
    new.status := 'pending';
  end if;
  new.status_updated_at := coalesce(new.status_updated_at, now());
  return new;
end;
$prepare_store_order_item_status$;

drop trigger if exists prepare_store_order_item_status_trigger on public.store_order_items;
create trigger prepare_store_order_item_status_trigger before insert on public.store_order_items
for each row execute function public.prepare_store_order_item_status();

create or replace function public.log_store_order_item_status_change()
returns trigger language plpgsql security definer set search_path = public
as $log_store_order_item_status_change$
begin
  if old.status is not distinct from new.status then return new; end if;
  insert into public.store_order_item_status_history (
    store_order_id, store_order_item_id, old_status, new_status, reason_code, note, changed_by, changed_by_email
  ) values (
    new.store_order_id, new.id, old.status, new.status, new.status_reason_code, new.status_note,
    auth.uid(), nullif(auth.jwt() ->> 'email', '')
  );
  return new;
end;
$log_store_order_item_status_change$;

drop trigger if exists log_store_order_item_status_change_trigger on public.store_order_items;
create trigger log_store_order_item_status_change_trigger after update of status on public.store_order_items
for each row execute function public.log_store_order_item_status_change();

insert into public.store_order_item_status_history (
  store_order_id, store_order_item_id, old_status, new_status, reason_code, note, changed_by_email, created_at
)
select item.store_order_id, item.id, null, item.status, 'migration_initial_state',
  'Initial item status recorded during mixed-order migration.', 'system', coalesce(item.status_updated_at, now())
from public.store_order_items item
where not exists (
  select 1 from public.store_order_item_status_history history where history.store_order_item_id = item.id
);

create or replace function public.set_store_order_item_status(
  p_order_item_id uuid,
  p_status text,
  p_reason_code text default null,
  p_note text default null
)
returns jsonb language plpgsql security definer set search_path = public
as $set_store_order_item_status$
declare
  current_order public.store_orders%rowtype;
  current_item public.store_order_items%rowtype;
  next_order_status text;
  active_count integer;
  ready_count integer;
  attention_count integer;
  work_count integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_admin() then raise exception 'not_authorized'; end if;

  select item.* into current_item from public.store_order_items item where item.id = p_order_item_id;
  if not found then raise exception 'order_item_not_found'; end if;

  select orders.* into current_order from public.store_orders orders
  where orders.id = current_item.store_order_id for update;
  select item.* into current_item from public.store_order_items item where item.id = p_order_item_id for update;

  if current_order.status::text in ('shipped', 'delivered', 'cancelled', 'returned') then raise exception 'order_item_status_locked'; end if;

  if coalesce(current_item.item_type, 'product') = 'print' then
    if p_status not in ('files_received', 'queued', 'printing', 'printed', 'ready', 'attention_required', 'cancelled') then
      raise exception 'invalid_print_item_status';
    end if;
  elsif p_status not in ('pending', 'reserved', 'preparing', 'ready', 'fulfilled', 'attention_required', 'cancelled') then
    raise exception 'invalid_product_item_status';
  end if;

  if current_item.status = p_status then
    return jsonb_build_object('changed', false, 'item_status', current_item.status, 'order_status', current_order.status::text);
  end if;

  if coalesce(current_item.item_type, 'product') = 'print' then
    if not (
      (current_item.status = 'files_received' and p_status in ('queued', 'printing', 'attention_required', 'cancelled')) or
      (current_item.status = 'queued' and p_status in ('printing', 'attention_required', 'cancelled')) or
      (current_item.status = 'printing' and p_status in ('printed', 'ready', 'attention_required', 'cancelled')) or
      (current_item.status = 'printed' and p_status in ('ready', 'attention_required', 'cancelled')) or
      (current_item.status = 'ready' and p_status in ('attention_required', 'cancelled')) or
      (current_item.status = 'attention_required' and p_status in ('files_received', 'queued', 'printing', 'printed', 'ready', 'cancelled')) or
      (current_item.status = 'cancelled' and p_status = 'files_received')
    ) then raise exception 'invalid_item_status_transition'; end if;
  elsif not (
    (current_item.status = 'pending' and p_status in ('reserved', 'preparing', 'attention_required', 'cancelled')) or
    (current_item.status = 'reserved' and p_status in ('preparing', 'ready', 'attention_required', 'cancelled')) or
    (current_item.status = 'preparing' and p_status in ('ready', 'attention_required', 'cancelled')) or
    (current_item.status = 'ready' and p_status in ('fulfilled', 'attention_required', 'cancelled')) or
    (current_item.status = 'attention_required' and p_status in ('pending', 'reserved', 'preparing', 'ready', 'cancelled')) or
    (current_item.status = 'cancelled' and p_status = 'pending')
  ) then raise exception 'invalid_item_status_transition'; end if;

  update public.store_order_items set
    status = p_status,
    status_reason_code = nullif(trim(coalesce(p_reason_code, '')), ''),
    status_note = nullif(trim(coalesce(p_note, '')), ''),
    status_updated_at = now()
  where id = p_order_item_id;

  select
    count(*) filter (where status <> 'cancelled'),
    count(*) filter (where status <> 'cancelled' and ((coalesce(item_type, 'product') = 'product' and status in ('ready', 'fulfilled')) or (item_type = 'print' and status in ('printed', 'ready')))),
    count(*) filter (where status = 'attention_required'),
    count(*) filter (where status in ('preparing', 'queued', 'printing', 'printed'))
  into active_count, ready_count, attention_count, work_count
  from public.store_order_items where store_order_id = current_order.id;

  next_order_status := current_order.status::text;
  if attention_count > 0 then next_order_status := 'attention_required';
  elsif active_count > 0 and ready_count = active_count then next_order_status := 'ready_for_delivery';
  elsif work_count > 0 then next_order_status := 'processing';
  elsif current_order.status::text = 'attention_required' then next_order_status := 'confirmed';
  end if;

  if next_order_status <> current_order.status::text then
    update public.store_orders set status = next_order_status::public.order_status_enum where id = current_order.id;
  end if;

  return jsonb_build_object('changed', true, 'item_status', p_status, 'order_status', next_order_status);
end;
$set_store_order_item_status$;

revoke all on function public.set_store_order_item_status(uuid, text, text, text) from public;
grant execute on function public.set_store_order_item_status(uuid, text, text, text) to authenticated, service_role;

create or replace function public.set_store_order_status_with_stock(
  p_order_id uuid,
  p_status text,
  p_tracking_number text default null,
  p_courier_name text default null
)
returns public.store_orders
language plpgsql
security definer
set search_path = public
as $set_store_order_status_with_stock$
declare
  current_order public.store_orders%rowtype;
  updated_order public.store_orders%rowtype;
  stock_items jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_admin() then raise exception 'not_authorized'; end if;

  select * into current_order from public.store_orders where id = p_order_id for update;
  if not found then raise exception 'order_not_found'; end if;

  if not (
    (current_order.status::text = 'pending_verification' and p_status in ('confirmed', 'cancelled')) or
    (current_order.status::text = 'confirmed' and p_status in ('processing', 'attention_required', 'cancelled')) or
    (current_order.status::text = 'processing' and p_status in ('ready_for_delivery', 'attention_required', 'cancelled')) or
    (current_order.status::text = 'attention_required' and p_status in ('confirmed', 'processing', 'ready_for_delivery', 'cancelled')) or
    (current_order.status::text = 'ready_for_delivery' and p_status in ('shipped', 'delivered', 'attention_required', 'cancelled')) or
    (current_order.status::text = 'shipped' and p_status in ('delivered', 'returned')) or
    (current_order.status::text = 'delivered' and p_status = 'returned') or
    (current_order.status::text = 'cancelled' and p_status = 'confirmed')
  ) then raise exception 'invalid_status_transition'; end if;

  select coalesce(jsonb_agg(jsonb_build_object('product_id', product_id, 'quantity', quantity)) filter (where product_id is not null), '[]'::jsonb)
  into stock_items from public.store_order_items where store_order_id = p_order_id;

  if current_order.status::text = 'cancelled' and p_status <> 'cancelled' then
    perform public.reserve_store_stock(stock_items);
    update public.store_order_items set
      status = case when item_type = 'print' then 'files_received' else 'pending' end,
      status_reason_code = 'order_reopened', status_note = null, status_updated_at = now()
    where store_order_id = p_order_id and status = 'cancelled';
  end if;

  if current_order.status::text <> 'cancelled' and p_status = 'cancelled' then
    update public.store_order_items set
      status = 'cancelled', status_reason_code = 'order_cancelled', status_note = null, status_updated_at = now()
    where store_order_id = p_order_id and status <> 'cancelled';
  end if;

  update public.store_orders set
    status = p_status::public.order_status_enum,
    tracking_number = case when p_status = 'shipped' and nullif(trim(coalesce(p_tracking_number, '')), '') is not null then trim(p_tracking_number) else tracking_number end,
    courier_name = case when p_status = 'shipped' and nullif(trim(coalesce(p_courier_name, '')), '') is not null then trim(p_courier_name) else courier_name end
  where id = p_order_id returning * into updated_order;

  if current_order.status::text <> 'cancelled' and p_status = 'cancelled' then perform public.restore_store_stock(stock_items); end if;
  return updated_order;
end;
$set_store_order_status_with_stock$;

revoke all on function public.set_store_order_status_with_stock(uuid, text, text, text) from public;
grant execute on function public.set_store_order_status_with_stock(uuid, text, text, text) to authenticated, service_role;

commit;