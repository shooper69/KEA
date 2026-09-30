-- Kea Production only (project ref laubnngplqvsxokbfski).
-- Daily performance for charts + future token calculation.

create table if not exists public.user_daily_stats (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  talk_seconds integer not null default 0,
  words_added integer not null default 0,
  words_removed integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

create index if not exists user_daily_stats_user_day_idx
  on public.user_daily_stats (user_id, day desc);

alter table public.user_daily_stats enable row level security;

drop policy if exists "user_daily_stats_own" on public.user_daily_stats;
create policy "user_daily_stats_own"
  on public.user_daily_stats
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on public.user_daily_stats to authenticated;
