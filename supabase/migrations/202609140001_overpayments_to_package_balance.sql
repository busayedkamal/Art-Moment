-- Keep customer overpayments as non-expiring package balance.
-- The ledger uses package_charge.points as a SAR balance amount.

begin;

create unique index if not exists wallet_transactions_package_credit_source_uq
on public.wallet_transactions (reward_source_type, reward_source_id)
where type = 'package_charge'
  and reward_source_type in (
    'print_order_excess',
    'store_order_excess',
    'legacy_cash_adjustment'
  )
  and reward_source_id is not null;

create or replace function public.credit_package_balance(
  p_wallet_id bigint,
  p_amount numeric,
  p_reason text,
  p_source_type text,
  p_source_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $credit_package_balance$
declare
  credited_amount numeric(12, 2) := round(coalesce(p_amount, 0), 2);
  existing_transaction public.wallet_transactions%rowtype;
  transaction_id bigint;
  package_balance numeric(12, 2);
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_admin() then
    raise exception 'not_authorized';
  end if;

  if credited_amount <= 0 then
    raise exception 'package_credit_must_be_positive';
  end if;

  if p_source_type not in ('print_order_excess', 'store_order_excess', 'legacy_cash_adjustment')
    or nullif(trim(coalesce(p_source_id, '')), '') is null then
    raise exception 'invalid_package_credit_source';
  end if;

  perform 1
  from public.wallets
  where id = p_wallet_id
  for update;

  if not found then
    raise exception 'wallet_not_found';
  end if;

  select *
  into existing_transaction
  from public.wallet_transactions
  where type = 'package_charge'
    and reward_source_type = p_source_type
    and reward_source_id = p_source_id
  limit 1;

  if found then
    select round(coalesce(sum(
      case
        when tx.type = 'package_charge' then tx.points
        when tx.type = 'package_redeem' then -tx.amount_value
        else 0
      end
    ), 0), 2)
    into package_balance
    from public.wallet_transactions tx
    where tx.wallet_id = existing_transaction.wallet_id
      and tx.type in ('package_charge', 'package_redeem');

    return jsonb_build_object(
      'alreadyCredited', true,
      'amount', existing_transaction.points,
      'balance', package_balance,
      'transactionId', existing_transaction.id,
      'walletId', existing_transaction.wallet_id
    );
  end if;

  insert into public.wallet_transactions (
    wallet_id,
    type,
    points,
    amount_value,
    reward_source_type,
    reward_source_id,
    reward_metadata,
    created_at
  ) values (
    p_wallet_id,
    'package_charge',
    credited_amount,
    credited_amount,
    p_source_type,
    p_source_id,
    jsonb_build_object(
      'reason', coalesce(nullif(trim(p_reason), ''), 'customer_overpayment'),
      'non_expiring', true,
      'credited_as', 'package_balance'
    ),
    now()
  )
  returning id into transaction_id;

  select round(coalesce(sum(
    case
      when tx.type = 'package_charge' then tx.points
      when tx.type = 'package_redeem' then -tx.amount_value
      else 0
    end
  ), 0), 2)
  into package_balance
  from public.wallet_transactions tx
  where tx.wallet_id = p_wallet_id
    and tx.type in ('package_charge', 'package_redeem');

  return jsonb_build_object(
    'alreadyCredited', false,
    'amount', credited_amount,
    'balance', package_balance,
    'transactionId', transaction_id,
    'walletId', p_wallet_id
  );
end;
$credit_package_balance$;

create or replace function public.credit_customer_package_balance(
  p_phone text,
  p_amount numeric,
  p_reason text,
  p_source_type text,
  p_source_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $credit_customer_package_balance$
declare
  wallet_id bigint;
  normalized_phone text := public.normalize_customer_phone(p_phone);
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_admin() then
    raise exception 'not_authorized';
  end if;

  if normalized_phone !~ '^05[0-9]{8}$' then
    raise exception 'invalid_customer_phone';
  end if;

  wallet_id := public.find_reward_wallet(normalized_phone);

  if wallet_id is null then
    insert into public.wallets (phone, points_balance, reward_points_balance, store_credit_balance)
    values (normalized_phone, 0, 0, 0)
    returning id into wallet_id;
  end if;

  return public.credit_package_balance(
    wallet_id,
    p_amount,
    p_reason,
    p_source_type,
    p_source_id
  );
end;
$credit_customer_package_balance$;

create or replace function public.convert_print_order_excess_to_package_balance(
  p_order_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $convert_print_excess$
declare
  print_order public.orders%rowtype;
  wallet_id bigint;
  cash_due numeric(12, 2);
  excess_amount numeric(12, 2);
  credit_result jsonb;
  payment_row public.order_payments%rowtype;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_admin() then
    raise exception 'not_authorized';
  end if;

  select *
  into print_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'order_not_found';
  end if;

  select tx.wallet_id
  into wallet_id
  from public.wallet_transactions tx
  where tx.type = 'package_charge'
    and tx.reward_source_type = 'print_order_excess'
    and tx.reward_source_id = p_order_id
  limit 1;

  if found then
    return jsonb_build_object(
      'alreadyCredited', true,
      'amount', 0,
      'cashPaid', round(coalesce(print_order.deposit, 0), 2),
      'walletId', wallet_id
    );
  end if;

  cash_due := greatest(
    0,
    round(coalesce(print_order.total_amount, 0) - coalesce(print_order.points_used_amount, 0), 2)
  );
  excess_amount := greatest(0, round(coalesce(print_order.deposit, 0) - cash_due, 2));

  if excess_amount <= 0 then
    raise exception 'order_has_no_excess_payment';
  end if;

  wallet_id := public.find_reward_wallet(print_order.phone);

  if wallet_id is null then
    insert into public.wallets (phone, points_balance, reward_points_balance, store_credit_balance)
    values (public.normalize_customer_phone(print_order.phone), 0, 0, 0)
    returning id into wallet_id;
  end if;

  credit_result := public.credit_package_balance(
    wallet_id,
    excess_amount,
    'فائض دفعة طلب طباعة',
    'print_order_excess',
    p_order_id
  );

  insert into public.order_payments (order_id, amount, payment_date, note)
  values (p_order_id, -excess_amount, current_date, 'تحويل الفائض إلى رصيد الباقات')
  returning * into payment_row;

  update public.orders
  set deposit = cash_due,
      payment_status = 'paid'
  where id = p_order_id;

  return credit_result || jsonb_build_object(
    'amount', excess_amount,
    'cashPaid', cash_due,
    'payment', to_jsonb(payment_row)
  );
end;
$convert_print_excess$;

revoke all on function public.credit_package_balance(bigint, numeric, text, text, text) from public;
revoke all on function public.credit_customer_package_balance(text, numeric, text, text, text) from public;
revoke all on function public.convert_print_order_excess_to_package_balance(text) from public;
grant execute on function public.credit_package_balance(bigint, numeric, text, text, text) to authenticated, service_role;
grant execute on function public.credit_customer_package_balance(text, numeric, text, text, text) to authenticated, service_role;
grant execute on function public.convert_print_order_excess_to_package_balance(text) to authenticated, service_role;

-- Repair legacy cash adjustments that were moved into expiring reward points.
-- A row is eligible only when the original cash adjustment and migration lot
-- belong to the same wallet and have the exact same value.
do $repair_legacy_cash$
declare
  candidate record;
  transfer_points bigint;
  transfer_amount numeric(12, 2);
  matching_order_id text;
  matching_order_count integer;
  source_type text;
  source_id text;
begin
  -- SQL Editor sessions do not carry application JWT claims. The legacy
  -- order correction fires the reward trigger, whose protected helpers
  -- require an admin or service role. Keep this claim transaction-local.
  perform set_config('request.jwt.claim.role', 'service_role', true);
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);

  for candidate in
    select
      migration.id as migration_id,
      migration.wallet_id,
      migration.reward_points_remaining,
      coalesce(migration.reward_point_value, 0.01) as point_value,
      adjustment.id as adjustment_id,
      adjustment.created_at as adjustment_created_at,
      wallet.phone
    from public.wallet_transactions migration
    join lateral (
      select original.id, original.created_at
      from public.wallet_transactions original
      where original.wallet_id = migration.wallet_id
        and original.type = 'manual_adjustment'
        and round(original.amount_value, 2) = round(migration.amount_value, 2)
        and original.created_at < migration.created_at
      order by original.created_at desc, original.id desc
      limit 1
    ) adjustment on true
    join public.wallets wallet on wallet.id = migration.wallet_id
    where migration.type = 'reward_points_migration'
      and migration.reward_source_type = 'legacy_wallet'
      and migration.reward_points_remaining > 0
      and not exists (
        select 1
        from public.wallet_transactions repaired
        where repaired.type = 'package_charge'
          and repaired.reward_source_type = 'legacy_cash_adjustment'
          and repaired.reward_source_id = adjustment.id::text
      )
  loop
    transfer_points := candidate.reward_points_remaining;
    transfer_amount := round(transfer_points * candidate.point_value, 2);
    matching_order_id := null;

    select count(*), (array_agg(print_order.id order by print_order.created_at desc))[1]
    into matching_order_count, matching_order_id
    from public.orders print_order
    where public.normalize_customer_phone(print_order.phone)
          = public.normalize_customer_phone(candidate.phone)
      and print_order.created_at <= candidate.adjustment_created_at
      and round(
        coalesce(print_order.deposit, 0)
        - greatest(0, coalesce(print_order.total_amount, 0) - coalesce(print_order.points_used_amount, 0)),
        2
      ) = transfer_amount;

    if matching_order_count = 1 then
      source_type := 'print_order_excess';
      source_id := matching_order_id;
    else
      source_type := 'legacy_cash_adjustment';
      source_id := candidate.adjustment_id::text;
      matching_order_id := null;
    end if;

    if not exists (
      select 1
      from public.wallet_transactions existing
      where existing.type = 'package_charge'
        and existing.reward_source_type = source_type
        and existing.reward_source_id = source_id
    ) then
      insert into public.wallet_transactions (
        wallet_id,
        order_id,
        type,
        points,
        amount_value,
        reward_source_type,
        reward_source_id,
        reward_metadata,
        created_at
      ) values (
        candidate.wallet_id,
        matching_order_id,
        'package_charge',
        transfer_amount,
        transfer_amount,
        source_type,
        source_id,
        jsonb_build_object(
          'reason', 'تحويل رصيد نقدي قديم من النقاط إلى رصيد الباقات',
          'non_expiring', true,
          'legacy_adjustment_id', candidate.adjustment_id,
          'legacy_migration_id', candidate.migration_id
        ),
        now()
      );

      update public.wallet_transactions
      set reward_points_remaining = 0,
          reward_metadata = coalesce(reward_metadata, '{}'::jsonb)
            || jsonb_build_object('transferred_to_package_balance_at', now())
      where id = candidate.migration_id;

      insert into public.wallet_transactions (
        wallet_id,
        order_id,
        type,
        points,
        amount_value,
        reward_points_delta,
        reward_point_value,
        reward_source_type,
        reward_source_id,
        reward_metadata,
        created_at
      ) values (
        candidate.wallet_id,
        matching_order_id,
        'reward_points_adjustment',
        0,
        transfer_amount,
        -transfer_points,
        candidate.point_value,
        'package_balance_transfer',
        source_id,
        jsonb_build_object('reason', 'legacy_cash_balance_reclassified'),
        now()
      );

      update public.wallets
      set reward_points_balance = greatest(0, reward_points_balance - transfer_points),
          points_balance = round(greatest(0, reward_points_balance - transfer_points) * candidate.point_value, 2),
          reward_points_updated_at = now()
      where id = candidate.wallet_id;

      if matching_order_id is not null then
        insert into public.order_payments (order_id, amount, payment_date, note)
        values (matching_order_id, -transfer_amount, current_date, 'تحويل الفائض القديم إلى رصيد الباقات');

        update public.orders
        set deposit = greatest(0, round(deposit - transfer_amount, 2)),
            payment_status = 'paid'
        where id = matching_order_id;
      end if;
    end if;
  end loop;
end;
$repair_legacy_cash$;

commit;
