-- Art Moment public access hardening
-- Apply from Supabase SQL Editor after deploying the Edge Functions in ../functions.

begin;

create extension if not exists pgcrypto;

create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique,
  email text unique,
  created_at timestamptz not null default now(),
  constraint admin_users_identity_check check (user_id is not null or email is not null)
);

alter table public.admin_users enable row level security;
grant all on public.admin_users to authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth.role(), '') = 'authenticated'
    and (
      not exists (select 1 from public.admin_users)
      or exists (
        select 1
        from public.admin_users admin
        where admin.user_id = auth.uid()
          or lower(admin.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
    );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

drop policy if exists admin_users_admin_all on public.admin_users;
create policy admin_users_admin_all
on public.admin_users
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

grant usage on schema public to anon, authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- Public catalog: visible to visitors, writable only by admins.
alter table public.products enable row level security;

revoke all on public.products from anon, authenticated;
grant select on public.products to anon, authenticated;
grant all on public.products to authenticated;

drop policy if exists products_public_read on public.products;
create policy products_public_read
on public.products
for select
to anon, authenticated
using (true);

drop policy if exists products_admin_all on public.products;
create policy products_admin_all
on public.products
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Admin-only tables. Public flows must use Edge Functions.
do $$
declare
  table_name text;
  admin_tables text[] := array[
    'coupons',
    'customers',
    'expenses',
    'inventory',
    'order_payments',
    'order_status_history',
    'orders',
    'settings',
    'store_order_items',
    'store_orders',
    'wallet_transactions',
    'wallets'
  ];
begin
  foreach table_name in array admin_tables loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on public.%I from anon, authenticated', table_name);
    execute format('grant all on public.%I to authenticated', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_admin_all', table_name);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())',
      table_name || '_admin_all',
      table_name
    );
  end loop;
end $$;

-- unified_revenue may be a view in Supabase. Lock anonymous access either way.
do $$
declare
  revenue_kind "char";
begin
  select c.relkind into revenue_kind
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'unified_revenue';

  if revenue_kind in ('r', 'p') then
    execute 'alter table public.unified_revenue enable row level security';
    execute 'revoke all on public.unified_revenue from anon, authenticated';
    execute 'grant select on public.unified_revenue to authenticated';
    execute 'drop policy if exists unified_revenue_admin_select on public.unified_revenue';
    execute 'create policy unified_revenue_admin_select on public.unified_revenue for select to authenticated using (public.is_admin())';
  elsif revenue_kind in ('v', 'm') then
    execute 'revoke all on public.unified_revenue from anon, authenticated';
    execute 'grant select on public.unified_revenue to authenticated';
  end if;
end $$;

commit;

-- After applying and confirming the current admin can still access /app:
-- insert into public.admin_users (email) values ('admin@example.com')
-- on conflict (email) do nothing;
