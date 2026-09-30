-- Lightweight receipt system tied to the existing customer and order records.

begin;

create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  issue_request_id uuid not null default gen_random_uuid() unique,
  receipt_number text not null unique,
  verification_code text,
  customer_id uuid not null references public.customers(id) on delete restrict,
  order_type text,
  order_reference text,
  print_order_id text references public.orders(id) on delete restrict,
  store_order_id uuid references public.store_orders(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'SAR',
  payment_method text not null,
  bank_name text,
  transfer_reference text,
  payment_date date not null default current_date,
  description text not null,
  notes text,
  status text not null default 'draft',
  pdf_path text,
  verification_token uuid not null default gen_random_uuid() unique,
  whatsapp_status text not null default 'not_sent',
  whatsapp_provider_id text,
  whatsapp_sent_at timestamptz,
  whatsapp_error text,
  issued_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint receipts_currency_check check (currency = 'SAR'),
  constraint receipts_payment_method_check check (payment_method in ('cash', 'bank_transfer')),
  constraint receipts_status_check check (status in ('draft', 'issued', 'cancelled')),
  constraint receipts_whatsapp_status_check check (whatsapp_status in ('not_sent', 'sent', 'failed')),
  constraint receipts_order_type_check check (order_type is null or order_type in ('print', 'store')),
  constraint receipts_order_link_check check (
    (order_type is null and print_order_id is null and store_order_id is null)
    or (order_type = 'print' and print_order_id is not null and store_order_id is null)
    or (order_type = 'store' and store_order_id is not null and print_order_id is null)
  ),
  constraint receipts_transfer_fields_check check (
    payment_method = 'bank_transfer'
    or (bank_name is null and transfer_reference is null)
  ),
  constraint receipts_issued_fields_check check (
    status = 'draft' or (issued_at is not null and pdf_path is not null)
  ),
  constraint receipts_cancelled_fields_check check (
    status <> 'cancelled'
    or (cancelled_at is not null and nullif(trim(cancellation_reason), '') is not null)
  )
);

-- Keep the migration safe if an earlier draft of the table was already applied.
alter table public.receipts
  add column if not exists verification_code text,
  add column if not exists order_reference text;

alter table public.receipts drop constraint if exists receipts_print_order_id_fkey;
alter table public.receipts
  add constraint receipts_print_order_id_fkey
  foreign key (print_order_id) references public.orders(id) on delete restrict;

alter table public.receipts drop constraint if exists receipts_store_order_id_fkey;
alter table public.receipts
  add constraint receipts_store_order_id_fkey
  foreign key (store_order_id) references public.store_orders(id) on delete restrict;

-- Rebuild constraints that may have been created by an earlier draft.
update public.receipts
set cancellation_reason = 'إلغاء سابق'
where status = 'cancelled' and nullif(trim(cancellation_reason), '') is null;

alter table public.receipts drop constraint if exists receipts_cancelled_fields_check;
alter table public.receipts
  add constraint receipts_cancelled_fields_check check (
    status <> 'cancelled'
    or (cancelled_at is not null and nullif(trim(cancellation_reason), '') is not null)
  );

update public.receipts as receipt
set order_reference = 'AM-' || upper(left(regexp_replace(print_order.id::text, '^AM-', '', 'i'), 12))
from public.orders as print_order
where receipt.order_type = 'print'
  and receipt.print_order_id = print_order.id
  and receipt.order_reference is null;

update public.receipts as receipt
set order_reference = 'AM-' || upper(left(regexp_replace(coalesce(store_order.short_id::text, store_order.id::text), '^AM-', '', 'i'), 12))
from public.store_orders as store_order
where receipt.order_type = 'store'
  and receipt.store_order_id = store_order.id
  and receipt.order_reference is null;
create index if not exists receipts_customer_created_idx
  on public.receipts (customer_id, created_at desc);
create index if not exists receipts_print_order_idx
  on public.receipts (print_order_id) where print_order_id is not null;
create index if not exists receipts_store_order_idx
  on public.receipts (store_order_id) where store_order_id is not null;
create index if not exists receipts_status_created_idx
  on public.receipts (status, created_at desc);

create or replace function public.generate_receipt_verification_code()
returns text
language plpgsql
security definer
set search_path = public
as $function$
declare
  candidate text;
  digest text;
begin
  loop
    digest := upper(md5(gen_random_uuid()::text));
    candidate := substr(digest, 1, 4) || '-' || substr(digest, 5, 4);
    exit when not exists (
      select 1 from public.receipts where verification_code = candidate
    );
  end loop;
  return candidate;
end;
$function$;

create or replace function public.next_receipt_number()
returns text
language plpgsql
security definer
set search_path = public
as $function$
declare
  receipt_year text := to_char(current_date, 'YYYY');
  next_value integer;
begin
  perform pg_advisory_xact_lock(hashtext('art-moment-receipts-' || receipt_year));
  select coalesce(max(substring(receipt_number from 9)::integer), 0) + 1
    into next_value
  from public.receipts
  where receipt_number like 'RC-' || receipt_year || '-%';
  return 'RC-' || receipt_year || '-' || lpad(next_value::text, 5, '0');
end;
$function$;

create or replace function public.prepare_receipt()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  if new.receipt_number is null or trim(new.receipt_number) = '' then
    new.receipt_number := public.next_receipt_number();
  end if;
  if new.verification_code is null or trim(new.verification_code) = '' then
    new.verification_code := public.generate_receipt_verification_code();
  end if;
  new.updated_at := now();
  return new;
end;
$function$;

create or replace function public.validate_receipt_order_customer()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  if new.order_type = 'print' then
    if not exists (
      select 1 from public.orders
      where id = new.print_order_id and customer_id = new.customer_id
    ) then
      raise exception 'receipt_order_customer_mismatch';
    end if;
  elsif new.order_type = 'store' then
    if not exists (
      select 1 from public.store_orders
      where id = new.store_order_id and customer_id = new.customer_id
    ) then
      raise exception 'receipt_order_customer_mismatch';
    end if;
  end if;
  return new;
end;
$function$;

create or replace function public.guard_receipt_immutability()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  if tg_op = 'DELETE' then
    raise exception 'receipt_deletion_not_allowed';
  end if;

  if old.status = 'draft' and new.status not in ('draft', 'issued') then
    raise exception 'invalid_receipt_status_transition';
  elsif old.status = 'issued' and new.status not in ('issued', 'cancelled') then
    raise exception 'invalid_receipt_status_transition';
  elsif old.status = 'cancelled' and new.status <> 'cancelled' then
    raise exception 'cancelled_receipt_is_immutable';
  end if;

  if old.status in ('issued', 'cancelled') and row(
    old.issue_request_id, old.receipt_number, old.verification_code,
    old.customer_id, old.order_type, old.order_reference,
    old.print_order_id, old.store_order_id,
    old.amount, old.currency, old.payment_method, old.bank_name,
    old.transfer_reference, old.payment_date, old.description, old.notes,
    old.pdf_path, old.verification_token, old.issued_at,
    old.created_by, old.created_at
  ) is distinct from row(
    new.issue_request_id, new.receipt_number, new.verification_code,
    new.customer_id, new.order_type, new.order_reference,
    new.print_order_id, new.store_order_id,
    new.amount, new.currency, new.payment_method, new.bank_name,
    new.transfer_reference, new.payment_date, new.description, new.notes,
    new.pdf_path, new.verification_token, new.issued_at,
    new.created_by, new.created_at
  ) then
    raise exception 'issued_receipt_core_fields_are_immutable';
  end if;

  if old.status = 'issued' and new.status = 'issued'
     and row(old.cancelled_at, old.cancellation_reason)
       is distinct from row(new.cancelled_at, new.cancellation_reason) then
    raise exception 'receipt_cancellation_requires_cancelled_status';
  end if;

  if old.status = 'cancelled'
     and row(old.cancelled_at, old.cancellation_reason)
       is distinct from row(new.cancelled_at, new.cancellation_reason) then
    raise exception 'cancelled_receipt_is_immutable';
  end if;

  return new;
end;
$function$;

do $backfill$
declare
  receipt_row record;
begin
  for receipt_row in select id from public.receipts where verification_code is null loop
    update public.receipts
    set verification_code = public.generate_receipt_verification_code()
    where id = receipt_row.id;
  end loop;
end;
$backfill$;

alter table public.receipts alter column verification_code set not null;
create unique index if not exists receipts_verification_code_uidx
  on public.receipts (verification_code);
drop trigger if exists receipts_guard_immutability on public.receipts;
create trigger receipts_guard_immutability
before update or delete on public.receipts
for each row execute function public.guard_receipt_immutability();

drop trigger if exists receipts_prepare on public.receipts;
create trigger receipts_prepare
before insert or update on public.receipts
for each row execute function public.prepare_receipt();

drop trigger if exists receipts_validate_order_customer on public.receipts;
create trigger receipts_validate_order_customer
before insert or update of customer_id, order_type, print_order_id, store_order_id
on public.receipts
for each row execute function public.validate_receipt_order_customer();


alter table public.receipts enable row level security;
revoke all on table public.receipts from anon, authenticated;
grant all on table public.receipts to service_role;
revoke all on function public.next_receipt_number() from public;
revoke all on function public.generate_receipt_verification_code() from public;
grant execute on function public.next_receipt_number() to service_role;
grant execute on function public.generate_receipt_verification_code() to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 10485760, array['application/pdf'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

alter table public.settings
  add column if not exists whatsapp_receipt_template text not null default 'receipt_issued';

commit;