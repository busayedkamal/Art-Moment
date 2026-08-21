-- Product sharing funnel events for product-detail analytics.

begin;

alter table public.store_funnel_events
  drop constraint if exists store_funnel_events_event_name_check;

alter table public.store_funnel_events
  add constraint store_funnel_events_event_name_check
  check (
    event_name in (
      'store_visit', 'product_view', 'add_to_cart', 'cart_view',
      'login', 'checkout_started', 'order_created', 'payment_completed',
      'product_share_open', 'product_share_whatsapp',
      'product_share_telegram', 'product_share_email', 'product_share_copy'
    )
  );

create or replace function public.track_store_funnel_event(
  p_event_name text,
  p_anonymous_id text,
  p_session_id text default null,
  p_path text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $track_store_funnel_event$
begin
  if octet_length(coalesce(p_metadata, '{}'::jsonb)::text) > 5000 then
    raise exception 'metadata_too_large';
  end if;

  if p_event_name not in (
    'store_visit', 'product_view', 'add_to_cart', 'cart_view',
    'login', 'checkout_started', 'order_created', 'payment_completed',
    'product_share_open', 'product_share_whatsapp',
    'product_share_telegram', 'product_share_email', 'product_share_copy'
  ) then
    raise exception 'invalid_funnel_event';
  end if;

  if nullif(trim(coalesce(p_anonymous_id, '')), '') is null then
    raise exception 'invalid_anonymous_id';
  end if;

  if (
    select count(*)
    from public.store_funnel_events
    where anonymous_id = left(trim(p_anonymous_id), 100)
      and created_at >= now() - interval '1 hour'
  ) >= 300 then
    return;
  end if;

  insert into public.store_funnel_events (
    event_name, anonymous_id, session_id, path, metadata
  ) values (
    p_event_name,
    left(trim(p_anonymous_id), 100),
    left(nullif(trim(coalesce(p_session_id, '')), ''), 100),
    left(nullif(trim(coalesce(p_path, '')), ''), 500),
    coalesce(p_metadata, '{}'::jsonb)
  );
end;
$track_store_funnel_event$;

comment on constraint store_funnel_events_event_name_check on public.store_funnel_events is
  'Allow purchase-funnel and product-sharing events only.';

commit;