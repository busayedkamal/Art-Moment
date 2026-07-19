-- Secure Telegram bot chat registry and webhook update deduplication.

begin;

create table if not exists public.telegram_bot_chats (
  id uuid primary key default gen_random_uuid(),
  chat_id bigint not null unique,
  telegram_user_id bigint,
  username text,
  display_name text,
  chat_type text,
  is_active boolean not null default false,
  last_command text,
  registered_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.telegram_bot_updates (
  update_id bigint primary key,
  chat_id bigint,
  update_type text not null default 'unknown',
  command text,
  attempt_count integer not null default 1,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error_message text
);

create index if not exists telegram_bot_chats_active_idx
on public.telegram_bot_chats (is_active, last_seen_at desc);

create index if not exists telegram_bot_updates_received_idx
on public.telegram_bot_updates (received_at desc);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'telegram_bot_updates_attempt_count_check'
  ) then
    alter table public.telegram_bot_updates
      add constraint telegram_bot_updates_attempt_count_check
      check (attempt_count between 1 and 20);
  end if;
end $$;

alter table public.telegram_bot_chats enable row level security;
alter table public.telegram_bot_updates enable row level security;

revoke all on public.telegram_bot_chats from anon, authenticated;
revoke all on public.telegram_bot_updates from anon, authenticated;
grant all on public.telegram_bot_chats to authenticated;
grant all on public.telegram_bot_updates to authenticated;

drop policy if exists telegram_bot_chats_admin_all on public.telegram_bot_chats;
create policy telegram_bot_chats_admin_all
on public.telegram_bot_chats
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists telegram_bot_updates_admin_all on public.telegram_bot_updates;
create policy telegram_bot_updates_admin_all
on public.telegram_bot_updates
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

comment on table public.telegram_bot_chats is
  'Telegram chats registered with the Art Moment operations bot. Only explicitly activated chats can read operational summaries.';

comment on table public.telegram_bot_updates is
  'Minimal Telegram webhook processing log used to prevent duplicate handling of retried updates.';

commit;
