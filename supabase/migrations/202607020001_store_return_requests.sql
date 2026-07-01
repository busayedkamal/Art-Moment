-- Store return/refund requests.
-- Customers create requests through Edge Functions; admins manage them from the dashboard.

create extension if not exists pgcrypto;

create table if not exists public.store_return_requests (
  id uuid primary key default gen_random_uuid(),
  store_order_id uuid not null references public.store_orders(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  customer_name text,
  phone text,
  reason text not null,
  details text,
  image_url text,
  status text not null default 'new_request',
  requested_refund_amount numeric(10, 2) not null default 0,
  approved_refund_amount numeric(10, 2) not null default 0,
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status_updated_at timestamptz
);

create table if not exists public.store_return_request_items (
  id uuid primary key default gen_random_uuid(),
  return_request_id uuid not null references public.store_return_requests(id) on delete cascade,
  store_order_item_id uuid references public.store_order_items(id) on delete set null,
  product_id integer references public.products(id) on delete set null,
  quantity integer not null check (quantity > 0),
  price_at_time numeric(10, 2) not null default 0,
  created_at timestamptz not null default now()
);

do $$
begin
  alter table public.store_return_requests
    add constraint store_return_requests_status_check
    check (
      status in (
        'new_request',
        'under_review',
        'approved',
        'rejected',
        'awaiting_item',
        'item_received',
        'refunded'
      )
    );
exception
  when duplicate_object then null;
end $$;

create index if not exists store_return_requests_order_idx
on public.store_return_requests (store_order_id);

create index if not exists store_return_requests_customer_idx
on public.store_return_requests (customer_id);

create index if not exists store_return_requests_status_idx
on public.store_return_requests (status);

create index if not exists store_return_request_items_request_idx
on public.store_return_request_items (return_request_id);

create or replace function public.touch_store_return_request_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  if new.status is distinct from old.status then
    new.status_updated_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists touch_store_return_request_updated_at on public.store_return_requests;
create trigger touch_store_return_request_updated_at
before update on public.store_return_requests
for each row
execute function public.touch_store_return_request_updated_at();

alter table public.store_return_requests enable row level security;
alter table public.store_return_request_items enable row level security;

revoke all on public.store_return_requests from anon, authenticated;
revoke all on public.store_return_request_items from anon, authenticated;
grant all on public.store_return_requests to authenticated;
grant all on public.store_return_request_items to authenticated;

drop policy if exists store_return_requests_admin_all on public.store_return_requests;
create policy store_return_requests_admin_all
on public.store_return_requests
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists store_return_request_items_admin_all on public.store_return_request_items;
create policy store_return_request_items_admin_all
on public.store_return_request_items
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());
