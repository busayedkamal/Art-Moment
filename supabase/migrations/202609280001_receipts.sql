-- Lightweight receipt system tied to the existing customer and order records.

begin;

create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  issue_request_id uuid not null default gen_random_uuid() unique,
  receipt_number text not null unique,
  customer_id uuid not null references public.customers(id) on delete restrict,
  order_type text,
  print_order_id text references public.orders(id) on delete set null,
  store_order_id uuid references public.store_orders(id) on delete set null,
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
    status <> 'cancelled' or cancelled_at is not null
  )
);

create index if not exists receipts_customer_created_idx
  on public.receipts (customer_id, created_at desc);
create index if not exists receipts_print_order_idx
  on public.receipts (print_order_id) where print_order_id is not null;
create index if not exists receipts_store_order_idx
  on public.receipts (store_order_id) where store_order_id is not null;
create index if not exists receipts_status_created_idx
  on public.receipts (status, created_at desc);

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
  new.updated_at := now();
  return new;
end;
$function$;

drop trigger if exists receipts_prepare on public.receipts;
create trigger receipts_prepare
before insert or update on public.receipts
for each row execute function public.prepare_receipt();

alter table public.receipts enable row level security;
revoke all on table public.receipts from anon, authenticated;
grant all on table public.receipts to service_role;
revoke all on function public.next_receipt_number() from public;
grant execute on function public.next_receipt_number() to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 10485760, array['application/pdf'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

alter table public.settings
  add column if not exists whatsapp_receipt_template text not null default 'receipt_issued';

commit;