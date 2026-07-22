-- Reward expiry reminders and secure customer redemption for existing store orders.

begin;

create table if not exists public.reward_expiry_notifications (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,
  wallet_id bigint not null references public.wallets(id) on delete cascade,
  trigger_type text not null default 'automatic',
  reminder_days integer not null,
  expires_on date not null,
  points bigint not null default 0,
  value_sar numeric(12, 2) not null default 0,
  recipient_email text,
  status text not null default 'queued',
  attempts integer not null default 0,
  provider_id text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reward_expiry_notifications_trigger_check
    check (trigger_type in ('automatic', 'manual')),
  constraint reward_expiry_notifications_status_check
    check (status in ('queued', 'sent', 'failed', 'skipped')),
  constraint reward_expiry_notifications_reminder_days_check
    check (reminder_days between 0 and 365),
  constraint reward_expiry_notifications_points_check
    check (points >= 0 and value_sar >= 0)
);

create unique index if not exists reward_expiry_notifications_automatic_unique_idx
on public.reward_expiry_notifications (wallet_id, reminder_days, expires_on)
where trigger_type = 'automatic';

create index if not exists reward_expiry_notifications_customer_idx
on public.reward_expiry_notifications (customer_id, created_at desc);

create index if not exists reward_expiry_notifications_status_idx
on public.reward_expiry_notifications (status, created_at desc);

alter table public.reward_expiry_notifications enable row level security;
revoke all on public.reward_expiry_notifications from anon, authenticated;
grant all on public.reward_expiry_notifications to authenticated;

drop policy if exists reward_expiry_notifications_admin_all on public.reward_expiry_notifications;
create policy reward_expiry_notifications_admin_all
on public.reward_expiry_notifications
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create or replace function public.customer_apply_store_order_reward_points(
  p_customer_id uuid,
  p_order_id text,
  p_requested_points bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $apply_reward_points$
declare
  customer_row public.customers%rowtype;
  order_row public.store_orders%rowtype;
  wallet_id bigint;
  rules record;
  requested_points bigint := greatest(coalesce(p_requested_points, 0), 0);
  point_value numeric := 0.01;
  product_cash_paid numeric := 0;
  product_remaining numeric := 0;
  maximum_by_remaining bigint := 0;
  redemption jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'not_authorized';
  end if;

  select * into customer_row
  from public.customers
  where id = p_customer_id;
  if not found then
    raise exception 'customer_not_found';
  end if;

  select * into order_row
  from public.store_orders store_order
  where (
      store_order.id::text = trim(coalesce(p_order_id, ''))
      or lower(coalesce(store_order.short_id, '')) = lower(left(trim(coalesce(p_order_id, '')), 6))
    )
    and (
      store_order.customer_id = customer_row.id
      or public.reward_normalize_phone(store_order.phone) = public.reward_normalize_phone(customer_row.phone)
    )
  limit 1
  for update;
  if not found then
    raise exception 'order_not_found';
  end if;

  if coalesce(order_row.status, '') in ('cancelled', 'returned')
    or coalesce(order_row.payment_status, '') in ('paid', 'partial_refund', 'full_refund') then
    raise exception 'reward_redemption_order_locked';
  end if;

  wallet_id := public.find_reward_wallet(customer_row.phone);
  if wallet_id is null then
    raise exception 'reward_wallet_not_found';
  end if;

  select reward_point_value into point_value
  from public.settings
  where id = 1;
  point_value := coalesce(point_value, 0.01);

  -- Cash covers delivery first; reward points may only reduce product value.
  product_cash_paid := greatest(0, coalesce(order_row.amount_paid, 0) - coalesce(order_row.delivery_fee, 0));
  product_remaining := greatest(0, coalesce(order_row.total_amount, 0) - product_cash_paid);
  maximum_by_remaining := floor(product_remaining / point_value);
  if requested_points > maximum_by_remaining
    and requested_points > greatest(coalesce(order_row.reward_points_used, 0), 0) then
    raise exception 'reward_redemption_exceeds_unpaid_products';
  end if;

  redemption := public.set_reward_points_redemption(
    wallet_id,
    'store_order',
    order_row.id::text,
    requested_points,
    coalesce(order_row.total_amount, 0)
  );

  update public.store_orders
  set reward_points_used = requested_points,
      points_used_amount = round(requested_points * point_value, 2),
      payment_updated_at = now()
  where id = order_row.id;

  return redemption || jsonb_build_object(
    'orderId', order_row.id,
    'paymentStatus', order_row.payment_status,
    'remainingAmount', greatest(
      0,
      coalesce(order_row.total_amount, 0)
        + coalesce(order_row.delivery_fee, 0)
        - coalesce(order_row.amount_paid, 0)
        - round(requested_points * point_value, 2)
    )
  );
end;
$apply_reward_points$;

revoke all on function public.customer_apply_store_order_reward_points(uuid, text, bigint) from public;
grant execute on function public.customer_apply_store_order_reward_points(uuid, text, bigint) to service_role;

-- Call this after adding Vault secrets named reward_expiry_function_url and
-- reward_expiry_cron_secret. The schedule runs daily at 07:00 Asia/Riyadh.
create or replace function public.schedule_reward_expiry_notifications()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $schedule_reward_expiry$
declare
  function_url text;
  cron_secret text;
  cron_command text;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_admin() then
    raise exception 'not_authorized';
  end if;
  if to_regnamespace('cron') is null or to_regnamespace('net') is null then
    raise exception 'cron_or_pg_net_extension_missing';
  end if;

  select decrypted_secret into function_url
  from vault.decrypted_secrets
  where name = 'reward_expiry_function_url'
  order by created_at desc
  limit 1;
  select decrypted_secret into cron_secret
  from vault.decrypted_secrets
  where name = 'reward_expiry_cron_secret'
  order by created_at desc
  limit 1;
  if nullif(trim(function_url), '') is null or nullif(trim(cron_secret), '') is null then
    raise exception 'reward_expiry_vault_secrets_missing';
  end if;

  begin
    perform cron.unschedule('send-art-moment-reward-expiry-reminders');
  exception when others then
    null;
  end;

  cron_command := format(
    'select net.http_post(url := %L, headers := jsonb_build_object(''Content-Type'', ''application/json'', ''x-reward-cron-secret'', %L), body := ''{"mode":"daily"}''::jsonb);',
    function_url,
    cron_secret
  );
  perform cron.schedule('send-art-moment-reward-expiry-reminders', '0 4 * * *', cron_command);
end;
$schedule_reward_expiry$;

revoke all on function public.schedule_reward_expiry_notifications() from public;
grant execute on function public.schedule_reward_expiry_notifications() to authenticated, service_role;

commit;
