-- Manual store orders created by the dashboard.
-- Customer matching, stock reservation, order creation, items, and audit logging
-- all run in one PostgreSQL transaction.

alter table public.customers
  add column if not exists account_origin text not null default 'self_signup',
  add column if not exists account_claimed_at timestamptz,
  add column if not exists marketing_consented_at timestamptz,
  add column if not exists marketing_consent_source text;

-- Dashboard-created customers may claim their account later and may initially
-- have only a WhatsApp number.
alter table public.customers
  alter column email drop not null,
  alter column password_hash drop not null;

update public.customers
set account_claimed_at = coalesce(account_claimed_at, created_at)
where password_hash is not null
  and account_claimed_at is null;

alter table public.store_orders
  add column if not exists order_source text not null default 'website',
  add column if not exists created_by_admin boolean not null default false,
  add column if not exists customer_email text,
  add column if not exists manual_discount_amount numeric(10, 2) not null default 0,
  add column if not exists manual_discount_reason text;

create index if not exists store_orders_order_source_idx
on public.store_orders (order_source, created_at desc);

create or replace function public.normalize_customer_phone(value text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when digits ~ '^009665[0-9]{8}$' then '0' || right(digits, 9)
    when digits ~ '^9665[0-9]{8}$' then '0' || right(digits, 9)
    when digits ~ '^05[0-9]{8}$' then digits
    when digits ~ '^5[0-9]{8}$' then '0' || digits
    else digits
  end
  from (
    select regexp_replace(coalesce(value, ''), '\D', '', 'g') as digits
  ) normalized;
$$;

create or replace function public.admin_create_store_order(
  p_customer jsonb,
  p_items jsonb,
  p_order jsonb,
  p_actor_user_id uuid default null,
  p_actor_email text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_customer_id uuid;
  phone_customer_id uuid;
  email_customer_id uuid;
  resolved_customer_id uuid;
  customer_was_created boolean := false;
  customer_name text := nullif(trim(coalesce(p_customer ->> 'name', '')), '');
  customer_email text := nullif(lower(trim(coalesce(p_customer ->> 'email', ''))), '');
  customer_phone text := public.normalize_customer_phone(p_customer ->> 'phone');
  preferred_contact text := lower(trim(coalesce(p_customer ->> 'preferred_contact_method', 'whatsapp')));
  marketing_consent boolean := coalesce((p_customer ->> 'marketing_opt_in')::boolean, false);
  save_address boolean := coalesce((p_customer ->> 'save_address')::boolean, false);
  order_source text := lower(trim(coalesce(p_order ->> 'source', 'whatsapp')));
  source_tag text;
  order_status text := lower(trim(coalesce(p_order ->> 'status', 'pending_verification')));
  payment_status text := lower(trim(coalesce(p_order ->> 'payment_status', 'pending_payment')));
  payment_method text := lower(trim(coalesce(p_order ->> 'payment_method', 'bank_transfer')));
  city_value text := nullif(trim(coalesce(p_order ->> 'city', '')), '');
  district_value text := nullif(trim(coalesce(p_order ->> 'district', '')), '');
  street_value text := nullif(trim(coalesce(p_order ->> 'street', '')), '');
  notes_value text := nullif(trim(coalesce(p_order ->> 'notes', '')), '');
  discount_reason text := nullif(trim(coalesce(p_order ->> 'manual_discount_reason', '')), '');
  delivery_fee_value numeric(10, 2) := greatest(0, coalesce(nullif(p_order ->> 'delivery_fee', '')::numeric, 0));
  manual_discount_value numeric(10, 2) := greatest(0, coalesce(nullif(p_order ->> 'manual_discount_amount', '')::numeric, 0));
  amount_paid_value numeric(10, 2) := greatest(0, coalesce(nullif(p_order ->> 'amount_paid', '')::numeric, 0));
  subtotal_value numeric(10, 2) := 0;
  total_amount_value numeric(10, 2) := 0;
  grand_total_value numeric(10, 2) := 0;
  order_items jsonb := '[]'::jsonb;
  order_item record;
  product_row record;
  created_order public.store_orders%rowtype;
  customer_row public.customers%rowtype;
  address_value jsonb;
  tracking_pin text;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_admin() then
    raise exception 'not_authorized';
  end if;

  if jsonb_typeof(p_customer) <> 'object'
     or jsonb_typeof(p_order) <> 'object'
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception 'invalid_manual_order';
  end if;

  if customer_phone !~ '^05[0-9]{8}$' then
    raise exception 'invalid_phone';
  end if;

  if customer_email is not null
     and customer_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'invalid_email';
  end if;

  if preferred_contact not in ('whatsapp', 'email', 'phone', 'sms') then
    preferred_contact := 'whatsapp';
  end if;

  if order_source not in ('whatsapp', 'phone', 'instagram', 'walk_in', 'other') then
    order_source := 'other';
  end if;

  if order_status not in ('pending_verification', 'confirmed') then
    raise exception 'invalid_order_status';
  end if;

  if payment_status not in ('pending_payment', 'awaiting_review', 'paid', 'payment_failed') then
    raise exception 'invalid_payment_status';
  end if;

  if payment_method not in ('bank_transfer', 'cash_on_delivery', 'card', 'wallet', 'manual', 'other') then
    payment_method := 'manual';
  end if;

  if manual_discount_value > 0 and discount_reason is null then
    raise exception 'discount_reason_required';
  end if;

  if nullif(p_customer ->> 'id', '') is not null then
    begin
      requested_customer_id := (p_customer ->> 'id')::uuid;
    exception when invalid_text_representation then
      raise exception 'invalid_customer_id';
    end;
  end if;

  -- Prevent two dashboard submissions from creating duplicate customers.
  perform pg_advisory_xact_lock(hashtextextended(customer_phone || '|' || coalesce(customer_email, ''), 0));

  select id
    into phone_customer_id
  from public.customers
  where public.normalize_customer_phone(phone) = customer_phone
  order by created_at desc
  limit 1;

  if customer_email is not null then
    select id
      into email_customer_id
    from public.customers
    where lower(email) = customer_email
    order by created_at desc
    limit 1;
  end if;

  if requested_customer_id is not null then
    select *
      into customer_row
    from public.customers
    where id = requested_customer_id
    for update;

    if not found then
      raise exception 'customer_not_found';
    end if;

    if phone_customer_id is not null and phone_customer_id <> requested_customer_id then
      raise exception 'customer_phone_exists';
    end if;

    if email_customer_id is not null and email_customer_id <> requested_customer_id then
      raise exception 'customer_email_exists';
    end if;

    resolved_customer_id := requested_customer_id;
  else
    if phone_customer_id is not null
       and email_customer_id is not null
       and phone_customer_id <> email_customer_id then
      raise exception 'customer_identity_conflict';
    end if;

    resolved_customer_id := coalesce(phone_customer_id, email_customer_id);
    if resolved_customer_id is not null then
      select *
        into customer_row
      from public.customers
      where id = resolved_customer_id
      for update;
    end if;
  end if;

  if customer_name is null then
    customer_name := nullif(trim(coalesce(customer_row.name, '')), '');
  end if;

  if customer_name is null then
    raise exception 'customer_name_required';
  end if;

  source_tag := case order_source
    when 'whatsapp' then 'واتساب'
    when 'phone' then 'اتصال'
    when 'instagram' then 'انستغرام'
    when 'walk_in' then 'زيارة'
    else 'طلب إداري'
  end;

  if save_address and (city_value is not null or district_value is not null or street_value is not null) then
    address_value := jsonb_build_object(
      'id', gen_random_uuid(),
      'label', 'عنوان طلب يدوي',
      'city', coalesce(city_value, ''),
      'district', coalesce(district_value, ''),
      'street', coalesce(street_value, ''),
      'notes', ''
    );
  end if;

  if resolved_customer_id is null then
    insert into public.customers (
      name,
      email,
      phone,
      password_hash,
      marketing_opt_in,
      marketing_consented_at,
      marketing_consent_source,
      preferred_contact_method,
      saved_addresses,
      account_origin,
      admin_status,
      admin_tags
    ) values (
      customer_name,
      customer_email,
      customer_phone,
      null,
      marketing_consent,
      case when marketing_consent then now() else null end,
      case when marketing_consent then 'admin_' || order_source else null end,
      preferred_contact,
      case when address_value is null then '[]'::jsonb else jsonb_build_array(address_value) end,
      'admin_' || order_source,
      'active',
      array['طلب يدوي', source_tag]
    )
    returning * into customer_row;

    resolved_customer_id := customer_row.id;
    customer_was_created := true;
  else
    update public.customers
    set
      name = customer_name,
      email = coalesce(customer_email, email),
      phone = customer_phone,
      preferred_contact_method = preferred_contact,
      marketing_opt_in = coalesce(marketing_opt_in, false) or marketing_consent,
      marketing_consented_at = case
        when marketing_consent and not coalesce(marketing_opt_in, false) then now()
        else marketing_consented_at
      end,
      marketing_consent_source = case
        when marketing_consent and not coalesce(marketing_opt_in, false) then 'admin_' || order_source
        else marketing_consent_source
      end,
      saved_addresses = case
        when address_value is null then coalesce(saved_addresses, '[]'::jsonb)
        else coalesce(saved_addresses, '[]'::jsonb) || jsonb_build_array(address_value)
      end,
      admin_tags = array(
        select distinct tag
        from unnest(coalesce(admin_tags, '{}'::text[]) || array['طلب يدوي', source_tag]) as tag
        where nullif(trim(tag), '') is not null
      ),
      profile_updated_at = now()
    where id = resolved_customer_id
    returning * into customer_row;
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_items) as item(product_id integer, quantity integer)
    where item.product_id is null or item.quantity is null or item.quantity < 1 or item.quantity > 999
  ) then
    raise exception 'invalid_order_items';
  end if;

  for order_item in
    select item.product_id, sum(item.quantity)::integer as quantity
    from jsonb_to_recordset(p_items) as item(product_id integer, quantity integer)
    group by item.product_id
    order by item.product_id
  loop
    select id, name, price, stock_quantity, in_stock
      into product_row
    from public.products
    where id = order_item.product_id
    for update;

    if not found or product_row.in_stock is false then
      raise exception 'product_unavailable';
    end if;

    if product_row.stock_quantity is not null and product_row.stock_quantity < order_item.quantity then
      raise exception 'product_out_of_stock';
    end if;

    subtotal_value := subtotal_value + round((coalesce(product_row.price, 0) * order_item.quantity)::numeric, 2);
    order_items := order_items || jsonb_build_array(jsonb_build_object(
      'product_id', product_row.id,
      'product_name', product_row.name,
      'quantity', order_item.quantity,
      'price_at_time', round(coalesce(product_row.price, 0)::numeric, 2)
    ));

    if product_row.stock_quantity is not null then
      update public.products
      set
        stock_quantity = stock_quantity - order_item.quantity,
        in_stock = case when stock_quantity - order_item.quantity <= 0 then false else in_stock end
      where id = product_row.id;
    end if;
  end loop;

  subtotal_value := round(subtotal_value, 2);
  if manual_discount_value > subtotal_value then
    raise exception 'discount_exceeds_subtotal';
  end if;

  total_amount_value := round(greatest(0, subtotal_value - manual_discount_value), 2);
  grand_total_value := round(total_amount_value + delivery_fee_value, 2);

  if payment_status = 'paid' then
    amount_paid_value := grand_total_value;
  elsif amount_paid_value > grand_total_value then
    raise exception 'amount_paid_exceeds_total';
  elsif grand_total_value > 0 and amount_paid_value >= grand_total_value then
    payment_status := 'paid';
  end if;

  insert into public.store_orders (
    customer_id,
    customer_name,
    customer_email,
    phone,
    subtotal_amount,
    discount_amount,
    manual_discount_amount,
    manual_discount_reason,
    coupon_code,
    total_amount,
    delivery_fee,
    amount_paid,
    payment_status,
    payment_method,
    refunded_amount,
    payment_updated_at,
    status,
    notes,
    city,
    district,
    street,
    order_source,
    created_by_admin
  ) values (
    resolved_customer_id,
    customer_row.name,
    customer_row.email,
    customer_phone,
    subtotal_value,
    manual_discount_value,
    manual_discount_value,
    discount_reason,
    null,
    total_amount_value,
    delivery_fee_value,
    amount_paid_value,
    payment_status,
    payment_method,
    0,
    now(),
    order_status,
    notes_value,
    city_value,
    district_value,
    street_value,
    order_source,
    true
  )
  returning * into created_order;

  insert into public.store_order_items (store_order_id, product_id, quantity, price_at_time)
  select
    created_order.id,
    item.product_id,
    item.quantity,
    item.price_at_time
  from jsonb_to_recordset(order_items) as item(
    product_id integer,
    product_name text,
    quantity integer,
    price_at_time numeric
  );

  select subscription_code
    into tracking_pin
  from public.wallets
  where public.normalize_customer_phone(phone) = customer_phone
  order by created_at desc nulls last
  limit 1;

  if tracking_pin is null then
    tracking_pin := (1000 + floor(random() * 9000))::integer::text;
    insert into public.wallets (phone, subscription_code, points_balance, total_spent)
    values (customer_phone, tracking_pin, 0, 0);
  end if;

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
    p_actor_user_id,
    nullif(lower(trim(coalesce(p_actor_email, ''))), ''),
    'manual_store_order_created',
    'store_order',
    created_order.id::text,
    'طلب متجر يدوي #' || coalesce(created_order.short_id, left(created_order.id::text, 6)),
    jsonb_build_object(
      'customer_id', resolved_customer_id,
      'status', created_order.status,
      'payment_status', created_order.payment_status,
      'subtotal_amount', subtotal_value,
      'discount_amount', manual_discount_value,
      'delivery_fee', delivery_fee_value,
      'total_amount', grand_total_value,
      'source', order_source
    ),
    jsonb_build_object(
      'customer_created', customer_was_created,
      'items_count', jsonb_array_length(order_items),
      'marketing_consent_recorded', marketing_consent
    )
  );

  return jsonb_build_object(
    'order', jsonb_build_object(
      'id', created_order.id,
      'short_id', created_order.short_id,
      'status', created_order.status,
      'payment_status', created_order.payment_status,
      'subtotal_amount', subtotal_value,
      'discount_amount', manual_discount_value,
      'delivery_fee', delivery_fee_value,
      'total_amount', grand_total_value,
      'source', order_source
    ),
    'customer', jsonb_build_object(
      'id', customer_row.id,
      'name', customer_row.name,
      'email', customer_row.email,
      'phone', customer_row.phone,
      'created', customer_was_created
    ),
    'items', order_items,
    'customer_pin', tracking_pin
  );
end;
$$;

revoke all on function public.normalize_customer_phone(text) from public;
revoke all on function public.admin_create_store_order(jsonb, jsonb, jsonb, uuid, text) from public;

grant execute on function public.admin_create_store_order(jsonb, jsonb, jsonb, uuid, text)
to authenticated, service_role;
