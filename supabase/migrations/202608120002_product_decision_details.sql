-- Rich product decision content for the storefront and search engines.

begin;

alter table public.products
  add column if not exists package_contents text,
  add column if not exists package_contents_en text,
  add column if not exists preparation_time text,
  add column if not exists preparation_time_en text,
  add column if not exists return_policy text,
  add column if not exists return_policy_en text,
  add column if not exists product_faqs jsonb not null default '[]'::jsonb,
  add column if not exists product_faqs_en jsonb not null default '[]'::jsonb,
  add column if not exists product_group_code text;

do $product_decision_checks$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'products_product_faqs_array_check'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
      add constraint products_product_faqs_array_check
      check (jsonb_typeof(product_faqs) = 'array');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'products_product_faqs_en_array_check'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
      add constraint products_product_faqs_en_array_check
      check (jsonb_typeof(product_faqs_en) = 'array');
  end if;
end;
$product_decision_checks$;

create index if not exists products_product_group_code_idx
  on public.products(product_group_code)
  where product_group_code is not null;

comment on column public.products.product_faqs is
  'Array of objects shaped as {question, answer} for the Arabic product page.';
comment on column public.products.product_group_code is
  'Stable family identifier used for ProductGroup structured data.';

commit;
