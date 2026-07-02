-- Customer account profile fields for the standalone store.
-- Apply after 202607010001_customer_account_recovery.sql.

alter table public.customers
  add column if not exists preferred_contact_method text not null default 'whatsapp',
  add column if not exists saved_addresses jsonb not null default '[]'::jsonb,
  add column if not exists profile_updated_at timestamptz,
  add column if not exists data_deletion_requested_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'customers_preferred_contact_method_check'
  ) then
    alter table public.customers
      add constraint customers_preferred_contact_method_check
      check (preferred_contact_method in ('whatsapp', 'email', 'phone'));
  end if;
end $$;
