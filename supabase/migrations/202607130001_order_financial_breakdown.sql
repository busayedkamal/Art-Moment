-- Preserve a clear financial breakdown for print orders.
-- Existing legacy columns remain in place for backwards compatibility.

begin;

alter table public.orders
  add column if not exists financial_schema_version smallint,
  add column if not exists direct_discount_amount numeric(10, 2) not null default 0,
  add column if not exists coupon_discount_amount numeric(10, 2) not null default 0,
  add column if not exists coupon_code text,
  add column if not exists package_discount_amount numeric(10, 2) not null default 0,
  add column if not exists points_used_amount numeric(10, 2) not null default 0,
  add column if not exists photo_4x6_unit_price numeric(10, 4),
  add column if not exists a4_unit_price numeric(10, 4);

-- Recover coupon codes that were historically stored only in notes.
update public.orders
set coupon_code = nullif(trim(coalesce(
  substring(coalesce(notes, '') from 'تم استخدام كوبون:[[:space:]]*([^|]+)'),
  substring(coalesce(notes, '') from 'كوبون:[[:space:]]*([^|]+)')
)), '')
where coupon_code is null
  and coalesce(notes, '') like '%كوبون:%';

-- Recover points/package usage from the immutable wallet transaction history.
with wallet_usage as (
  select
    order_id,
    coalesce(sum(amount_value) filter (where type = 'redeem'), 0) as points_used,
    coalesce(sum(amount_value) filter (where type = 'package_redeem'), 0) as package_used
  from public.wallet_transactions
  where order_id is not null
    and type in ('redeem', 'package_redeem')
  group by order_id
)
update public.orders orders
set
  points_used_amount = greatest(0, coalesce(usage.points_used, 0)),
  package_discount_amount = least(
    greatest(0, coalesce(orders.subtotal, 0) + coalesce(orders.delivery_fee, 0) - coalesce(orders.total_amount, 0)),
    greatest(0, coalesce(usage.package_used, 0))
  )
from wallet_usage usage
where usage.order_id = orders.id;

-- Wallet usage without a matching transaction is treated as points, after
-- excluding any package redemption already identified above.
update public.orders
set points_used_amount = greatest(
  0,
  coalesce(wallet_used, 0) - coalesce(package_discount_amount, 0)
)
where points_used_amount = 0
  and coalesce(wallet_used, 0) > 0;

-- Calculate the historical coupon value when its definition is still present.
with coupon_values as (
  select
    orders.id,
    greatest(0, coalesce(orders.subtotal, 0) + coalesce(orders.delivery_fee, 0) - coalesce(orders.total_amount, 0)) as recorded_reduction,
    case
      when coupons.discount_type = 'percent' then
        round(coalesce(orders.subtotal, 0) * least(100, greatest(0, coalesce(coupons.discount_amount, 0))) / 100, 2)
      when coupons.id is not null then greatest(0, coalesce(coupons.discount_amount, 0))
      else null
    end as calculated_coupon,
    greatest(0, coalesce(orders.manual_discount, 0)) as legacy_discount,
    coalesce(orders.notes, '') like '%تم استخدام كوبون:%' as coupon_saved_as_legacy_discount
  from public.orders orders
  left join public.coupons coupons
    on lower(coupons.code) = lower(orders.coupon_code)
  where orders.coupon_code is not null
)
update public.orders orders
set coupon_discount_amount = least(
  values.recorded_reduction,
  greatest(0, coalesce(
    case when values.coupon_saved_as_legacy_discount then nullif(values.legacy_discount, 0) end,
    nullif(values.calculated_coupon, 0),
    nullif(values.legacy_discount, 0),
    values.recorded_reduction - coalesce(orders.package_discount_amount, 0)
      - case when coalesce(orders.notes, '') like '%خصم نقاط:%' then coalesce(orders.points_used_amount, 0) else 0 end,
    0
  ))
)
from coupon_values values
where values.id = orders.id;

-- Any remaining historical reduction is classified as a direct discount.
update public.orders
set direct_discount_amount = greatest(
  0,
  coalesce(subtotal, 0) + coalesce(delivery_fee, 0) - coalesce(total_amount, 0)
    - coalesce(coupon_discount_amount, 0)
    - coalesce(package_discount_amount, 0)
    - case when coalesce(notes, '') like '%خصم نقاط:%' then coalesce(points_used_amount, 0) else 0 end
)
where direct_discount_amount = 0;

-- Exact unit prices can be reconstructed safely when an old order contains
-- only one photo size. Mixed legacy orders remain null instead of guessing.
update public.orders
set photo_4x6_unit_price = round(
  greatest(0, coalesce(subtotal, 0) - coalesce(album_qty, 0) * coalesce(album_price, 0))
    / nullif(photo_4x6_qty, 0),
  4
)
where photo_4x6_unit_price is null
  and coalesce(photo_4x6_qty, 0) > 0
  and coalesce(a4_qty, 0) = 0;

update public.orders
set a4_unit_price = round(
  greatest(0, coalesce(subtotal, 0) - coalesce(album_qty, 0) * coalesce(album_price, 0))
    / nullif(a4_qty, 0),
  4
)
where a4_unit_price is null
  and coalesce(a4_qty, 0) > 0
  and coalesce(photo_4x6_qty, 0) = 0;

-- Rows that existed before this migration retain version 1. New writes use
-- version 2, whose total_amount excludes points payments but includes all
-- price discounts.
update public.orders
set financial_schema_version = 1
where financial_schema_version is null;

alter table public.orders
  alter column financial_schema_version set default 2,
  alter column financial_schema_version set not null;

alter table public.orders
  drop constraint if exists orders_direct_discount_amount_check,
  add constraint orders_direct_discount_amount_check check (direct_discount_amount >= 0),
  drop constraint if exists orders_coupon_discount_amount_check,
  add constraint orders_coupon_discount_amount_check check (coupon_discount_amount >= 0),
  drop constraint if exists orders_package_discount_amount_check,
  add constraint orders_package_discount_amount_check check (package_discount_amount >= 0),
  drop constraint if exists orders_points_used_amount_check,
  add constraint orders_points_used_amount_check check (points_used_amount >= 0),
  drop constraint if exists orders_photo_4x6_unit_price_check,
  add constraint orders_photo_4x6_unit_price_check check (photo_4x6_unit_price is null or photo_4x6_unit_price >= 0),
  drop constraint if exists orders_a4_unit_price_check,
  add constraint orders_a4_unit_price_check check (a4_unit_price is null or a4_unit_price >= 0),
  drop constraint if exists orders_financial_schema_version_check,
  add constraint orders_financial_schema_version_check check (financial_schema_version in (1, 2));

create index if not exists orders_coupon_code_idx
on public.orders (coupon_code)
where coupon_code is not null;

comment on column public.orders.direct_discount_amount is 'Direct/manual price discount applied by administration.';
comment on column public.orders.coupon_discount_amount is 'Discount amount attributed to coupon_code.';
comment on column public.orders.package_discount_amount is 'Price discount redeemed from a customer package.';
comment on column public.orders.points_used_amount is 'Points wallet amount used as a payment after price discounts.';
comment on column public.orders.photo_4x6_unit_price is '4x6 unit price snapshot at order calculation time.';
comment on column public.orders.a4_unit_price is 'A4 unit price snapshot at order calculation time.';

commit;
