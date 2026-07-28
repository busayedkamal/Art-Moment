-- Fix store order status updates when store_orders.status uses order_status_enum.

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
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_admin() then
    raise exception 'not_authorized';
  end if;

  select *
    into current_order
  from public.store_orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'order_not_found';
  end if;

  if not (
    (current_order.status = 'pending_verification' and p_status in ('confirmed', 'cancelled')) or
    (current_order.status = 'confirmed' and p_status in ('processing', 'cancelled')) or
    (current_order.status = 'processing' and p_status in ('ready_for_delivery', 'cancelled')) or
    (current_order.status = 'ready_for_delivery' and p_status in ('shipped', 'delivered', 'cancelled')) or
    (current_order.status = 'shipped' and p_status in ('delivered', 'returned')) or
    (current_order.status = 'delivered' and p_status = 'returned') or
    (current_order.status = 'cancelled' and p_status = 'confirmed')
  ) then
    raise exception 'invalid_status_transition';
  end if;

  select coalesce(
    jsonb_agg(jsonb_build_object('product_id', product_id, 'quantity', quantity)),
    '[]'::jsonb
  )
    into stock_items
  from public.store_order_items
  where store_order_id = p_order_id;

  if current_order.status = 'cancelled' and p_status <> 'cancelled' then
    perform public.reserve_store_stock(stock_items);
  end if;

  update public.store_orders
  set
    status = p_status::public.order_status_enum,
    tracking_number = case
      when p_status = 'shipped' and nullif(trim(coalesce(p_tracking_number, '')), '') is not null
        then trim(p_tracking_number)
      else tracking_number
    end,
    courier_name = case
      when p_status = 'shipped' and nullif(trim(coalesce(p_courier_name, '')), '') is not null
        then trim(p_courier_name)
      else courier_name
    end
  where id = p_order_id
  returning * into updated_order;

  if current_order.status <> 'cancelled' and p_status = 'cancelled' then
    perform public.restore_store_stock(stock_items);
  end if;

  return updated_order;
end;
$set_store_order_status_with_stock$;

revoke all on function public.set_store_order_status_with_stock(uuid, text, text, text) from public;
grant execute on function public.set_store_order_status_with_stock(uuid, text, text, text)
  to authenticated, service_role;
