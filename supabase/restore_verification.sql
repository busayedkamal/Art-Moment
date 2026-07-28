-- Run only after restoring to a disposable test project.
-- This script is read-only.

select 'customers' as object_name, count(*) as row_count from public.customers
union all
select 'products', count(*) from public.products
union all
select 'store_orders', count(*) from public.store_orders
union all
select 'store_order_items', count(*) from public.store_order_items
union all
select 'wallets', count(*) from public.wallets
union all
select 'wallet_transactions', count(*) from public.wallet_transactions
union all
select 'abandoned_carts', count(*) from public.abandoned_carts
union all
select 'store_funnel_events', count(*) from public.store_funnel_events
order by object_name;

select
  count(*) as order_items_without_order,
  (select count(*) from public.store_order_items) as total_order_items
from public.store_order_items items
left join public.store_orders orders on orders.id = items.store_order_id
where orders.id is null;

select
  count(*) filter (where stock_quantity < 0) as products_with_negative_stock,
  count(*) filter (where price < 0) as products_with_negative_price
from public.products;

select
  count(*) filter (
    where reward_points_balance < 0
       or store_credit_balance < 0
  ) as wallets_with_negative_balance,
  count(*) as total_wallets
from public.wallets;

select
  public.is_admin() as current_session_is_admin;
