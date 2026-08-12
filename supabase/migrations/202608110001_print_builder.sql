-- Art Moment print builder foundation.
-- Originals stay private and unchanged; crop and rotation are stored as print instructions.

begin;

create table if not exists public.print_drafts (
  id uuid primary key default gen_random_uuid(),
  access_token_hash text not null,
  status text not null default 'draft'
    check (status in ('draft', 'uploading', 'ready', 'ordered', 'cancelled', 'expired')),
  print_size text not null default '4x6' check (print_size in ('4x6', 'A4')),
  finish text not null default 'glossy' check (finish in ('glossy', 'matte')),
  default_copies integer not null default 1 check (default_copies between 1 and 999),
  file_count integer not null default 0 check (file_count >= 0),
  total_copies integer not null default 0 check (total_copies >= 0),
  unit_price numeric(12,2) not null default 0 check (unit_price >= 0),
  subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  customer_id uuid references public.customers(id) on delete set null,
  store_order_id uuid references public.store_orders(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.print_draft_files (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.print_drafts(id) on delete cascade,
  original_name text not null,
  storage_path text not null unique,
  preview_storage_path text unique,
  size_bytes bigint not null default 0 check (size_bytes >= 0),
  mime_type text not null,
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  copies integer not null default 1 check (copies between 1 and 999),
  rotation smallint not null default 0 check (rotation in (0, 90, 180, 270)),
  crop jsonb not null default '{"mode":"fit","zoom":1,"x":50,"y":50}'::jsonb,
  resolution_status text not null default 'unknown'
    check (resolution_status in ('unknown', 'good', 'low')),
  upload_status text not null default 'pending'
    check (upload_status in ('pending', 'uploaded', 'failed')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists print_drafts_status_expires_idx
  on public.print_drafts(status, expires_at);
create index if not exists print_draft_files_draft_sort_idx
  on public.print_draft_files(draft_id, sort_order, created_at);

alter table public.store_order_items
  alter column product_id drop not null,
  add column if not exists item_type text not null default 'product',
  add column if not exists item_name text,
  add column if not exists print_draft_id uuid references public.print_drafts(id) on delete set null,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

do $store_order_item_checks$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'store_order_items_item_type_check'
      and conrelid = 'public.store_order_items'::regclass
  ) then
    alter table public.store_order_items
      add constraint store_order_items_item_type_check
      check (item_type in ('product', 'print'));
  end if;
end;
$store_order_item_checks$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'print-originals',
  'print-originals',
  false,
  36700160,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('print-previews', 'print-previews', false, 2097152, array['image/webp', 'image/jpeg'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.print_drafts enable row level security;
alter table public.print_draft_files enable row level security;

revoke all on public.print_drafts, public.print_draft_files from anon, authenticated;
grant all on public.print_drafts, public.print_draft_files to authenticated;

drop policy if exists print_drafts_admin_all on public.print_drafts;
create policy print_drafts_admin_all
  on public.print_drafts for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists print_draft_files_admin_all on public.print_draft_files;
create policy print_draft_files_admin_all
  on public.print_draft_files for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists print_originals_admin_read on storage.objects;
create policy print_originals_admin_read
  on storage.objects for select to authenticated
  using (bucket_id = 'print-originals' and public.is_admin());

drop policy if exists print_originals_admin_delete on storage.objects;
create policy print_originals_admin_delete
  on storage.objects for delete to authenticated
  using (bucket_id = 'print-originals' and public.is_admin());

drop policy if exists print_previews_admin_read on storage.objects;
create policy print_previews_admin_read
  on storage.objects for select to authenticated
  using (bucket_id = 'print-previews' and public.is_admin());

drop policy if exists print_previews_admin_delete on storage.objects;
create policy print_previews_admin_delete
  on storage.objects for delete to authenticated
  using (bucket_id = 'print-previews' and public.is_admin());

commit;
