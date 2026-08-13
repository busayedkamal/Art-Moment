-- Art Moment print builder product options.
-- Existing 4x6/A4 photo-paper pricing remains the source of truth.
-- Add and activate A5 or specialty-material rows only after their real prices are set.

begin;

create table if not exists public.print_variants (
  id uuid primary key default gen_random_uuid(),
  print_size text not null check (print_size in ('4x6', 'A5', 'A4')),
  material text not null check (material in ('photo_paper', 'magnetic', 'adhesive', 'mounted')),
  surface text not null default 'none' check (surface in ('none', 'glossy', 'matte')),
  border_style text not null default 'borderless' check (border_style in ('borderless', 'white_border')),
  pricing_mode text not null default 'fixed' check (pricing_mode in ('existing_4x6', 'existing_a4', 'fixed')),
  unit_price numeric(12,2),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint print_variants_fixed_price_check check (
    (pricing_mode = 'fixed' and unit_price is not null and unit_price >= 0)
    or (pricing_mode <> 'fixed' and unit_price is null)
  ),
  unique (print_size, material, surface, border_style)
);

alter table public.print_variants enable row level security;
revoke all on public.print_variants from anon, authenticated;
grant all on public.print_variants to authenticated;

drop policy if exists print_variants_admin_all on public.print_variants;
create policy print_variants_admin_all
  on public.print_variants for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

insert into public.print_variants
  (print_size, material, surface, border_style, pricing_mode, unit_price, is_active, sort_order)
values
  ('4x6', 'photo_paper', 'glossy', 'borderless', 'existing_4x6', null, true, 10),
  ('4x6', 'photo_paper', 'glossy', 'white_border', 'existing_4x6', null, true, 11),
  ('4x6', 'photo_paper', 'matte', 'borderless', 'existing_4x6', null, true, 12),
  ('4x6', 'photo_paper', 'matte', 'white_border', 'existing_4x6', null, true, 13),
  ('A4', 'photo_paper', 'glossy', 'borderless', 'existing_a4', null, true, 30),
  ('A4', 'photo_paper', 'glossy', 'white_border', 'existing_a4', null, true, 31),
  ('A4', 'photo_paper', 'matte', 'borderless', 'existing_a4', null, true, 32),
  ('A4', 'photo_paper', 'matte', 'white_border', 'existing_a4', null, true, 33)
on conflict (print_size, material, surface, border_style) do nothing;

alter table public.print_drafts
  drop constraint if exists print_drafts_print_size_check;

alter table public.print_drafts
  add constraint print_drafts_print_size_check
  check (print_size in ('4x6', 'A5', 'A4')),
  add column if not exists variant_id uuid references public.print_variants(id) on delete restrict,
  add column if not exists material text not null default 'photo_paper',
  add column if not exists surface text not null default 'glossy',
  add column if not exists border_style text not null default 'borderless',
  add column if not exists fit_mode text not null default 'fill',
  add column if not exists review_confirmed_at timestamptz;

alter table public.print_draft_files
  add column if not exists original_storage_path text;

update public.print_draft_files
set original_storage_path = storage_path
where original_storage_path is null;

create unique index if not exists print_draft_files_original_path_uidx
  on public.print_draft_files(original_storage_path)
  where original_storage_path is not null;

do $print_draft_option_checks$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'print_drafts_material_check'
      and conrelid = 'public.print_drafts'::regclass
  ) then
    alter table public.print_drafts add constraint print_drafts_material_check
      check (material in ('photo_paper', 'magnetic', 'adhesive', 'mounted'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'print_drafts_surface_check'
      and conrelid = 'public.print_drafts'::regclass
  ) then
    alter table public.print_drafts add constraint print_drafts_surface_check
      check (surface in ('none', 'glossy', 'matte'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'print_drafts_border_style_check'
      and conrelid = 'public.print_drafts'::regclass
  ) then
    alter table public.print_drafts add constraint print_drafts_border_style_check
      check (border_style in ('borderless', 'white_border'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'print_drafts_fit_mode_check'
      and conrelid = 'public.print_drafts'::regclass
  ) then
    alter table public.print_drafts add constraint print_drafts_fit_mode_check
      check (fit_mode in ('fill', 'fit'));
  end if;
end;
$print_draft_option_checks$;

update public.print_drafts
set
  material = 'photo_paper',
  surface = finish,
  border_style = 'borderless',
  fit_mode = coalesce((
    select f.crop ->> 'mode'
    from public.print_draft_files f
    where f.draft_id = print_drafts.id
    order by f.sort_order, f.created_at
    limit 1
  ), 'fill'),
  variant_id = (
    select variants.id
    from public.print_variants variants
    where variants.print_size = print_drafts.print_size
      and variants.material = 'photo_paper'
      and variants.surface = print_drafts.finish
      and variants.border_style = 'borderless'
    limit 1
  )
where print_drafts.variant_id is null;

create index if not exists print_variants_active_sort_idx
  on public.print_variants(is_active, sort_order, print_size);

commit;
