-- Store payment lifecycle fields.
-- Keeps payment status explicit instead of deriving it only from amount_paid.

alter table public.store_orders
  add column if not exists payment_status text not null default 'pending_payment',
  add column if not exists payment_method text not null default 'bank_transfer',
  add column if not exists payment_reference text,
  add column if not exists payment_failed_reason text,
  add column if not exists refunded_amount numeric(10, 2) not null default 0,
  add column if not exists payment_updated_at timestamptz;

update public.store_orders
set payment_status = case
  when payment_status in ('paid', 'مدفوع', 'مدفوع بالكامل') then 'paid'
  when payment_status in ('unpaid', 'غير مدفوع') then 'pending_payment'
  when payment_status in ('partial', 'مدفوع جزئياً') then 'awaiting_review'
  when payment_status in (
    'pending_payment',
    'awaiting_review',
    'payment_failed',
    'partial_refund',
    'full_refund'
  ) then payment_status
  else 'pending_payment'
end;

update public.store_orders
set payment_method = case
  when payment_method in ('bank_transfer', 'cash_on_delivery', 'card', 'wallet', 'manual', 'other')
    then payment_method
  else 'bank_transfer'
end;

alter table public.store_orders
  alter column payment_status set default 'pending_payment',
  alter column payment_status set not null,
  alter column payment_method set default 'bank_transfer',
  alter column payment_method set not null,
  alter column refunded_amount set default 0,
  alter column refunded_amount set not null;

do $$
begin
  alter table public.store_orders
    add constraint store_orders_payment_status_check
    check (
      payment_status in (
        'pending_payment',
        'awaiting_review',
        'paid',
        'payment_failed',
        'partial_refund',
        'full_refund'
      )
    );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.store_orders
    add constraint store_orders_payment_method_check
    check (
      payment_method in (
        'bank_transfer',
        'cash_on_delivery',
        'card',
        'wallet',
        'manual',
        'other'
      )
    );
exception
  when duplicate_object then null;
end $$;

create index if not exists store_orders_payment_status_idx
on public.store_orders (payment_status);

update public.store_orders
set
  payment_status = case
    when refunded_amount >= greatest(0, coalesce(total_amount, 0) + coalesce(delivery_fee, 0))
      and coalesce(total_amount, 0) + coalesce(delivery_fee, 0) > 0
      then 'full_refund'
    when refunded_amount > 0
      then 'partial_refund'
    when coalesce(amount_paid, 0) >= coalesce(total_amount, 0) + coalesce(delivery_fee, 0)
      and coalesce(total_amount, 0) + coalesce(delivery_fee, 0) > 0
      then 'paid'
    when coalesce(amount_paid, 0) > 0
      then 'awaiting_review'
    else 'pending_payment'
  end,
  payment_updated_at = coalesce(payment_updated_at, now())
where payment_status = 'pending_payment';
