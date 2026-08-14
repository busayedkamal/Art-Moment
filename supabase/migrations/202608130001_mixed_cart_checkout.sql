-- Mixed cart checkout hardening: scoped coupons and idempotent order creation.

begin;

alter table public.coupons
  add column if not exists scope text not null default 'all';

alter table public.coupons
  drop constraint if exists coupons_scope_check,
  add constraint coupons_scope_check check (scope in ('all', 'products', 'print'));

alter table public.store_orders
  add column if not exists checkout_idempotency_key text,
  add column if not exists building_number text,
  add column if not exists postal_code text;

create unique index if not exists store_orders_checkout_idempotency_key_uidx
  on public.store_orders (checkout_idempotency_key)
  where checkout_idempotency_key is not null;

comment on column public.coupons.scope is
  'Coupon target: all cart lines, store products only, or print jobs only.';
comment on column public.store_orders.checkout_idempotency_key is
  'Client-generated key that prevents duplicate checkout orders.';

commit;
