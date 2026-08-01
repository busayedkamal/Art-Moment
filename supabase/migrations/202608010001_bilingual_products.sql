-- Optional English catalog content. Arabic remains the canonical fallback.
alter table public.products
  add column if not exists name_en text,
  add column if not exists description_en text,
  add column if not exists specifications_en jsonb not null default '{}'::jsonb;

comment on column public.products.name_en is
  'Optional English product name shown when the storefront language is English.';
comment on column public.products.description_en is
  'Optional English product description shown when the storefront language is English.';
comment on column public.products.specifications_en is
  'Optional English product specifications keyed by their English labels.';
