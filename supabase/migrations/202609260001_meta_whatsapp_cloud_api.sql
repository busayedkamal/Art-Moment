-- Meta WhatsApp Cloud API configuration.
-- The access token is deliberately kept out of the database and must be stored
-- as the META_WHATSAPP_ACCESS_TOKEN Supabase Edge Function secret.

alter table public.settings
  add column if not exists whatsapp_enabled boolean not null default false,
  add column if not exists whatsapp_provider text not null default 'meta',
  add column if not exists whatsapp_meta_api_version text not null default 'v26.0',
  add column if not exists whatsapp_phone_number_id text,
  add column if not exists whatsapp_waba_id text,
  add column if not exists whatsapp_template_language text not null default 'ar',
  add column if not exists whatsapp_order_status_template text not null default 'order_status_update',
  add column if not exists whatsapp_last_tested_at timestamptz,
  add column if not exists whatsapp_last_test_status text,
  add column if not exists whatsapp_verified_name text,
  add column if not exists whatsapp_display_phone_number text,
  add column if not exists whatsapp_quality_rating text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'settings_whatsapp_provider_check'
  ) then
    alter table public.settings
      add constraint settings_whatsapp_provider_check
      check (whatsapp_provider in ('meta'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'settings_whatsapp_api_version_check'
  ) then
    alter table public.settings
      add constraint settings_whatsapp_api_version_check
      check (whatsapp_meta_api_version ~ '^v[0-9]+\.[0-9]+$');
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'settings_whatsapp_test_status_check'
  ) then
    alter table public.settings
      add constraint settings_whatsapp_test_status_check
      check (whatsapp_last_test_status is null or whatsapp_last_test_status in ('connected', 'failed'));
  end if;
end $$;

update public.settings
set whatsapp_provider = 'meta',
    whatsapp_meta_api_version = coalesce(nullif(whatsapp_meta_api_version, ''), 'v26.0'),
    whatsapp_template_language = coalesce(nullif(whatsapp_template_language, ''), 'ar'),
    whatsapp_order_status_template = coalesce(nullif(whatsapp_order_status_template, ''), 'order_status_update')
where id = 1;
alter table public.customer_message_logs
  add column if not exists provider_id text,
  add column if not exists delivered_at timestamptz,
  add column if not exists read_at timestamptz;

create index if not exists customer_message_logs_provider_id_idx
on public.customer_message_logs (provider_id)
where provider_id is not null;

alter table public.customer_message_logs
  drop constraint if exists customer_message_logs_status_check;

alter table public.customer_message_logs
  add constraint customer_message_logs_status_check
  check (status in ('queued', 'sent', 'delivered', 'read', 'failed', 'skipped', 'completed'));