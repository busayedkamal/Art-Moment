-- Final Print Builder safeguards: explicit availability and immutable cart pricing.

begin;

alter table public.print_variants
  add column if not exists is_available boolean not null default true,
  add column if not exists updated_at timestamptz not null default now();

alter table public.print_variants
  drop constraint if exists print_variants_fixed_price_check;

update public.print_variants
set is_available = false,
    updated_at = now()
where pricing_mode = 'fixed'
  and coalesce(unit_price, 0) <= 0;

alter table public.print_variants
  add constraint print_variants_fixed_price_check
  check (
    pricing_mode <> 'fixed'
    or not (is_active and is_available)
    or (unit_price is not null and unit_price > 0)
  );

-- Keep unavailable combinations in the catalogue so the administration can
-- price and enable them later. They never become orderable without a price.
insert into public.print_variants
  (print_size, material, surface, border_style, pricing_mode, unit_price, is_active, is_available, sort_order)
values
  ('A5', 'photo_paper', 'glossy', 'borderless', 'fixed', null, true, false, 30),
  ('A5', 'photo_paper', 'glossy', 'white_border', 'fixed', null, true, false, 31),
  ('A5', 'photo_paper', 'matte', 'borderless', 'fixed', null, true, false, 32),
  ('A5', 'photo_paper', 'matte', 'white_border', 'fixed', null, true, false, 33),
  ('4x6', 'magnetic', 'none', 'borderless', 'fixed', null, true, false, 40),
  ('A5', 'magnetic', 'none', 'borderless', 'fixed', null, true, false, 41),
  ('A4', 'magnetic', 'none', 'borderless', 'fixed', null, true, false, 42),
  ('4x6', 'adhesive', 'none', 'borderless', 'fixed', null, true, false, 50),
  ('A5', 'adhesive', 'none', 'borderless', 'fixed', null, true, false, 51),
  ('A4', 'adhesive', 'none', 'borderless', 'fixed', null, true, false, 52),
  ('4x6', 'mounted', 'none', 'borderless', 'fixed', null, true, false, 60),
  ('A5', 'mounted', 'none', 'borderless', 'fixed', null, true, false, 61),
  ('A4', 'mounted', 'none', 'borderless', 'fixed', null, true, false, 62)
on conflict (print_size, material, surface, border_style) do nothing;

alter table public.print_drafts
  add column if not exists snapshot_unit_price numeric(12,2),
  add column if not exists snapshot_subtotal numeric(12,2),
  add column if not exists snapshot_total_copies integer,
  add column if not exists snapshot_at timestamptz;

update public.print_drafts
set snapshot_unit_price = unit_price,
    snapshot_subtotal = subtotal,
    snapshot_total_copies = total_copies,
    snapshot_at = coalesce(updated_at, created_at, now())
where status in ('ready', 'ordered')
  and snapshot_at is null;

create index if not exists print_variants_catalog_idx
  on public.print_variants(is_active, is_available, sort_order);

comment on column public.print_variants.is_available is
  'Operational availability. A variant is orderable only when active, available, and priced above zero.';
comment on column public.print_drafts.snapshot_at is
  'When set, the draft price and quantity are frozen for the cart and checkout.';

commit;
