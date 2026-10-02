begin;

alter table public.customers
  add column if not exists nickname text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'customers_nickname_length_check'
      and conrelid = 'public.customers'::regclass
  ) then
    alter table public.customers
      add constraint customers_nickname_length_check
      check (nickname is null or char_length(trim(nickname)) between 1 and 80);
  end if;
end $$;

create index if not exists customers_nickname_search_idx
  on public.customers (lower(nickname))
  where nickname is not null;

comment on column public.customers.nickname is
  'Optional internal customer nickname. The official name column remains the source for orders, receipts, invoices, and messages.';

commit;
