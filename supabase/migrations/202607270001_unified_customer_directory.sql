-- Unify printing, wallet, and store customers around public.customers.
-- Existing operational records remain in their original tables and gain a
-- customer_id link. No balances, orders, or historical rows are deleted.

begin;

alter table public.customers
  add column if not exists account_origin text not null default 'self_signup',
  add column if not exists account_claimed_at timestamptz,
  add column if not exists marketing_consented_at timestamptz,
  add column if not exists marketing_consent_source text;

alter table public.customers
  alter column email drop not null,
  alter column password_hash drop not null;

alter table public.orders
  add column if not exists customer_id uuid references public.customers(id) on delete set null;

alter table public.wallets
  add column if not exists customer_id uuid references public.customers(id) on delete set null;

create index if not exists orders_customer_id_idx
on public.orders (customer_id);

create index if not exists wallets_customer_id_idx
on public.wallets (customer_id);

create or replace function public.normalize_customer_phone(value text)
returns text
language sql
immutable
set search_path = public
as $normalize_phone$
  select case
    when digits ~ '^009665[0-9]{8}$' then '0' || right(digits, 9)
    when digits ~ '^9665[0-9]{8}$' then '0' || right(digits, 9)
    when digits ~ '^05[0-9]{8}$' then digits
    when digits ~ '^5[0-9]{8}$' then '0' || digits
    else digits
  end
  from (
    select regexp_replace(coalesce(value, ''), '\D', '', 'g') as digits
  ) normalized;
$normalize_phone$;

-- Backfill the latest known printing name for every valid phone that does not
-- already have a canonical customer account.
with latest_print_customer as (
  select distinct on (public.normalize_customer_phone(print_order.phone))
    public.normalize_customer_phone(print_order.phone) as phone,
    nullif(trim(print_order.customer_name), '') as name
  from public.orders print_order
  where public.normalize_customer_phone(print_order.phone) ~ '^05[0-9]{8}$'
  order by
    public.normalize_customer_phone(print_order.phone),
    print_order.created_at desc nulls last,
    print_order.id desc
)
insert into public.customers (
  name,
  phone,
  email,
  password_hash,
  marketing_opt_in,
  preferred_contact_method,
  saved_addresses,
  account_origin,
  admin_status,
  admin_tags
)
select
  coalesce(latest.name, 'عميل طباعة'),
  latest.phone,
  null,
  null,
  false,
  'whatsapp',
  '[]'::jsonb,
  'legacy_printing',
  'active',
  array['عميل طباعة']::text[]
from latest_print_customer latest
where not exists (
  select 1
  from public.customers customer
  where public.normalize_customer_phone(customer.phone) = latest.phone
);

-- Add valid wallet-only customers that have no printing or store profile.
with wallet_customer as (
  select distinct on (public.normalize_customer_phone(wallet.phone))
    public.normalize_customer_phone(wallet.phone) as phone,
    case
      when coalesce(wallet.notes, '') ~* 'اسم العميل\s*:'
        then nullif(trim(regexp_replace(wallet.notes, '^.*اسم العميل\s*:\s*', '', 'i')), '')
      else null
    end as name,
    nullif(trim(coalesce(wallet.address, '')), '') as address
  from public.wallets wallet
  where public.normalize_customer_phone(wallet.phone) ~ '^05[0-9]{8}$'
  order by
    public.normalize_customer_phone(wallet.phone),
    wallet.created_at desc nulls last,
    wallet.id desc
)
insert into public.customers (
  name,
  phone,
  email,
  password_hash,
  marketing_opt_in,
  preferred_contact_method,
  saved_addresses,
  account_origin,
  admin_status,
  admin_tags
)
select
  coalesce(wallet_customer.name, 'عميل محفظة'),
  wallet_customer.phone,
  null,
  null,
  false,
  'whatsapp',
  case
    when wallet_customer.address is null then '[]'::jsonb
    else jsonb_build_array(jsonb_build_object(
      'id', gen_random_uuid(),
      'label', 'عنوان قديم',
      'city', '',
      'district', '',
      'street', wallet_customer.address,
      'notes', ''
    ))
  end,
  'legacy_wallet',
  'active',
  array['عميل محفظة']::text[]
from wallet_customer
where not exists (
  select 1
  from public.customers customer
  where public.normalize_customer_phone(customer.phone) = wallet_customer.phone
);

-- Link all existing printing orders and wallets to the canonical customer.
update public.orders print_order
set customer_id = (
  select customer.id
  from public.customers customer
  where public.normalize_customer_phone(customer.phone)
    = public.normalize_customer_phone(print_order.phone)
  order by customer.created_at asc nulls last, customer.id
  limit 1
)
where print_order.customer_id is null
  and public.normalize_customer_phone(print_order.phone) ~ '^05[0-9]{8}$';

update public.wallets wallet
set customer_id = (
  select customer.id
  from public.customers customer
  where public.normalize_customer_phone(customer.phone)
    = public.normalize_customer_phone(wallet.phone)
  order by customer.created_at asc nulls last, customer.id
  limit 1
)
where wallet.customer_id is null
  and public.normalize_customer_phone(wallet.phone) ~ '^05[0-9]{8}$';

create or replace function public.sync_print_order_customer()
returns trigger
language plpgsql
security definer
set search_path = public
as $sync_print_customer$
declare
  normalized_phone text;
  resolved_customer_id uuid;
  resolved_name text;
begin
  normalized_phone := public.normalize_customer_phone(new.phone);
  if normalized_phone !~ '^05[0-9]{8}$' then
    new.customer_id := null;
    return new;
  end if;

  select customer.id
    into resolved_customer_id
  from public.customers customer
  where public.normalize_customer_phone(customer.phone) = normalized_phone
  order by customer.created_at asc nulls last, customer.id
  limit 1;

  resolved_name := coalesce(nullif(trim(new.customer_name), ''), 'عميل طباعة');

  if resolved_customer_id is null then
    insert into public.customers (
      name, phone, email, password_hash, marketing_opt_in,
      preferred_contact_method, saved_addresses, account_origin,
      admin_status, admin_tags
    ) values (
      resolved_name, normalized_phone, null, null, false,
      'whatsapp', '[]'::jsonb, 'legacy_printing',
      'active', array['عميل طباعة']::text[]
    )
    returning id into resolved_customer_id;
  else
    update public.customers
    set name = case
      when nullif(trim(coalesce(name, '')), '') is null
        or name in ('غير معروف', 'عميل طباعة', 'عميل محفظة')
      then resolved_name
      else name
    end
    where id = resolved_customer_id;
  end if;

  new.customer_id := resolved_customer_id;
  return new;
end;
$sync_print_customer$;

drop trigger if exists orders_sync_customer on public.orders;
create trigger orders_sync_customer
before insert or update of customer_name, phone
on public.orders
for each row
execute function public.sync_print_order_customer();

create or replace function public.sync_wallet_customer()
returns trigger
language plpgsql
security definer
set search_path = public
as $sync_wallet_customer$
declare
  normalized_phone text;
  resolved_customer_id uuid;
  wallet_customer_name text;
begin
  normalized_phone := public.normalize_customer_phone(new.phone);
  if normalized_phone !~ '^05[0-9]{8}$' then
    new.customer_id := null;
    return new;
  end if;

  select customer.id
    into resolved_customer_id
  from public.customers customer
  where public.normalize_customer_phone(customer.phone) = normalized_phone
  order by customer.created_at asc nulls last, customer.id
  limit 1;

  wallet_customer_name := case
    when coalesce(new.notes, '') ~* 'اسم العميل\s*:'
      then nullif(trim(regexp_replace(new.notes, '^.*اسم العميل\s*:\s*', '', 'i')), '')
    else null
  end;

  if resolved_customer_id is null then
    insert into public.customers (
      name, phone, email, password_hash, marketing_opt_in,
      preferred_contact_method, saved_addresses, account_origin,
      admin_status, admin_tags
    ) values (
      coalesce(wallet_customer_name, 'عميل محفظة'),
      normalized_phone,
      null,
      null,
      false,
      'whatsapp',
      case
        when nullif(trim(coalesce(new.address, '')), '') is null then '[]'::jsonb
        else jsonb_build_array(jsonb_build_object(
          'id', gen_random_uuid(),
          'label', 'عنوان المحفظة',
          'city', '',
          'district', '',
          'street', new.address,
          'notes', ''
        ))
      end,
      'legacy_wallet',
      'active',
      array['عميل محفظة']::text[]
    )
    returning id into resolved_customer_id;
  elsif wallet_customer_name is not null then
    update public.customers
    set name = case
      when nullif(trim(coalesce(name, '')), '') is null
        or name in ('غير معروف', 'عميل طباعة', 'عميل محفظة')
      then wallet_customer_name
      else name
    end
    where id = resolved_customer_id;
  end if;

  new.customer_id := resolved_customer_id;
  return new;
end;
$sync_wallet_customer$;

drop trigger if exists wallets_sync_customer on public.wallets;
create trigger wallets_sync_customer
before insert or update of phone, notes, address
on public.wallets
for each row
execute function public.sync_wallet_customer();

commit;
