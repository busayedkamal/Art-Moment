-- Art Moment "Friendship Code" referral program.
-- Existing customers share their unique subscription_code. A genuinely new
-- printing customer may use it once, awarding the referrer 200 reward points.

begin;

alter table public.settings
  add column if not exists friendship_program_enabled boolean not null default true,
  add column if not exists friendship_referrer_bonus_points integer not null default 200,
  add column if not exists friendship_welcome_coupon_code text not null default 'WELCOME';

update public.settings
set friendship_program_enabled = true,
    friendship_referrer_bonus_points = 200,
    friendship_welcome_coupon_code = 'WELCOME'
where id = 1;

insert into public.coupons (code, discount_type, discount_amount, is_active)
select 'WELCOME', 'percent', 5, true
where not exists (
  select 1
  from public.coupons coupon
  where upper(trim(coupon.code)) = 'WELCOME'
);

update public.coupons
set discount_type = 'percent',
    discount_amount = 5,
    is_active = true
where upper(trim(code)) = 'WELCOME';

alter table public.orders
  add column if not exists customer_id uuid references public.customers(id) on delete set null,
  add column if not exists friendship_code text;

alter table public.wallets
  add column if not exists customer_id uuid references public.customers(id) on delete set null;

create or replace function public.friendship_normalize_phone(raw_phone text)
returns text
language sql
immutable
set search_path = public
as $friendship_normalize_phone$
  select case
    when digits ~ '^009665[0-9]{8}$' then '0' || right(digits, 9)
    when digits ~ '^9665[0-9]{8}$' then '0' || right(digits, 9)
    when digits ~ '^05[0-9]{8}$' then digits
    when digits ~ '^5[0-9]{8}$' then '0' || digits
    else digits
  end
  from (
    select regexp_replace(coalesce(raw_phone, ''), '\D', '', 'g') as digits
  ) normalized;
$friendship_normalize_phone$;

-- Connect legacy wallets to their canonical customer before assigning codes.
update public.wallets wallet
set customer_id = (
  select customer.id
  from public.customers customer
  where public.friendship_normalize_phone(customer.phone)
    = public.friendship_normalize_phone(wallet.phone)
  order by customer.created_at asc nulls last, customer.id
  limit 1
)
where wallet.customer_id is null
  and public.friendship_normalize_phone(wallet.phone) ~ '^05[0-9]{8}$';

-- Keep one canonical wallet per customer. The wallet with the largest reward
-- balance keeps its existing subscription code.
with ranked_wallets as (
  select
    wallet.id,
    row_number() over (
      partition by wallet.customer_id
      order by
        coalesce(wallet.reward_points_balance, 0) desc,
        coalesce(wallet.points_balance, 0) desc,
        wallet.id desc
    ) as wallet_rank
  from public.wallets wallet
  where wallet.customer_id is not null
)
update public.wallets wallet
set subscription_code = null
from ranked_wallets ranked
where wallet.id = ranked.id
  and ranked.wallet_rank > 1
  and wallet.subscription_code is not null;

-- Resolve the unlikely case where the same code belongs to two customers.
with duplicated_codes as (
  select
    wallet.id,
    row_number() over (
      partition by wallet.subscription_code
      order by wallet.id
    ) as code_rank
  from public.wallets wallet
  where wallet.customer_id is not null
    and wallet.subscription_code is not null
)
update public.wallets wallet
set subscription_code = null
from duplicated_codes duplicated
where wallet.id = duplicated.id
  and duplicated.code_rank > 1;

create unique index if not exists wallets_customer_subscription_code_unique_idx
on public.wallets (subscription_code)
where customer_id is not null
  and subscription_code is not null;

create or replace function public.generate_friendship_subscription_code()
returns text
language plpgsql
volatile
security definer
set search_path = public
as $generate_friendship_code$
declare
  candidate text;
  attempts integer := 0;
begin
  loop
    attempts := attempts + 1;
    candidate := (1000 + floor(random() * 9000))::integer::text;

    exit when not exists (
      select 1
      from public.wallets wallet
      where wallet.subscription_code = candidate
        and wallet.customer_id is not null
    );

    if attempts >= 100 then
      raise exception 'friendship_code_generation_failed';
    end if;
  end loop;

  return candidate;
end;
$generate_friendship_code$;

-- Every canonical customer receives a wallet and one shareable code.
insert into public.wallets (phone, customer_id, subscription_code)
select
  public.friendship_normalize_phone(customer.phone),
  customer.id,
  public.generate_friendship_subscription_code()
from public.customers customer
where public.friendship_normalize_phone(customer.phone) ~ '^05[0-9]{8}$'
  and not exists (
    select 1
    from public.wallets wallet
    where wallet.customer_id = customer.id
  );

do $fill_friendship_codes$
declare
  wallet_row record;
begin
  for wallet_row in
    select wallet.id
    from public.wallets wallet
    where wallet.customer_id is not null
      and wallet.subscription_code is null
      and wallet.id = (
        select preferred.id
        from public.wallets preferred
        where preferred.customer_id = wallet.customer_id
        order by
          coalesce(preferred.reward_points_balance, 0) desc,
          coalesce(preferred.points_balance, 0) desc,
          preferred.id desc
        limit 1
      )
    order by wallet.id
  loop
    update public.wallets
    set subscription_code = public.generate_friendship_subscription_code()
    where id = wallet_row.id;
  end loop;
end;
$fill_friendship_codes$;

create or replace function public.ensure_customer_friendship_wallet()
returns trigger
language plpgsql
security definer
set search_path = public
as $ensure_friendship_wallet$
declare
  normalized_phone text;
  resolved_wallet_id bigint;
begin
  normalized_phone := public.friendship_normalize_phone(new.phone);
  if normalized_phone !~ '^05[0-9]{8}$' then
    return new;
  end if;

  select wallet.id
  into resolved_wallet_id
  from public.wallets wallet
  where wallet.customer_id = new.id
  order by
    coalesce(wallet.reward_points_balance, 0) desc,
    coalesce(wallet.points_balance, 0) desc,
    wallet.id desc
  limit 1;

  if resolved_wallet_id is null then
    select wallet.id
    into resolved_wallet_id
    from public.wallets wallet
    where wallet.customer_id is null
      and public.friendship_normalize_phone(wallet.phone) = normalized_phone
    order by wallet.id desc
    limit 1
    for update;
  end if;

  if resolved_wallet_id is null then
    insert into public.wallets (
      phone,
      customer_id,
      subscription_code,
      points_balance,
      reward_points_balance,
      total_spent,
      store_credit_balance
    )
    values (
      normalized_phone,
      new.id,
      public.generate_friendship_subscription_code(),
      0,
      0,
      0,
      0
    )
    returning id into resolved_wallet_id;
  else
    update public.wallets
    set customer_id = new.id,
        subscription_code = coalesce(
          subscription_code,
          public.generate_friendship_subscription_code()
        )
    where id = resolved_wallet_id;
  end if;

  return new;
end;
$ensure_friendship_wallet$;

drop trigger if exists customers_ensure_friendship_wallet on public.customers;
create trigger customers_ensure_friendship_wallet
after insert or update of phone
on public.customers
for each row
execute function public.ensure_customer_friendship_wallet();

create or replace function public.get_or_create_friendship_code(
  p_phone text,
  p_customer_name text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $get_friendship_code$
declare
  normalized_phone text;
  resolved_customer_id uuid;
  resolved_wallet_id bigint;
  resolved_code text;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_admin() then
    raise exception 'not_authorized';
  end if;

  normalized_phone := public.friendship_normalize_phone(p_phone);
  if normalized_phone !~ '^05[0-9]{8}$' then
    raise exception 'invalid_phone';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('friendship-code:' || normalized_phone, 0)
  );

  select customer.id
  into resolved_customer_id
  from public.customers customer
  where public.friendship_normalize_phone(customer.phone) = normalized_phone
  order by customer.created_at asc nulls last, customer.id
  limit 1;

  if resolved_customer_id is null then
    insert into public.customers (
      name,
      phone,
      email,
      password_hash,
      marketing_opt_in,
      preferred_contact_method,
      saved_addresses,
      account_origin,
      admin_status,
      admin_tags
    ) values (
      coalesce(nullif(trim(p_customer_name), ''), 'عميل طباعة'),
      normalized_phone,
      null,
      null,
      false,
      'whatsapp',
      '[]'::jsonb,
      'legacy_printing',
      'active',
      array['عميل طباعة']::text[]
    )
    returning id into resolved_customer_id;
  end if;

  select wallet.id, wallet.subscription_code
  into resolved_wallet_id, resolved_code
  from public.wallets wallet
  where wallet.customer_id = resolved_customer_id
  order by
    coalesce(wallet.reward_points_balance, 0) desc,
    coalesce(wallet.points_balance, 0) desc,
    wallet.id desc
  limit 1
  for update;

  if resolved_wallet_id is null then
    insert into public.wallets (
      phone,
      customer_id,
      subscription_code,
      points_balance,
      reward_points_balance,
      total_spent,
      store_credit_balance
    ) values (
      normalized_phone,
      resolved_customer_id,
      public.generate_friendship_subscription_code(),
      0,
      0,
      0,
      0
    )
    returning id, subscription_code into resolved_wallet_id, resolved_code;
  elsif resolved_code is null then
    resolved_code := public.generate_friendship_subscription_code();
    update public.wallets
    set subscription_code = resolved_code
    where id = resolved_wallet_id;
  end if;

  return resolved_code;
end;
$get_friendship_code$;

create table if not exists public.friendship_referrals (
  id uuid primary key default gen_random_uuid(),
  friendship_code text not null,
  referrer_customer_id uuid not null references public.customers(id) on delete restrict,
  referrer_wallet_id bigint not null references public.wallets(id) on delete restrict,
  invited_customer_id uuid references public.customers(id) on delete set null,
  invited_phone text not null,
  source_order_id text not null,
  bonus_points bigint not null default 200,
  reward_expires_at timestamptz,
  status text not null default 'awarded',
  created_at timestamptz not null default now(),
  constraint friendship_referrals_bonus_check check (bonus_points > 0),
  constraint friendship_referrals_status_check check (status in ('awarded', 'reversed'))
);

create unique index if not exists friendship_referrals_invited_phone_unique_idx
on public.friendship_referrals (invited_phone);

create unique index if not exists friendship_referrals_source_order_unique_idx
on public.friendship_referrals (source_order_id);

create index if not exists friendship_referrals_referrer_idx
on public.friendship_referrals (referrer_customer_id, created_at desc);

alter table public.friendship_referrals enable row level security;
revoke all on public.friendship_referrals from anon, authenticated;
grant all on public.friendship_referrals to authenticated;

drop policy if exists friendship_referrals_admin_all on public.friendship_referrals;
create policy friendship_referrals_admin_all
on public.friendship_referrals
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

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
      'reward_friendship_bonus',
      'store_credit_adjustment'
    )
  );

create or replace function public.check_friendship_referral_eligibility(p_phone text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $check_friendship_eligibility$
declare
  normalized_phone text;
  existing_record boolean := false;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_admin() then
    raise exception 'not_authorized';
  end if;

  normalized_phone := public.friendship_normalize_phone(p_phone);
  if normalized_phone !~ '^05[0-9]{8}$' then
    return jsonb_build_object('eligible', false, 'reason', 'invalid_phone');
  end if;

  select (
    exists (
      select 1 from public.customers customer
      where public.friendship_normalize_phone(customer.phone) = normalized_phone
    )
    or exists (
      select 1 from public.wallets wallet
      where public.friendship_normalize_phone(wallet.phone) = normalized_phone
    )
    or exists (
      select 1 from public.orders print_order
      where public.friendship_normalize_phone(print_order.phone) = normalized_phone
    )
    or exists (
      select 1 from public.store_orders store_order
      where public.friendship_normalize_phone(store_order.phone) = normalized_phone
    )
    or exists (
      select 1 from public.friendship_referrals referral
      where referral.invited_phone = normalized_phone
    )
  ) into existing_record;

  return jsonb_build_object(
    'eligible', not existing_record,
    'reason', case when existing_record then 'existing_customer' else 'new_customer' end
  );
end;
$check_friendship_eligibility$;

create or replace function public.apply_friendship_referral_to_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $apply_friendship_referral$
declare
  normalized_code text;
  normalized_invited_phone text;
  referrer_wallet public.wallets%rowtype;
  referrer_customer public.customers%rowtype;
  program_rules record;
  referral_id uuid;
  bonus_points bigint;
  point_value numeric(10, 4);
  expiry_at timestamptz;
  existed_before boolean := false;
begin
  normalized_code := trim(coalesce(new.friendship_code, ''));
  if normalized_code = '' then
    return new;
  end if;

  if normalized_code !~ '^[0-9]{4}$' then
    raise exception 'invalid_friendship_code';
  end if;

  normalized_invited_phone := public.friendship_normalize_phone(new.phone);
  if normalized_invited_phone !~ '^05[0-9]{8}$' then
    raise exception 'invalid_friendship_invited_phone';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('friendship:' || normalized_invited_phone, 0)
  );

  select
    coalesce(settings.friendship_program_enabled, true) as enabled,
    coalesce(settings.friendship_referrer_bonus_points, 200) as bonus,
    coalesce(settings.reward_point_value, 0.01) as point_value,
    coalesce(settings.reward_expiry_months, 4) as expiry_months
  into program_rules
  from public.settings settings
  where settings.id = 1;

  if not coalesce(program_rules.enabled, true) then
    raise exception 'friendship_program_disabled';
  end if;

  select wallet.*
  into referrer_wallet
  from public.wallets wallet
  where wallet.subscription_code = normalized_code
    and wallet.customer_id is not null
  limit 1
  for update;

  if not found then
    raise exception 'friendship_code_not_found';
  end if;

  select customer.*
  into referrer_customer
  from public.customers customer
  where customer.id = referrer_wallet.customer_id;

  if public.friendship_normalize_phone(referrer_wallet.phone) = normalized_invited_phone
     or public.friendship_normalize_phone(referrer_customer.phone) = normalized_invited_phone then
    raise exception 'friendship_self_referral_not_allowed';
  end if;

  select (
    exists (
      select 1
      from public.orders print_order
      where print_order.id <> new.id
        and public.friendship_normalize_phone(print_order.phone) = normalized_invited_phone
    )
    or exists (
      select 1
      from public.store_orders store_order
      where public.friendship_normalize_phone(store_order.phone) = normalized_invited_phone
    )
    or exists (
      select 1
      from public.customers customer
      where public.friendship_normalize_phone(customer.phone) = normalized_invited_phone
        and customer.created_at < new.created_at
    )
    or exists (
      select 1
      from public.wallets wallet
      where public.friendship_normalize_phone(wallet.phone) = normalized_invited_phone
        and wallet.created_at < new.created_at
    )
    or exists (
      select 1
      from public.friendship_referrals referral
      where referral.invited_phone = normalized_invited_phone
    )
  ) into existed_before;

  if existed_before then
    raise exception 'friendship_customer_not_new';
  end if;

  bonus_points := greatest(coalesce(program_rules.bonus, 200), 1);
  point_value := coalesce(program_rules.point_value, 0.01);
  expiry_at := now() + make_interval(months => coalesce(program_rules.expiry_months, 4));

  insert into public.friendship_referrals (
    friendship_code,
    referrer_customer_id,
    referrer_wallet_id,
    invited_customer_id,
    invited_phone,
    source_order_id,
    bonus_points,
    reward_expires_at
  ) values (
    normalized_code,
    referrer_customer.id,
    referrer_wallet.id,
    new.customer_id,
    normalized_invited_phone,
    new.id::text,
    bonus_points,
    expiry_at
  )
  returning id into referral_id;

  insert into public.wallet_transactions (
    wallet_id,
    order_id,
    type,
    points,
    amount_value,
    reward_points_delta,
    reward_points_remaining,
    reward_point_value,
    reward_expires_at,
    reward_source_type,
    reward_source_id,
    reward_metadata,
    created_at
  ) values (
    referrer_wallet.id,
    null,
    'reward_friendship_bonus',
    0,
    round(bonus_points * point_value, 2),
    bonus_points,
    bonus_points,
    point_value,
    expiry_at,
    'friendship_referral',
    referral_id::text,
    jsonb_build_object(
      'friendship_code', normalized_code,
      'invited_phone', normalized_invited_phone,
      'source_order_id', new.id::text,
      'description', 'مكافأة برنامج كود الصداقة'
    ),
    now()
  );

  update public.wallets
  set reward_points_balance = coalesce(reward_points_balance, 0) + bonus_points,
      points_balance = round(
        (coalesce(reward_points_balance, 0) + bonus_points) * point_value,
        2
      ),
      reward_points_updated_at = now()
  where id = referrer_wallet.id;

  insert into public.admin_activity_logs (
    actor_user_id,
    actor_email,
    action,
    entity_type,
    entity_id,
    entity_label,
    new_values,
    metadata
  ) values (
    auth.uid(),
    lower(coalesce(auth.jwt() ->> 'email', '')),
    'friendship_referral_awarded',
    'customer',
    referrer_customer.id::text,
    coalesce(referrer_customer.name, referrer_customer.phone),
    jsonb_build_object(
      'friendship_code', normalized_code,
      'bonus_points', bonus_points,
      'new_reward_points_balance', coalesce(referrer_wallet.reward_points_balance, 0) + bonus_points
    ),
    jsonb_build_object(
      'invited_phone', normalized_invited_phone,
      'source_order_id', new.id::text,
      'referral_id', referral_id
    )
  );

  return new;
end;
$apply_friendship_referral$;

drop trigger if exists orders_apply_friendship_referral on public.orders;
create trigger orders_apply_friendship_referral
after insert
on public.orders
for each row
when (new.friendship_code is not null and btrim(new.friendship_code) <> '')
execute function public.apply_friendship_referral_to_order();

revoke all on function public.friendship_normalize_phone(text) from public;
revoke all on function public.generate_friendship_subscription_code() from public;
revoke all on function public.get_or_create_friendship_code(text, text) from public;
revoke all on function public.check_friendship_referral_eligibility(text) from public;

grant execute on function public.get_or_create_friendship_code(text, text)
to authenticated, service_role;

grant execute on function public.check_friendship_referral_eligibility(text)
to authenticated, service_role;

commit;
