-- Customer account recovery and marketing preferences.
-- Apply before deploying or using the updated customer-auth Edge Function.

alter table public.customers
  add column if not exists marketing_opt_in boolean not null default false,
  add column if not exists last_login_at timestamptz,
  add column if not exists password_reset_token_hash text,
  add column if not exists password_reset_expires_at timestamptz,
  add column if not exists password_reset_sent_at timestamptz,
  add column if not exists password_reset_used_at timestamptz;

create index if not exists customers_password_reset_expires_idx
on public.customers (password_reset_expires_at)
where password_reset_token_hash is not null;
