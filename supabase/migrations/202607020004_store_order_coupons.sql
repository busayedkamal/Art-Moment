-- Store checkout coupon tracking.
-- The actual validation happens inside Edge Functions; these fields preserve the receipt.

alter table public.store_orders
  add column if not exists subtotal_amount numeric(10, 2),
  add column if not exists discount_amount numeric(10, 2) not null default 0,
  add column if not exists coupon_code text;

update public.store_orders
set
  subtotal_amount = coalesce(subtotal_amount, total_amount),
  discount_amount = coalesce(discount_amount, 0)
where subtotal_amount is null
   or discount_amount is null;

create index if not exists store_orders_coupon_code_idx
on public.store_orders (coupon_code)
where coupon_code is not null;
