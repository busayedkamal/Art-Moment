-- Keep the product catalog readable after RLS hardening.
-- Product writes remain admin-only through products_admin_all.

begin;

alter table public.products enable row level security;

grant select on public.products to anon, authenticated;

drop policy if exists products_public_read on public.products;
create policy products_public_read
on public.products
for select
to anon, authenticated
using (true);

commit;
