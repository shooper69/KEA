-- Kea Production only (project ref laubnngplqvsxokbfski).
-- Auth + profiles + learn_list + conversation_topics. No billing.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text not null default '',
  native_language text,
  target_language text,
  preferred_voice text not null default 'luna',
  avatar_url text not null default '',
  listen_idle_seconds integer not null default 10,
  sky_theme text not null default 'clouds',
  chat_keep text not null default 'device',
  notify_memory boolean not null default true,
  notify_talk boolean not null default true,
  save_transcripts boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists preferred_voice text not null default 'luna';
alter table public.profiles add column if not exists avatar_url text not null default '';
alter table public.profiles add column if not exists native_language text;
alter table public.profiles add column if not exists target_language text;

create table if not exists public.learn_list (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  term text not null,
  translation text not null default '',
  language_code text not null,
  created_at timestamptz not null default now(),
  last_reviewed_at timestamptz not null default now(),
  practice_count integer not null default 0,
  status text not null default 'learning'
);

create unique index if not exists learn_list_user_term_idx
  on public.learn_list (user_id, language_code, lower(term));

create index if not exists learn_list_user_idx
  on public.learn_list (user_id, last_reviewed_at desc);

create table if not exists public.conversation_topics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  summary text not null default '',
  first_discussed_at timestamptz not null default now(),
  last_discussed_at timestamptz not null default now(),
  discussion_count integer not null default 1
);

create index if not exists conversation_topics_user_idx
  on public.conversation_topics (user_id, last_discussed_at desc);

alter table public.profiles enable row level security;
alter table public.learn_list enable row level security;
alter table public.conversation_topics enable row level security;

drop policy if exists "profiles_own" on public.profiles;
create policy "profiles_own"
  on public.profiles
  for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "learn_list_own" on public.learn_list;
create policy "learn_list_own"
  on public.learn_list
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "conversation_topics_own" on public.conversation_topics;
create policy "conversation_topics_own"
  on public.conversation_topics
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.kea_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.kea_set_updated_at();

create or replace function public.kea_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    first_name,
    native_language,
    target_language,
    preferred_voice
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    new.raw_user_meta_data ->> 'native_language',
    new.raw_user_meta_data ->> 'target_language',
    coalesce(new.raw_user_meta_data ->> 'preferred_voice', 'luna')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.kea_handle_new_user();

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.learn_list to authenticated;
grant select, insert, update, delete on public.conversation_topics to authenticated;
