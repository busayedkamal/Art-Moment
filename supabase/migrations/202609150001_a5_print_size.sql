-- A5 support for administrative print orders and the Print Builder catalogue.
begin;

alter table public.settings
  add column if not exists a5_price numeric(10, 2) not null default 0
    check (a5_price >= 0);

alter table public.orders
  add column if not exists a5_qty integer not null default 0 check (a5_qty >= 0),
  add column if not exists a5_unit_price numeric(10, 4)
    check (a5_unit_price is null or a5_unit_price >= 0);

insert into public.inventory (item_name, quantity, threshold)
select 'ورق A5', 0, 10
where not exists (select 1 from public.inventory where item_name = 'ورق A5');

alter table public.print_variants
  drop constraint if exists print_variants_pricing_mode_check;
alter table public.print_variants
  add constraint print_variants_pricing_mode_check
  check (pricing_mode in ('existing_4x6', 'existing_a4', 'existing_a5', 'fixed'));

-- Only unpriced placeholder rows inherit the new setting. Preserve custom prices.
update public.print_variants
set pricing_mode = 'existing_a5', unit_price = null, is_available = true, updated_at = now()
where print_size = 'A5' and material = 'photo_paper'
  and pricing_mode = 'fixed' and unit_price is null and is_active;

insert into public.print_variants
  (print_size, material, surface, border_style, pricing_mode, unit_price, is_active, is_available, sort_order)
values
  ('A5', 'photo_paper', 'glossy', 'borderless', 'existing_a5', null, true, true, 20),
  ('A5', 'photo_paper', 'glossy', 'white_border', 'existing_a5', null, true, true, 21),
  ('A5', 'photo_paper', 'matte', 'borderless', 'existing_a5', null, true, true, 22),
  ('A5', 'photo_paper', 'matte', 'white_border', 'existing_a5', null, true, true, 23)
on conflict (print_size, material, surface, border_style) do nothing;

-- A5 stock changes commit with the order, including edits and cancellations.
-- Existing A4/4x6 inventory is still managed by its current application flow.
create or replace function public.sync_print_order_a5_inventory()
returns trigger
language plpgsql
security definer
set search_path = public
as $a5_inventory$
declare
  previous_quantity integer := 0;
  next_quantity integer := 0;
  quantity_delta integer;
  stock public.inventory%rowtype;
begin
  if tg_op <> 'INSERT' then
    if coalesce(old.status::text, '') not in ('cancelled', 'returned') then
      previous_quantity := old.a5_qty;
    end if;
  end if;
  if tg_op <> 'DELETE' then
    if coalesce(new.status::text, '') not in ('cancelled', 'returned') then
      next_quantity := new.a5_qty;
    end if;
    if new.a5_qty > 0 and coalesce(new.a5_unit_price, 0) <= 0 then
      raise exception 'حدد سعر طباعة A5 في الإعدادات أولاً';
    end if;
  end if;

  quantity_delta := next_quantity - previous_quantity;
  if quantity_delta <> 0 then
    select * into stock from public.inventory
    where item_name = 'ورق A5' order by id limit 1 for update;
    if not found then
      raise exception 'أضف مخزون ورق A5 في الإعدادات أولاً';
    end if;
    if quantity_delta > coalesce(stock.quantity, 0) then
      raise exception 'مخزون ورق A5 غير كافٍ';
    end if;
    update public.inventory
    set quantity = coalesce(quantity, 0) - quantity_delta
    where id = stock.id;
  end if;
  return null;
end;
$a5_inventory$;

revoke all on function public.sync_print_order_a5_inventory() from public;
drop trigger if exists orders_a5_inventory on public.orders;
create trigger orders_a5_inventory
after insert or update of a5_qty, a5_unit_price, status or delete on public.orders
for each row execute function public.sync_print_order_a5_inventory();

notify pgrst, 'reload schema';
commit;
