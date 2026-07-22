-- Art Moment reward points program.
-- 2 points per paid SAR, 100 points = 1 SAR, 500-point minimum,
-- 25% maximum redemption, and four-month expiry.

begin;

alter table public.settings
  add column if not exists reward_program_enabled boolean not null default true,
  add column if not exists reward_points_per_riyal numeric(10, 4) not null default 2,
  add column if not exists reward_point_value numeric(10, 4) not null default 0.01,
  add column if not exists reward_minimum_redemption_points integer not null default 500,
  add column if not exists reward_maximum_redemption_percent numeric(5, 2) not null default 25,
  add column if not exists reward_expiry_months integer not null default 4,
  add column if not exists reward_signup_bonus_enabled boolean not null default true,
  add column if not exists reward_signup_bonus_points integer not null default 200;

alter table public.wallets
  add column if not exists reward_points_balance bigint not null default 0,
  add column if not exists reward_points_updated_at timestamptz,
  add column if not exists store_credit_balance numeric(12, 2) not null default 0;

alter table public.wallet_transactions
  add column if not exists reward_points_delta bigint not null default 0,
  add column if not exists reward_points_remaining bigint not null default 0,
  add column if not exists reward_point_value numeric(10, 4),
  add column if not exists reward_eligible_amount numeric(12, 2),
  add column if not exists reward_expires_at timestamptz,
  add column if not exists reward_source_type text,
  add column if not exists reward_source_id text,
  add column if not exists reward_metadata jsonb not null default '{}'::jsonb;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'wallet_transactions'
      and column_name = 'reward_source_id'
      and data_type <> 'text'
  ) then
    alter table public.wallet_transactions
      alter column reward_source_id type text
      using reward_source_id::text;
  end if;
end $$;

alter table public.orders
  add column if not exists reward_points_earned bigint not null default 0,
  add column if not exists reward_points_used bigint not null default 0;

alter table public.store_orders
  add column if not exists reward_points_earned bigint not null default 0,
  add column if not exists reward_points_used bigint not null default 0,
  add column if not exists points_used_amount numeric(10, 2) not null default 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'settings_reward_points_per_riyal_check') then
    alter table public.settings add constraint settings_reward_points_per_riyal_check
      check (reward_points_per_riyal between 0 and 100);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'settings_reward_point_value_check') then
    alter table public.settings add constraint settings_reward_point_value_check
      check (reward_point_value > 0 and reward_point_value <= 100);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'settings_reward_minimum_redemption_check') then
    alter table public.settings add constraint settings_reward_minimum_redemption_check
      check (reward_minimum_redemption_points between 0 and 10000000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'settings_reward_maximum_redemption_check') then
    alter table public.settings add constraint settings_reward_maximum_redemption_check
      check (reward_maximum_redemption_percent between 0 and 100);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'settings_reward_expiry_months_check') then
    alter table public.settings add constraint settings_reward_expiry_months_check
      check (reward_expiry_months between 1 and 60);
  end if;
end $$;

create index if not exists wallet_transactions_reward_expiry_idx
on public.wallet_transactions (wallet_id, reward_expires_at)
where reward_points_remaining > 0;

create index if not exists wallet_transactions_reward_source_idx
on public.wallet_transactions (reward_source_type, reward_source_id, type);

create unique index if not exists wallet_transactions_reward_unique_action_idx
on public.wallet_transactions (wallet_id, reward_source_type, reward_source_id, type)
where reward_source_id is not null
  and type in ('reward_points_earn', 'reward_signup_bonus', 'reward_points_redeem');

-- Preserve every existing cashback SAR as points. The transition lot receives
-- a fresh four-month window so no historical balance expires immediately.
update public.wallets
set reward_points_balance = round(coalesce(points_balance, 0) / 0.01)::bigint,
    reward_points_updated_at = coalesce(reward_points_updated_at, now())
where reward_points_balance = 0
  and coalesce(points_balance, 0) <> 0;

alter table public.wallet_transactions
  drop constraint if exists wallet_transactions_type_check;

alter table public.wallet_transactions
  add constraint wallet_transactions_type_check
  check (
    type in (
      'earn',
      'redeem',
      'loyalty_earn',
      'manual_adjustment',
      'deposit_excess',
      'package_add',
      'package_charge',
      'package_redeem',
      'reward_points_migration',
      'reward_points_expire',
      'reward_points_earn',
      'reward_signup_bonus',
      'reward_signup_bonus_reversed',
      'reward_signup_bonus_reversal',
      'reward_points_restore',
      'reward_points_redeem',
      'reward_points_adjustment',
      'store_credit_adjustment'
    )
  );

insert into public.wallet_transactions (
  wallet_id,
  type,
  points,
  amount_value,
  reward_points_delta,
  reward_points_remaining,
  reward_point_value,
  reward_expires_at,
  reward_source_type,
  reward_metadata,
  created_at
)
select
  wallet.id,
  'reward_points_migration',
  0,
  round(wallet.reward_points_balance * 0.01, 2),
  wallet.reward_points_balance,
  wallet.reward_points_balance,
  0.01,
  now() + interval '4 months',
  'legacy_wallet',
  jsonb_build_object('migrated_cashback_sar', wallet.points_balance),
  now()
from public.wallets wallet
where wallet.reward_points_balance > 0
  and not exists (
    select 1
    from public.wallet_transactions tx
    where tx.wallet_id = wallet.id
      and tx.type = 'reward_points_migration'
  );

-- Map historical print-order redemptions into the new ledger fields without
-- changing their monetary effect.
update public.wallet_transactions
set reward_points_delta = -round(greatest(coalesce(amount_value, 0), 0) / 0.01)::bigint,
    reward_point_value = 0.01,
    reward_source_type = 'print_order',
    reward_source_id = order_id
where type = 'redeem'
  and order_id is not null
  and reward_points_delta = 0;

create or replace function public.reward_normalize_phone(raw_phone text)
returns text
language sql
immutable
as $$
  select regexp_replace(
    regexp_replace(
      regexp_replace(coalesce(raw_phone, ''), '\D', '', 'g'),
      '^00966', ''
    ),
    '^(966|0)', ''
  );
$$;

create or replace function public.find_reward_wallet(raw_phone text)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select wallet.id
  from public.wallets wallet
  where public.reward_normalize_phone(wallet.phone) = public.reward_normalize_phone(raw_phone)
    and public.reward_normalize_phone(raw_phone) <> ''
  order by wallet.reward_points_balance desc, wallet.id desc
  limit 1;
$$;

create or replace function public.expire_reward_points_internal(p_wallet_id bigint default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  expired_lot record;
  expired_count integer := 0;
  point_value numeric := 0.01;
begin
  select coalesce(reward_point_value, 0.01)
  into point_value
  from public.settings
  where id = 1;

  for expired_lot in
    select tx.id, tx.wallet_id, tx.reward_points_remaining
    from public.wallet_transactions tx
    where tx.reward_points_remaining > 0
      and tx.reward_expires_at is not null
      and tx.reward_expires_at <= now()
      and (p_wallet_id is null or tx.wallet_id = p_wallet_id)
    order by tx.reward_expires_at, tx.id
    for update
  loop
    update public.wallet_transactions
    set reward_points_remaining = 0,
        reward_metadata = coalesce(reward_metadata, '{}'::jsonb)
          || jsonb_build_object('expired_at', now())
    where id = expired_lot.id;

    insert into public.wallet_transactions (
      wallet_id, type, points, amount_value,
      reward_points_delta, reward_point_value,
      reward_source_type, reward_metadata, created_at
    ) values (
      expired_lot.wallet_id,
      'reward_points_expire',
      0,
      round(expired_lot.reward_points_remaining * point_value, 2),
      -expired_lot.reward_points_remaining,
      point_value,
      'expiry',
      jsonb_build_object('expired_lot_id', expired_lot.id),
      now()
    );

    update public.wallets
    set reward_points_balance = reward_points_balance - expired_lot.reward_points_remaining,
        points_balance = round((reward_points_balance - expired_lot.reward_points_remaining) * point_value, 2),
        reward_points_updated_at = now()
    where id = expired_lot.wallet_id;

    expired_count := expired_count + 1;
  end loop;

  return expired_count;
end;
$$;

create or replace function public.expire_reward_points(p_wallet_id bigint default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_admin() then
    raise exception 'not_authorized';
  end if;
  return public.expire_reward_points_internal(p_wallet_id);
end;
$$;

create or replace function public.reconcile_reward_points_award(
  p_wallet_id bigint,
  p_source_type text,
  p_source_id text,
  p_eligible_amount numeric,
  p_description text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  rules record;
  existing_earn record;
  existing_bonus record;
  has_existing_earn boolean := false;
  has_existing_bonus boolean := false;
  has_customer_account boolean := false;
  target_points bigint := 0;
  current_points bigint := 0;
  points_delta bigint := 0;
  bonus_points bigint := 0;
  expiry_at timestamptz;
  wallet_balance bigint;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_admin() then
    raise exception 'not_authorized';
  end if;

  perform public.expire_reward_points_internal(p_wallet_id);

  select
    reward_program_enabled,
    reward_points_per_riyal,
    reward_point_value,
    reward_expiry_months,
    reward_signup_bonus_enabled,
    reward_signup_bonus_points
  into rules
  from public.settings
  where id = 1;

  if coalesce(rules.reward_program_enabled, true) then
    target_points := floor(greatest(coalesce(p_eligible_amount, 0), 0) * coalesce(rules.reward_points_per_riyal, 2));
  end if;
  expiry_at := now() + make_interval(months => coalesce(rules.reward_expiry_months, 4));

  select exists (
    select 1
    from public.wallets wallet
    join public.customers customer
      on public.reward_normalize_phone(customer.phone) = public.reward_normalize_phone(wallet.phone)
    where wallet.id = p_wallet_id
  ) into has_customer_account;

  select * into existing_earn
  from public.wallet_transactions
  where wallet_id = p_wallet_id
    and reward_source_type = p_source_type
    and reward_source_id = p_source_id
    and type = 'reward_points_earn'
  limit 1
  for update;
  has_existing_earn := found;

  if not has_existing_earn and target_points > 0 then
    insert into public.wallet_transactions (
      wallet_id, order_id, type, points, amount_value,
      reward_points_delta, reward_points_remaining,
      reward_point_value, reward_eligible_amount, reward_expires_at,
      reward_source_type, reward_source_id, reward_metadata, created_at
    ) values (
      p_wallet_id, case when p_source_type = 'print_order' then p_source_id else null end,
      'reward_points_earn', 0,
      round(target_points * coalesce(rules.reward_point_value, 0.01), 2),
      target_points, target_points,
      coalesce(rules.reward_point_value, 0.01),
      greatest(coalesce(p_eligible_amount, 0), 0),
      expiry_at, p_source_type, p_source_id,
      jsonb_build_object('description', coalesce(p_description, '')), now()
    );
    points_delta := target_points;
  elsif has_existing_earn then
    current_points := coalesce(existing_earn.reward_points_delta, 0);
    points_delta := target_points - current_points;
    update public.wallet_transactions
    set reward_points_delta = target_points,
        reward_points_remaining = greatest(0, coalesce(reward_points_remaining, 0) + points_delta),
        amount_value = round(target_points * coalesce(rules.reward_point_value, 0.01), 2),
        reward_eligible_amount = greatest(coalesce(p_eligible_amount, 0), 0),
        order_id = case when p_source_type = 'print_order' then p_source_id else order_id end,
        reward_metadata = coalesce(reward_metadata, '{}'::jsonb)
          || jsonb_build_object('reconciled_at', now(), 'description', coalesce(p_description, ''))
    where id = existing_earn.id;
  end if;

  update public.wallets
  set reward_points_balance = reward_points_balance + points_delta,
      points_balance = round((reward_points_balance + points_delta) * coalesce(rules.reward_point_value, 0.01), 2),
      reward_points_updated_at = now()
  where id = p_wallet_id
  returning reward_points_balance into wallet_balance;

  select * into existing_bonus
  from public.wallet_transactions
  where wallet_id = p_wallet_id
    and type = 'reward_signup_bonus'
  limit 1;
  has_existing_bonus := found;

  if target_points > 0
    and has_customer_account
    and coalesce(rules.reward_signup_bonus_enabled, true) then
    if not has_existing_bonus then
      bonus_points := greatest(coalesce(rules.reward_signup_bonus_points, 200), 0);
      if bonus_points > 0 then
        insert into public.wallet_transactions (
          wallet_id, order_id, type, points, amount_value,
          reward_points_delta, reward_points_remaining,
          reward_point_value, reward_expires_at,
          reward_source_type, reward_source_id, reward_metadata, created_at
        ) values (
          p_wallet_id, case when p_source_type = 'print_order' then p_source_id else null end,
          'reward_signup_bonus', 0,
          round(bonus_points * coalesce(rules.reward_point_value, 0.01), 2),
          bonus_points, bonus_points,
          coalesce(rules.reward_point_value, 0.01), expiry_at,
          p_source_type, p_source_id,
          jsonb_build_object('reason', 'first_completed_purchase'), now()
        );
        update public.wallets
        set reward_points_balance = reward_points_balance + bonus_points,
            points_balance = round((reward_points_balance + bonus_points) * coalesce(rules.reward_point_value, 0.01), 2),
            reward_points_updated_at = now()
        where id = p_wallet_id
        returning reward_points_balance into wallet_balance;
      end if;
    end if;
  elsif target_points = 0
    and has_existing_bonus
    and existing_bonus.reward_source_type = p_source_type
    and existing_bonus.reward_source_id = p_source_id
    and not (coalesce(existing_bonus.reward_metadata, '{}'::jsonb) ? 'expired_at') then
    bonus_points := -abs(coalesce(existing_bonus.reward_points_delta, 0));
    if bonus_points < 0 then
      update public.wallet_transactions
      set type = 'reward_signup_bonus_reversed',
          reward_points_remaining = 0,
          reward_metadata = coalesce(reward_metadata, '{}'::jsonb)
            || jsonb_build_object('reversed_at', now(), 'reason', 'qualifying_order_reversed')
      where id = existing_bonus.id;

      insert into public.wallet_transactions (
        wallet_id, order_id, type, points, amount_value,
        reward_points_delta, reward_point_value,
        reward_source_type, reward_source_id, reward_metadata, created_at
      ) values (
        p_wallet_id, case when p_source_type = 'print_order' then p_source_id else null end,
        'reward_signup_bonus_reversal', 0,
        round(abs(bonus_points) * coalesce(rules.reward_point_value, 0.01), 2),
        bonus_points, coalesce(rules.reward_point_value, 0.01),
        p_source_type, p_source_id,
        jsonb_build_object('reason', 'qualifying_order_reversed'), now()
      );

      update public.wallets
      set reward_points_balance = reward_points_balance + bonus_points,
          points_balance = round((reward_points_balance + bonus_points) * coalesce(rules.reward_point_value, 0.01), 2),
          reward_points_updated_at = now()
      where id = p_wallet_id
      returning reward_points_balance into wallet_balance;
    end if;
  end if;

  return jsonb_build_object(
    'earnedPoints', target_points,
    'adjustment', points_delta,
    'signupBonusPoints', bonus_points,
    'balancePoints', coalesce(wallet_balance, 0),
    'balanceValue', round(coalesce(wallet_balance, 0) * coalesce(rules.reward_point_value, 0.01), 2),
    'expiresAt', case when target_points > 0 then expiry_at else null end
  );
end;
$$;

create or replace function public.set_reward_points_redemption(
  p_wallet_id bigint,
  p_source_type text,
  p_source_id text,
  p_requested_points bigint,
  p_order_value numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  rules record;
  existing_redeem record;
  earn_lot record;
  has_existing_redeem boolean := false;
  requested_points bigint := greatest(coalesce(p_requested_points, 0), 0);
  previous_points bigint := 0;
  points_delta bigint := 0;
  points_to_allocate bigint := 0;
  lot_take bigint := 0;
  maximum_points bigint := 0;
  wallet_balance bigint := 0;
  restored_points bigint := 0;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_admin() then
    raise exception 'not_authorized';
  end if;

  perform public.expire_reward_points_internal(p_wallet_id);

  select
    reward_program_enabled,
    reward_point_value,
    reward_minimum_redemption_points,
    reward_maximum_redemption_percent,
    reward_expiry_months
  into rules
  from public.settings
  where id = 1;

  if not coalesce(rules.reward_program_enabled, true) and requested_points > 0 then
    raise exception 'reward_program_disabled';
  end if;

  maximum_points := floor(
    greatest(coalesce(p_order_value, 0), 0)
    * (coalesce(rules.reward_maximum_redemption_percent, 25) / 100)
    / coalesce(rules.reward_point_value, 0.01)
  );

  select * into existing_redeem
  from public.wallet_transactions
  where wallet_id = p_wallet_id
    and reward_source_type = p_source_type
    and reward_source_id = p_source_id
    and type in ('reward_points_redeem', 'redeem')
  order by case when type = 'reward_points_redeem' then 0 else 1 end
  limit 1
  for update;
  has_existing_redeem := found;

  if has_existing_redeem then
    previous_points := abs(coalesce(nullif(existing_redeem.reward_points_delta, 0),
      -round(greatest(coalesce(existing_redeem.amount_value, 0), 0) / coalesce(rules.reward_point_value, 0.01))));
  end if;
  points_delta := requested_points - previous_points;

  -- The minimum applies when adding a new redemption. A refund or correction
  -- may legitimately reduce an existing redemption below that threshold.
  if requested_points > 0
    and requested_points < coalesce(rules.reward_minimum_redemption_points, 500)
    and points_delta > 0 then
    raise exception 'reward_minimum_redemption_not_met';
  end if;

  if requested_points > maximum_points and requested_points > previous_points then
    raise exception 'reward_redemption_limit_exceeded';
  end if;

  select reward_points_balance into wallet_balance
  from public.wallets
  where id = p_wallet_id
  for update;

  if points_delta > 0 then
    if coalesce(wallet_balance, 0) < points_delta then
      raise exception 'reward_points_balance_insufficient';
    end if;

    points_to_allocate := points_delta;
    for earn_lot in
      select id, reward_points_remaining
      from public.wallet_transactions
      where wallet_id = p_wallet_id
        and reward_points_remaining > 0
        and (reward_expires_at is null or reward_expires_at > now())
      order by reward_expires_at nulls last, created_at, id
      for update
    loop
      exit when points_to_allocate <= 0;
      lot_take := least(points_to_allocate, earn_lot.reward_points_remaining);
      update public.wallet_transactions
      set reward_points_remaining = reward_points_remaining - lot_take
      where id = earn_lot.id;
      points_to_allocate := points_to_allocate - lot_take;
    end loop;

    if points_to_allocate > 0 then
      raise exception 'reward_points_lots_insufficient';
    end if;
  elsif points_delta < 0 then
    restored_points := abs(points_delta);
    insert into public.wallet_transactions (
      wallet_id, order_id, type, points, amount_value,
      reward_points_delta, reward_points_remaining,
      reward_point_value, reward_expires_at,
      reward_source_type, reward_source_id, reward_metadata, created_at
    ) values (
      p_wallet_id, case when p_source_type = 'print_order' then p_source_id else null end,
      'reward_points_restore', 0,
      round(restored_points * coalesce(rules.reward_point_value, 0.01), 2),
      restored_points, restored_points,
      coalesce(rules.reward_point_value, 0.01),
      now() + make_interval(months => coalesce(rules.reward_expiry_months, 4)),
      p_source_type, p_source_id,
      jsonb_build_object('reason', 'redemption_adjustment'), now()
    );
  end if;

  if not has_existing_redeem and requested_points > 0 then
    insert into public.wallet_transactions (
      wallet_id, order_id, type, points, amount_value,
      reward_points_delta, reward_point_value,
      reward_source_type, reward_source_id, reward_metadata, created_at
    ) values (
      p_wallet_id, case when p_source_type = 'print_order' then p_source_id else null end,
      'reward_points_redeem', 0,
      round(requested_points * coalesce(rules.reward_point_value, 0.01), 2),
      -requested_points, coalesce(rules.reward_point_value, 0.01),
      p_source_type, p_source_id,
      jsonb_build_object('order_value', p_order_value), now()
    );
  elsif has_existing_redeem then
    update public.wallet_transactions
    set type = 'reward_points_redeem',
        reward_points_delta = -requested_points,
        reward_point_value = coalesce(rules.reward_point_value, 0.01),
        amount_value = round(requested_points * coalesce(rules.reward_point_value, 0.01), 2),
        order_id = case when p_source_type = 'print_order' then p_source_id else order_id end,
        reward_source_type = p_source_type,
        reward_source_id = p_source_id,
        reward_metadata = coalesce(reward_metadata, '{}'::jsonb)
          || jsonb_build_object('order_value', p_order_value, 'updated_at', now())
    where id = existing_redeem.id;
  end if;

  update public.wallets
  set reward_points_balance = reward_points_balance - points_delta,
      points_balance = round((reward_points_balance - points_delta) * coalesce(rules.reward_point_value, 0.01), 2),
      reward_points_updated_at = now()
  where id = p_wallet_id
  returning reward_points_balance into wallet_balance;

  return jsonb_build_object(
    'usedPoints', requested_points,
    'usedValue', round(requested_points * coalesce(rules.reward_point_value, 0.01), 2),
    'balancePoints', wallet_balance,
    'balanceValue', round(wallet_balance * coalesce(rules.reward_point_value, 0.01), 2),
    'maximumPoints', maximum_points
  );
end;
$$;

create or replace function public.adjust_store_credit(
  p_wallet_id bigint,
  p_amount_delta numeric,
  p_reason text default null,
  p_source_type text default null,
  p_source_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  next_balance numeric(12, 2);
  transaction_id bigint;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_admin() then
    raise exception 'not_authorized';
  end if;

  update public.wallets
  set store_credit_balance = round(store_credit_balance + coalesce(p_amount_delta, 0), 2)
  where id = p_wallet_id
    and store_credit_balance + coalesce(p_amount_delta, 0) >= 0
  returning store_credit_balance into next_balance;

  if not found then
    raise exception 'store_credit_balance_insufficient';
  end if;

  insert into public.wallet_transactions (
    wallet_id, order_id, type, points, amount_value,
    reward_source_type, reward_source_id, reward_metadata, created_at
  ) values (
    p_wallet_id, case when p_source_type = 'print_order' then p_source_id else null end,
    'store_credit_adjustment', 0, round(coalesce(p_amount_delta, 0), 2),
    p_source_type, p_source_id,
    jsonb_build_object('reason', coalesce(nullif(trim(p_reason), ''), 'manual_adjustment')),
    now()
  ) returning id into transaction_id;

  return jsonb_build_object(
    'balance', next_balance,
    'adjustment', round(coalesce(p_amount_delta, 0), 2),
    'transactionId', transaction_id
  );
end;
$$;

create or replace function public.adjust_reward_points(
  p_wallet_id bigint,
  p_points_delta bigint,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  rules record;
  earn_lot record;
  points_to_remove bigint := greatest(-coalesce(p_points_delta, 0), 0);
  lot_take bigint := 0;
  expiry_at timestamptz;
  wallet_balance bigint := 0;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_admin() then
    raise exception 'not_authorized';
  end if;

  perform public.expire_reward_points_internal(p_wallet_id);

  select reward_point_value, reward_expiry_months
  into rules
  from public.settings
  where id = 1;

  select reward_points_balance into wallet_balance
  from public.wallets
  where id = p_wallet_id
  for update;

  if not found then
    raise exception 'reward_wallet_not_found';
  end if;

  expiry_at := now() + make_interval(months => coalesce(rules.reward_expiry_months, 4));

  if coalesce(p_points_delta, 0) > 0 then
    insert into public.wallet_transactions (
      wallet_id, type, points, amount_value,
      reward_points_delta, reward_points_remaining,
      reward_point_value, reward_expires_at,
      reward_source_type, reward_metadata, created_at
    ) values (
      p_wallet_id, 'reward_points_adjustment', 0,
      round(p_points_delta * coalesce(rules.reward_point_value, 0.01), 2),
      p_points_delta, p_points_delta,
      coalesce(rules.reward_point_value, 0.01), expiry_at,
      'admin_adjustment',
      jsonb_build_object('reason', coalesce(p_reason, 'manual_admin_adjustment')),
      now()
    );
  elsif coalesce(p_points_delta, 0) < 0 then
    for earn_lot in
      select id, reward_points_remaining
      from public.wallet_transactions
      where wallet_id = p_wallet_id
        and reward_points_remaining > 0
        and (reward_expires_at is null or reward_expires_at > now())
      order by reward_expires_at nulls last, created_at, id
      for update
    loop
      exit when points_to_remove <= 0;
      lot_take := least(points_to_remove, earn_lot.reward_points_remaining);
      update public.wallet_transactions
      set reward_points_remaining = reward_points_remaining - lot_take
      where id = earn_lot.id;
      points_to_remove := points_to_remove - lot_take;
    end loop;

    insert into public.wallet_transactions (
      wallet_id, type, points, amount_value,
      reward_points_delta, reward_point_value,
      reward_source_type, reward_metadata, created_at
    ) values (
      p_wallet_id, 'reward_points_adjustment', 0,
      round(abs(p_points_delta) * coalesce(rules.reward_point_value, 0.01), 2),
      p_points_delta, coalesce(rules.reward_point_value, 0.01),
      'admin_adjustment',
      jsonb_build_object(
        'reason', coalesce(p_reason, 'manual_admin_adjustment'),
        'uncovered_negative_points', points_to_remove
      ),
      now()
    );
  end if;

  update public.wallets
  set reward_points_balance = reward_points_balance + coalesce(p_points_delta, 0),
      points_balance = round(
        (reward_points_balance + coalesce(p_points_delta, 0))
          * coalesce(rules.reward_point_value, 0.01),
        2
      ),
      reward_points_updated_at = now()
  where id = p_wallet_id
  returning reward_points_balance into wallet_balance;

  return jsonb_build_object(
    'balancePoints', wallet_balance,
    'balanceValue', round(wallet_balance * coalesce(rules.reward_point_value, 0.01), 2),
    'expiresAt', case when coalesce(p_points_delta, 0) > 0 then expiry_at else null end
  );
end;
$$;

create or replace function public.apply_print_order_reward_points()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  wallet_id bigint;
  eligible_amount numeric := 0;
  redemption_points bigint := 0;
  result jsonb;
begin
  wallet_id := public.find_reward_wallet(new.phone);
  if wallet_id is null then return new; end if;

  redemption_points := case
    when new.status in ('cancelled', 'returned') then 0
    else greatest(coalesce(new.reward_points_used, 0), 0)
  end;

  perform public.set_reward_points_redemption(
    wallet_id,
    'print_order',
    new.id::text,
    redemption_points,
    greatest(coalesce(new.total_amount, 0), 0)
  );

  if new.status = 'delivered'
    and coalesce(new.payment_status, '') = 'paid' then
    eligible_amount := greatest(
      0,
      least(
        coalesce(new.deposit, 0),
        coalesce(new.total_amount, 0)
          - coalesce(new.delivery_fee, 0)
          - coalesce(new.points_used_amount, 0)
      )
    );
  end if;

  result := public.reconcile_reward_points_award(
    wallet_id,
    'print_order',
    new.id::text,
    eligible_amount,
    'طلب طباعة مدفوع ومكتمل'
  );
  new.reward_points_earned := coalesce((result ->> 'earnedPoints')::bigint, 0);
  return new;
end;
$$;

create or replace function public.apply_store_order_reward_points()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  wallet_id bigint;
  eligible_amount numeric := 0;
  redemption_points bigint := 0;
  refund_ratio numeric := 0;
  result jsonb;
begin
  wallet_id := public.find_reward_wallet(new.phone);
  if wallet_id is null then return new; end if;

  refund_ratio := case
    when coalesce(new.total_amount, 0) > 0
      then least(1, greatest(0, coalesce(new.refunded_amount, 0) / new.total_amount))
    else 0
  end;
  redemption_points := case
    when new.status in ('cancelled', 'returned')
      or coalesce(new.payment_status, '') = 'full_refund' then 0
    when coalesce(new.payment_status, '') = 'partial_refund'
      then greatest(0, round(coalesce(new.reward_points_used, 0) * (1 - refund_ratio))::bigint)
    else greatest(coalesce(new.reward_points_used, 0), 0)
  end;

  -- Checkout redeems only after products are inserted. Subsequent updates are
  -- reconciled here atomically with payment, refund, or cancellation changes.
  if tg_op <> 'INSERT' then
    perform public.set_reward_points_redemption(
      wallet_id,
      'store_order',
      new.id::text,
      redemption_points,
      greatest(coalesce(new.total_amount, 0), 0)
    );
  end if;

  if new.status = 'delivered'
    and coalesce(new.payment_status, '') in ('paid', 'partial_refund') then
    eligible_amount := greatest(
      0,
      coalesce(new.total_amount, 0)
        - coalesce(new.points_used_amount, 0)
        - coalesce(new.refunded_amount, 0)
    );
  end if;

  result := public.reconcile_reward_points_award(
    wallet_id,
    'store_order',
    new.id::text,
    eligible_amount,
    'طلب متجر مدفوع ومكتمل'
  );
  new.reward_points_earned := coalesce((result ->> 'earnedPoints')::bigint, 0);
  return new;
end;
$$;

drop trigger if exists orders_reward_points_trigger on public.orders;
create trigger orders_reward_points_trigger
before insert or update of status, payment_status, deposit, total_amount, delivery_fee, points_used_amount
on public.orders
for each row execute function public.apply_print_order_reward_points();

drop trigger if exists store_orders_reward_points_trigger on public.store_orders;
create trigger store_orders_reward_points_trigger
before insert or update of status, payment_status, total_amount, delivery_fee, points_used_amount, refunded_amount
on public.store_orders
for each row execute function public.apply_store_order_reward_points();

create or replace view public.reward_points_expiring_soon
with (security_invoker = true)
as
select
  tx.id,
  tx.wallet_id,
  wallet.phone,
  wallet.subscription_code,
  tx.reward_points_remaining as points,
  round(tx.reward_points_remaining * coalesce(tx.reward_point_value, 0.01), 2) as value_sar,
  tx.reward_expires_at,
  greatest(0, ceil(extract(epoch from (tx.reward_expires_at - now())) / 86400))::integer as days_remaining
from public.wallet_transactions tx
join public.wallets wallet on wallet.id = tx.wallet_id
where tx.reward_points_remaining > 0
  and tx.reward_expires_at > now()
  and tx.reward_expires_at <= now() + interval '30 days';

revoke all on public.reward_points_expiring_soon from anon, authenticated;
grant select on public.reward_points_expiring_soon to authenticated;

revoke all on function public.find_reward_wallet(text) from public;
revoke all on function public.expire_reward_points_internal(bigint) from public;
revoke all on function public.expire_reward_points(bigint) from public;
revoke all on function public.reconcile_reward_points_award(bigint, text, text, numeric, text) from public;
revoke all on function public.set_reward_points_redemption(bigint, text, text, bigint, numeric) from public;
revoke all on function public.adjust_reward_points(bigint, bigint, text) from public;
revoke all on function public.adjust_store_credit(bigint, numeric, text, text, text) from public;

grant execute on function public.expire_reward_points(bigint) to authenticated, service_role;
grant execute on function public.reconcile_reward_points_award(bigint, text, text, numeric, text) to authenticated, service_role;
grant execute on function public.set_reward_points_redemption(bigint, text, text, bigint, numeric) to authenticated, service_role;
grant execute on function public.adjust_reward_points(bigint, bigint, text) to authenticated, service_role;
grant execute on function public.adjust_store_credit(bigint, numeric, text, text, text) to authenticated, service_role;

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    begin
      perform cron.unschedule('expire-art-moment-reward-points');
    exception when others then
      null;
    end;
    perform cron.schedule(
      'expire-art-moment-reward-points',
      '15 0 * * *',
      'select public.expire_reward_points_internal(null);'
    );
  end if;
end $$;

comment on column public.wallets.reward_points_balance is 'Available reward points. Monetary mirror remains in points_balance for legacy accounting compatibility.';
comment on column public.wallets.store_credit_balance is 'Non-reward monetary credit such as overpayments and service compensation; it never earns reward points.';
comment on column public.wallet_transactions.reward_expires_at is 'Reward lot expiry. Art Moment default is four months from earning.';
comment on column public.settings.reward_expiry_months is 'Reward points validity in months. Default: 4.';

commit;
