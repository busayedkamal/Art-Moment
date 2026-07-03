-- Admin audit trail.
-- Stores important dashboard actions without exposing the log publicly.

create table if not exists public.admin_activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid,
  actor_email text,
  action text not null,
  entity_type text not null,
  entity_id text,
  entity_label text,
  old_values jsonb not null default '{}'::jsonb,
  new_values jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'admin_activity_logs_action_check'
  ) then
    alter table public.admin_activity_logs
      add constraint admin_activity_logs_action_check
      check (char_length(action) between 2 and 120);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'admin_activity_logs_entity_type_check'
  ) then
    alter table public.admin_activity_logs
      add constraint admin_activity_logs_entity_type_check
      check (char_length(entity_type) between 2 and 120);
  end if;
end $$;

create index if not exists admin_activity_logs_actor_idx
on public.admin_activity_logs (actor_user_id, created_at desc);

create index if not exists admin_activity_logs_action_idx
on public.admin_activity_logs (action, created_at desc);

create index if not exists admin_activity_logs_entity_idx
on public.admin_activity_logs (entity_type, entity_id, created_at desc);

create index if not exists admin_activity_logs_created_at_idx
on public.admin_activity_logs (created_at desc);

alter table public.admin_activity_logs enable row level security;

revoke all on public.admin_activity_logs from anon, authenticated;
grant all on public.admin_activity_logs to authenticated;

drop policy if exists admin_activity_logs_admin_all on public.admin_activity_logs;
create policy admin_activity_logs_admin_all
on public.admin_activity_logs
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());
