-- Admin review metadata for customer data deletion requests.
-- The customer request remains explicit, while admin review leaves an audit trail.

alter table public.customers
  add column if not exists data_deletion_reviewed_at timestamptz,
  add column if not exists data_deletion_review_note text;

create index if not exists customers_data_deletion_requested_idx
on public.customers (data_deletion_requested_at)
where data_deletion_requested_at is not null;
