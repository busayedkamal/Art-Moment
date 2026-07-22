-- Art Moment reward-points hardening.
-- Run after 202607190002_reward_points_program_corrected_full.sql.
-- This migration does not remigrate wallet balances or duplicate reward lots.

begin;

-- Keep the live policy explicit even if the columns existed before the main migration.
update public.settings
set reward_program_enabled = true,
    reward_points_per_riyal = 2,
    reward_point_value = 0.01,
    reward_minimum_redemption_points = 500,
    reward_maximum_redemption_percent = 25,
    reward_expiry_months = 4,
    reward_signup_bonus_enabled = true,
    reward_signup_bonus_points = 200
where id = 1;

alter table public.store_orders
  add column if not exists reward_points_restored bigint not null default 0,
  add column if not exists points_restored_amount numeric(10, 2) not null default 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'store_orders_reward_points_restored_check'
  ) then
    alter table public.store_orders
      add constraint store_orders_reward_points_restored_check
      check (reward_points_restored >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'store_orders_points_restored_amount_check'
  ) then
    alter table public.store_orders
      add constraint store_orders_points_restored_amount_check
      check (points_restored_amount >= 0);
  end if;
end $$;

-- Preserve every transaction type currently used by the application, including
-- package_add which is still read by reports and may be used by older admin flows.
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

-- A signup bonus belongs to the first completed and paid purchase, not merely
-- the first order that happens to fire the reward trigger after deployment.
create or replace function public.reward_is_first_completed_purchase(
  p_wallet_id bigint,
  p_source_type text,
  p_source_id text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  wallet_phone text;
  source_created_at timestamptz;
  has_earlier_purchase boolean := false;
begin
  select public.reward_normalize_phone(wallet.phone)
  into wallet_phone
  from public.wallets wallet
  where wallet.id = p_wallet_id;

  if coalesce(wallet_phone, '') = '' then
    return false;
  end if;

  if p_source_type = 'print_order' then
    select order_row.created_at
    into source_created_at
    from public.orders order_row
    where order_row.id::text = p_source_id;
  elsif p_source_type = 'store_order' then
    select store_order.created_at
    into source_created_at
    from public.store_orders store_order
    where store_order.id::text = p_source_id;
  else
    return false;
  end if;

  if source_created_at is null then
    return false;
  end if;

  select exists (
    select 1
    from (
      select
        order_row.created_at,
        order_row.id::text as source_id,
        'print_order'::text as source_type
      from public.orders order_row
      where public.reward_normalize_phone(order_row.phone) = wallet_phone
        and order_row.status = 'delivered'
        and coalesce(order_row.payment_status, '') = 'paid'

      union all

      select
        store_order.created_at,
        store_order.id::text as source_id,
        'store_order'::text as source_type
      from public.store_orders store_order
      where public.reward_normalize_phone(store_order.phone) = wallet_phone
        and store_order.status = 'delivered'
        and coalesce(store_order.payment_status, '') in ('paid', 'partial_refund')
    ) completed_purchase
    where (
      completed_purchase.source_type <> p_source_type
      or completed_purchase.source_id <> p_source_id
    )
    and (
      completed_purchase.created_at < source_created_at
      or (
        completed_purchase.created_at = source_created_at
        and completed_purchase.source_type || ':' || completed_purchase.source_id
          < p_source_type || ':' || p_source_id
      )
    )
  ) into has_earlier_purchase;

  return not has_earlier_purchase;
end;
$$;

-- Reconcile earned points without duplicating order awards. Re-activating a
-- previously reversed award receives a fresh four-month expiry window.
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
  is_first_completed_purchase boolean := false;
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
    target_points := floor(
      greatest(coalesce(p_eligible_amount, 0), 0)
        * coalesce(rules.reward_points_per_riyal, 2)
    );
  end if;

  expiry_at := now() + make_interval(months => coalesce(rules.reward_expiry_months, 4));

  select exists (
    select 1
    from public.wallets wallet
    join public.customers customer
      on public.reward_normalize_phone(customer.phone) = public.reward_normalize_phone(wallet.phone)
    where wallet.id = p_wallet_id
  ) into has_customer_account;

  select *
  into existing_earn
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
      p_wallet_id,
      case when p_source_type = 'print_order' then p_source_id else null end,
      'reward_points_earn',
      0,
      round(target_points * coalesce(rules.reward_point_value, 0.01), 2),
      target_points,
      target_points,
      coalesce(rules.reward_point_value, 0.01),
      greatest(coalesce(p_eligible_amount, 0), 0),
      expiry_at,
      p_source_type,
      p_source_id,
      jsonb_build_object('description', coalesce(p_description, '')),
      now()
    );
    points_delta := target_points;
  elsif has_existing_earn then
    current_points := coalesce(existing_earn.reward_points_delta, 0);
    points_delta := target_points - current_points;

    update public.wallet_transactions
    set reward_points_delta = target_points,
        reward_points_remaining = greatest(
          0,
          coalesce(reward_points_remaining, 0) + points_delta
        ),
        amount_value = round(target_points * coalesce(rules.reward_point_value, 0.01), 2),
        reward_eligible_amount = greatest(coalesce(p_eligible_amount, 0), 0),
        reward_expires_at = case
          when current_points <= 0 and target_points > 0 then expiry_at
          else reward_expires_at
        end,
        order_id = case
          when p_source_type = 'print_order' then p_source_id
          else order_id
        end,
        reward_metadata = coalesce(reward_metadata, '{}'::jsonb)
          || jsonb_build_object(
            'reconciled_at', now(),
            'description', coalesce(p_description, '')
          )
    where id = existing_earn.id;
  end if;

  update public.wallets
  set reward_points_balance = reward_points_balance + points_delta,
      points_balance = round(
        (reward_points_balance + points_delta)
          * coalesce(rules.reward_point_value, 0.01),
        2
      ),
      reward_points_updated_at = now()
  where id = p_wallet_id
  returning reward_points_balance into wallet_balance;

  select *
  into existing_bonus
  from public.wallet_transactions
  where wallet_id = p_wallet_id
    and type = 'reward_signup_bonus'
  limit 1;
  has_existing_bonus := found;

  if target_points > 0 and has_customer_account then
    is_first_completed_purchase := public.reward_is_first_completed_purchase(
      p_wallet_id,
      p_source_type,
      p_source_id
    );
  end if;

  if target_points > 0
    and has_customer_account
    and is_first_completed_purchase
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
          p_wallet_id,
          case when p_source_type = 'print_order' then p_source_id else null end,
          'reward_signup_bonus',
          0,
          round(bonus_points * coalesce(rules.reward_point_value, 0.01), 2),
          bonus_points,
          bonus_points,
          coalesce(rules.reward_point_value, 0.01),
          expiry_at,
          p_source_type,
          p_source_id,
          jsonb_build_object('reason', 'first_completed_purchase'),
          now()
        );

        update public.wallets
        set reward_points_balance = reward_points_balance + bonus_points,
            points_balance = round(
              (reward_points_balance + bonus_points)
                * coalesce(rules.reward_point_value, 0.01),
              2
            ),
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
            || jsonb_build_object(
              'reversed_at', now(),
              'reason', 'qualifying_order_reversed'
            )
      where id = existing_bonus.id;

      insert into public.wallet_transactions (
        wallet_id, order_id, type, points, amount_value,
        reward_points_delta, reward_point_value,
        reward_source_type, reward_source_id, reward_metadata, created_at
      ) values (
        p_wallet_id,
        case when p_source_type = 'print_order' then p_source_id else null end,
        'reward_signup_bonus_reversal',
        0,
        round(abs(bonus_points) * coalesce(rules.reward_point_value, 0.01), 2),
        bonus_points,
        coalesce(rules.reward_point_value, 0.01),
        p_source_type,
        p_source_id,
        jsonb_build_object('reason', 'qualifying_order_reversed'),
        now()
      );

      update public.wallets
      set reward_points_balance = reward_points_balance + bonus_points,
          points_balance = round(
            (reward_points_balance + bonus_points)
              * coalesce(rules.reward_point_value, 0.01),
            2
          ),
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
    'balanceValue', round(
      coalesce(wallet_balance, 0) * coalesce(rules.reward_point_value, 0.01),
      2
    ),
    'expiresAt', case when target_points > 0 then expiry_at else null end
  );
end;
$$;

-- Print orders earn only when their cash payment plus points covers the full
-- order. Delivery and the amount paid with points never earn points.
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
  payment_covered boolean := false;
  result jsonb;
begin
  wallet_id := public.find_reward_wallet(new.phone);
  if wallet_id is null then
    new.reward_points_earned := 0;
    return new;
  end if;

  redemption_points := case
    when new.status in ('cancelled', 'returned') then 0
    else greatest(coalesce(new.reward_points_used, 0), 0)
  end;

  perform public.set_reward_points_redemption(
    wallet_id,
    'print_order',
    new.id::text,
    redemption_points,
    greatest(coalesce(new.total_amount, 0) - coalesce(new.delivery_fee, 0), 0)
  );

  payment_covered :=
    coalesce(new.deposit, 0) + coalesce(new.points_used_amount, 0) + 0.009
      >= greatest(coalesce(new.total_amount, 0), 0);

  if new.status = 'delivered'
    and coalesce(new.payment_status, '') = 'paid'
    and payment_covered then
    eligible_amount := greatest(
      0,
      least(
        greatest(coalesce(new.deposit, 0) - coalesce(new.delivery_fee, 0), 0),
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

-- Store orders use the retained product value after refunds. Restored points
-- reduce the points still applied before the remaining cash value earns points.
create or replace function public.apply_store_order_reward_points()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  wallet_id bigint;
  point_value numeric := 0.01;
  order_point_value numeric := 0.01;
  eligible_amount numeric := 0;
  redemption_points bigint := 0;
  restored_points bigint := 0;
  refund_ratio numeric := 0;
  original_points_value numeric := 0;
  restored_points_value numeric := 0;
  current_points_value numeric := 0;
  retained_product_value numeric := 0;
  cash_refund_value numeric := 0;
  net_cash_paid_for_products numeric := 0;
  payment_covered boolean := false;
  result jsonb;
begin
  wallet_id := public.find_reward_wallet(new.phone);
  if wallet_id is null then
    new.reward_points_earned := 0;
    new.reward_points_restored := 0;
    new.points_restored_amount := 0;
    return new;
  end if;

  select coalesce(settings.reward_point_value, 0.01)
  into point_value
  from public.settings settings
  where settings.id = 1;

  order_point_value := case
    when coalesce(new.reward_points_used, 0) > 0
      and coalesce(new.points_used_amount, 0) > 0
      then new.points_used_amount / new.reward_points_used
    else point_value
  end;

  original_points_value := greatest(
    case
      when coalesce(new.points_used_amount, 0) > 0 then new.points_used_amount
      when coalesce(new.reward_points_used, 0) > 0
        then new.reward_points_used * order_point_value
      else 0
    end,
    0
  );

  refund_ratio := case
    when coalesce(new.total_amount, 0) > 0 then least(
      1,
      greatest(0, coalesce(new.refunded_amount, 0) / new.total_amount)
    )
    else 0
  end;

  redemption_points := case
    when new.status in ('cancelled', 'returned')
      or coalesce(new.payment_status, '') = 'full_refund' then 0
    when coalesce(new.payment_status, '') = 'partial_refund' then greatest(
      0,
      round(coalesce(new.reward_points_used, 0) * (1 - refund_ratio))::bigint
    )
    else greatest(coalesce(new.reward_points_used, 0), 0)
  end;

  restored_points := greatest(
    coalesce(new.reward_points_used, 0) - redemption_points,
    0
  );
  restored_points_value := round(restored_points * order_point_value, 2);
  current_points_value := round(redemption_points * order_point_value, 2);

  new.reward_points_restored := restored_points;
  new.points_restored_amount := restored_points_value;

  if tg_op <> 'INSERT' then
    perform public.set_reward_points_redemption(
      wallet_id,
      'store_order',
      new.id::text,
      redemption_points,
      greatest(coalesce(new.total_amount, 0), 0)
    );
  end if;

  payment_covered :=
    coalesce(new.amount_paid, 0) + original_points_value + 0.009
      >= greatest(
        coalesce(new.total_amount, 0) + coalesce(new.delivery_fee, 0),
        0
      );

  if new.status = 'delivered'
    and coalesce(new.payment_status, '') in ('paid', 'partial_refund')
    and payment_covered then
    retained_product_value := greatest(
      0,
      coalesce(new.total_amount, 0)
        - least(coalesce(new.refunded_amount, 0), coalesce(new.total_amount, 0))
    );

    cash_refund_value := greatest(
      0,
      least(coalesce(new.refunded_amount, 0), coalesce(new.total_amount, 0))
        - restored_points_value
    );

    net_cash_paid_for_products := greatest(
      0,
      coalesce(new.amount_paid, 0)
        - coalesce(new.delivery_fee, 0)
        - cash_refund_value
    );

    eligible_amount := greatest(
      0,
      least(
        retained_product_value - current_points_value,
        net_cash_paid_for_products
      )
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
before insert or update of
  status,
  payment_status,
  deposit,
  total_amount,
  delivery_fee,
  reward_points_used,
  points_used_amount
on public.orders
for each row execute function public.apply_print_order_reward_points();

drop trigger if exists store_orders_reward_points_trigger on public.store_orders;
create trigger store_orders_reward_points_trigger
before insert or update of
  status,
  payment_status,
  amount_paid,
  total_amount,
  delivery_fee,
  reward_points_used,
  points_used_amount,
  refunded_amount
on public.store_orders
for each row execute function public.apply_store_order_reward_points();

revoke all on function public.reward_is_first_completed_purchase(bigint, text, text) from public;
revoke all on function public.reconcile_reward_points_award(bigint, text, text, numeric, text) from public;

grant execute on function public.reconcile_reward_points_award(bigint, text, text, numeric, text)
to authenticated, service_role;

comment on column public.store_orders.reward_points_restored is
  'Reward points restored to the customer after a partial or full refund.';
comment on column public.store_orders.points_restored_amount is
  'SAR value of reward points restored after a partial or full refund.';

notify pgrst, 'reload schema';

commit;
