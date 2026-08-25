-- Harden mixed-order item cancellation, stock restoration, and readiness aggregation.

begin;

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

  if p_status = 'cancelled' then
    select count(*) into active_count
    from public.store_order_items
    where store_order_id = current_order.id and status <> 'cancelled';

    if active_count <= 1 then
      raise exception 'cancel_last_active_item_requires_order_cancellation';
    end if;
  end if;

  if coalesce(current_item.item_type, 'product') = 'product'
    and current_item.product_id is not null
    and coalesce(current_item.quantity, 0) > 0 then
    if current_item.status <> 'cancelled' and p_status = 'cancelled' then
      perform public.restore_store_stock(jsonb_build_array(jsonb_build_object(
        'product_id', current_item.product_id,
        'quantity', current_item.quantity
      )));
    elsif current_item.status = 'cancelled' and p_status <> 'cancelled' then
      perform public.reserve_store_stock(jsonb_build_array(jsonb_build_object(
        'product_id', current_item.product_id,
        'quantity', current_item.quantity
      )));
    end if;
  end if;

  update public.store_order_items set
    status = p_status,
    status_reason_code = nullif(trim(coalesce(p_reason_code, '')), ''),
    status_note = nullif(trim(coalesce(p_note, '')), ''),
    status_updated_at = now()
  where id = p_order_item_id;

  select
    count(*) filter (where status <> 'cancelled'),
    count(*) filter (where status <> 'cancelled' and ((coalesce(item_type, 'product') = 'product' and status in ('ready', 'fulfilled')) or (item_type = 'print' and status = 'ready'))),
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

  select coalesce(jsonb_agg(jsonb_build_object('product_id', product_id, 'quantity', quantity)), '[]'::jsonb)
  into stock_items
  from public.store_order_items
  where store_order_id = p_order_id
    and product_id is not null
    and (
      (current_order.status::text <> 'cancelled' and p_status = 'cancelled' and status <> 'cancelled')
      or
      (current_order.status::text = 'cancelled' and p_status <> 'cancelled' and status = 'cancelled' and status_reason_code = 'order_cancelled')
    );

  if current_order.status::text = 'cancelled' and p_status <> 'cancelled' then
    perform public.reserve_store_stock(stock_items);
    update public.store_order_items set
      status = case when item_type = 'print' then 'files_received' else 'pending' end,
      status_reason_code = 'order_reopened', status_note = null, status_updated_at = now()
    where store_order_id = p_order_id and status = 'cancelled' and status_reason_code = 'order_cancelled';
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
