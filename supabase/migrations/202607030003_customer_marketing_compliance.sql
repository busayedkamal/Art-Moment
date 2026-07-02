-- Marketing consent protection and customer communication logs.
-- Campaigns are sent only through Edge Functions, and each recipient gets an unsubscribe link.

alter table public.customers
  add column if not exists marketing_unsubscribed_at timestamptz;

create table if not exists public.customer_message_logs (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,
  channel text not null default 'email',
  type text not null,
  subject text,
  body text,
  status text not null default 'sent',
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'customer_message_logs_channel_check'
  ) then
    alter table public.customer_message_logs
      add constraint customer_message_logs_channel_check
      check (channel in ('email', 'whatsapp', 'sms', 'phone', 'system'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'customer_message_logs_status_check'
  ) then
    alter table public.customer_message_logs
      add constraint customer_message_logs_status_check
      check (status in ('queued', 'sent', 'failed', 'skipped', 'completed'));
  end if;
end $$;

create index if not exists customer_message_logs_customer_idx
on public.customer_message_logs (customer_id, created_at desc);

create index if not exists customer_message_logs_type_idx
on public.customer_message_logs (type, created_at desc);

create index if not exists customers_marketing_unsubscribed_idx
on public.customers (marketing_unsubscribed_at)
where marketing_unsubscribed_at is not null;

alter table public.customer_message_logs enable row level security;

revoke all on public.customer_message_logs from anon, authenticated;
grant all on public.customer_message_logs to authenticated;

drop policy if exists customer_message_logs_admin_all on public.customer_message_logs;
create policy customer_message_logs_admin_all
on public.customer_message_logs
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());
