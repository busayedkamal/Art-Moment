-- Admin CRM fields for customer service, segmentation, and support follow-up.

alter table public.customers
  add column if not exists admin_notes text,
  add column if not exists admin_status text not null default 'active',
  add column if not exists admin_tags text[] not null default '{}'::text[];

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'customers_admin_status_check'
  ) then
    alter table public.customers
      add constraint customers_admin_status_check
      check (admin_status in ('active', 'vip', 'needs_followup', 'problem', 'blocked'));
  end if;
end $$;

create index if not exists customers_admin_status_idx
on public.customers (admin_status);

create index if not exists customers_marketing_opt_in_idx
on public.customers (marketing_opt_in)
where marketing_opt_in = true;
