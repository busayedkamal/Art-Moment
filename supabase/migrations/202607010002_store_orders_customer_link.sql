-- Link independent store orders to customer accounts.
-- This keeps the store flow separate, while allowing "My Orders" to load by account id.

alter table public.store_orders
  add column if not exists customer_id uuid references public.customers(id) on delete set null;

create index if not exists store_orders_customer_id_idx
on public.store_orders (customer_id);

with customer_phones as (
  select
    id,
    created_at,
    case
      when digits ~ '^009665[0-9]{8}$' then '0' || right(digits, 9)
      when digits ~ '^9665[0-9]{8}$' then '0' || right(digits, 9)
      when digits ~ '^05[0-9]{8}$' then digits
      when digits ~ '^5[0-9]{8}$' then '0' || digits
      else digits
    end as normalized_phone
  from public.customers
  cross join lateral (
    select regexp_replace(coalesce(phone, ''), '\D', '', 'g') as digits
  ) phone_data
),
preferred_customers as (
  select distinct on (normalized_phone)
    id,
    normalized_phone
  from customer_phones
  where normalized_phone ~ '^05[0-9]{8}$'
  order by normalized_phone, created_at desc
),
order_phones as (
  select
    id,
    case
      when digits ~ '^009665[0-9]{8}$' then '0' || right(digits, 9)
      when digits ~ '^9665[0-9]{8}$' then '0' || right(digits, 9)
      when digits ~ '^05[0-9]{8}$' then digits
      when digits ~ '^5[0-9]{8}$' then '0' || digits
      else digits
    end as normalized_phone
  from public.store_orders
  cross join lateral (
    select regexp_replace(coalesce(phone, ''), '\D', '', 'g') as digits
  ) phone_data
)
update public.store_orders store_order
set customer_id = preferred_customers.id
from order_phones
join preferred_customers on preferred_customers.normalized_phone = order_phones.normalized_phone
where store_order.id = order_phones.id
  and store_order.customer_id is null
  and order_phones.normalized_phone ~ '^05[0-9]{8}$';
