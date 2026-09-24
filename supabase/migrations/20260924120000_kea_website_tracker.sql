-- Website Tracker for Kea (first-party funnel analytics for kea.chat)
-- Kea Production only: laubnngplqvsxokbfski
-- RLS: deny anon/authenticated; service_role for ingest + admin APIs.

create extension if not exists pgcrypto;

create table if not exists public.wt_visitors (
  id uuid primary key default gen_random_uuid(),
  anon_id uuid not null,
  first_name text,
  email text,
  consent_analytics boolean not null default true,
  consent_version text,
  lead_score integer not null default 0,
  country text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wt_visitors_anon_id_unique unique (anon_id),
  constraint wt_visitors_email_lower_chk check (email is null or email = lower(email))
);

create unique index if not exists wt_visitors_email_unique_idx
  on public.wt_visitors (lower(email))
  where email is not null;

create index if not exists wt_visitors_lead_score_idx
  on public.wt_visitors (lead_score desc);

create index if not exists wt_visitors_last_seen_idx
  on public.wt_visitors (last_seen_at desc);

create table if not exists public.wt_sessions (
  id uuid primary key,
  visitor_id uuid not null references public.wt_visitors (id) on delete cascade,
  landed_at timestamptz not null default now(),
  ended_at timestamptz,
  last_heartbeat_at timestamptz,
  current_path text,
  landing_path text,
  exit_path text,
  source text,
  medium text,
  campaign text,
  referrer text,
  device text,
  country text,
  consent_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists wt_sessions_landed_at_idx
  on public.wt_sessions (landed_at desc);

create index if not exists wt_sessions_visitor_id_idx
  on public.wt_sessions (visitor_id);

create index if not exists wt_sessions_source_landed_idx
  on public.wt_sessions (source, landed_at desc);

create index if not exists wt_sessions_live_idx
  on public.wt_sessions (last_heartbeat_at desc)
  where last_heartbeat_at is not null;

create table if not exists public.wt_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.wt_sessions (id) on delete cascade,
  visitor_id uuid not null references public.wt_visitors (id) on delete cascade,
  type text not null,
  path text,
  ts timestamptz not null default now(),
  duration_ms integer,
  scroll_pct smallint,
  props jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint wt_events_type_chk check (
    type in (
      'session_start',
      'page_view',
      'page_leave',
      'click',
      'identify',
      'heartbeat',
      'video_complete',
      'register_click',
      'contact_form_submitted'
    )
  ),
  constraint wt_events_scroll_pct_chk check (
    scroll_pct is null or (scroll_pct >= 0 and scroll_pct <= 100)
  )
);

create index if not exists wt_events_session_ts_idx
  on public.wt_events (session_id, ts);

create index if not exists wt_events_visitor_ts_idx
  on public.wt_events (visitor_id, ts);

create index if not exists wt_events_type_ts_idx
  on public.wt_events (type, ts desc);

create index if not exists wt_events_path_page_view_idx
  on public.wt_events (path, type)
  where type = 'page_view';

create table if not exists public.wt_conversions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.wt_sessions (id) on delete set null,
  visitor_id uuid references public.wt_visitors (id) on delete set null,
  kind text not null,
  target_url text,
  occurred_at timestamptz not null default now(),
  profile_id uuid references auth.users (id) on delete set null,
  props jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint wt_conversions_kind_chk check (
    kind in (
      'register_click',
      'register_complete',
      'subscription_started',
      'subscription_completed',
      'contact_form_submitted'
    )
  )
);

create index if not exists wt_conversions_occurred_at_idx
  on public.wt_conversions (occurred_at desc);

create index if not exists wt_conversions_kind_occurred_idx
  on public.wt_conversions (kind, occurred_at desc);

create index if not exists wt_conversions_visitor_idx
  on public.wt_conversions (visitor_id);

create unique index if not exists wt_conversions_session_register_click_uidx
  on public.wt_conversions (session_id, kind)
  where kind = 'register_click' and session_id is not null;

create table if not exists public.wt_funnel_defs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  steps jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists wt_funnel_defs_active_idx
  on public.wt_funnel_defs (is_active)
  where is_active = true;

create table if not exists public.wt_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.wt_settings (key, value, updated_at)
values
  (
    'retention',
    jsonb_build_object(
      'period', '90',
      'allowed', jsonb_build_array('90', '180', '365', 'unlimited')
    ),
    now()
  ),
  (
    'lead_score_weights',
    jsonb_build_object(
      'register_page_visit', 25,
      'pricing_page_visit', 20,
      'video_complete', 15,
      'email_entered', 25,
      'name_entered', 15,
      'register_click', 30,
      'contact_form_submitted', 20,
      'return_visit', 10,
      'register_complete', 40,
      'subscription_started', 35,
      'subscription_completed', 50
    ),
    now()
  ),
  (
    'lead_score_tiers',
    jsonb_build_object('cold_max', 14, 'warm_max', 39),
    now()
  ),
  (
    'heartbeat',
    jsonb_build_object('interval_seconds', 30, 'live_window_seconds', 90),
    now()
  ),
  (
    'path_rules',
    jsonb_build_object(
      'landing', jsonb_build_array('/'),
      'benefits', jsonb_build_array('/about', '/home'),
      'video', jsonb_build_array('/conversation'),
      'register_page', jsonb_build_array('/'),
      'pricing_page', jsonb_build_array('/settings')
    ),
    now()
  )
on conflict (key) do nothing;

insert into public.wt_funnel_defs (name, steps, is_active)
select
  'Welcome → Talk',
  jsonb_build_array(
    jsonb_build_object('id', 'welcome', 'label', 'Welcome', 'match', '/'),
    jsonb_build_object('id', 'home', 'label', 'Home', 'match', '/home'),
    jsonb_build_object('id', 'conversation', 'label', 'Talk', 'match', '/conversation'),
    jsonb_build_object('id', 'settings', 'label', 'Settings', 'match', '/settings'),
    jsonb_build_object('id', 'register', 'label', 'Register', 'match', 'conversion:register_click')
  ),
  true
where not exists (
  select 1 from public.wt_funnel_defs where name = 'Welcome → Talk'
);

alter table public.wt_visitors enable row level security;
alter table public.wt_sessions enable row level security;
alter table public.wt_events enable row level security;
alter table public.wt_conversions enable row level security;
alter table public.wt_funnel_defs enable row level security;
alter table public.wt_settings enable row level security;

alter table public.wt_visitors force row level security;
alter table public.wt_sessions force row level security;
alter table public.wt_events force row level security;
alter table public.wt_conversions force row level security;
alter table public.wt_funnel_defs force row level security;
alter table public.wt_settings force row level security;

drop policy if exists "wt_visitors_service_all" on public.wt_visitors;
create policy "wt_visitors_service_all" on public.wt_visitors
  as permissive for all to service_role using (true) with check (true);

drop policy if exists "wt_sessions_service_all" on public.wt_sessions;
create policy "wt_sessions_service_all" on public.wt_sessions
  as permissive for all to service_role using (true) with check (true);

drop policy if exists "wt_events_service_all" on public.wt_events;
create policy "wt_events_service_all" on public.wt_events
  as permissive for all to service_role using (true) with check (true);

drop policy if exists "wt_conversions_service_all" on public.wt_conversions;
create policy "wt_conversions_service_all" on public.wt_conversions
  as permissive for all to service_role using (true) with check (true);

drop policy if exists "wt_funnel_defs_service_all" on public.wt_funnel_defs;
create policy "wt_funnel_defs_service_all" on public.wt_funnel_defs
  as permissive for all to service_role using (true) with check (true);

drop policy if exists "wt_settings_service_all" on public.wt_settings;
create policy "wt_settings_service_all" on public.wt_settings
  as permissive for all to service_role using (true) with check (true);

revoke all on public.wt_visitors from anon, authenticated;
revoke all on public.wt_sessions from anon, authenticated;
revoke all on public.wt_events from anon, authenticated;
revoke all on public.wt_conversions from anon, authenticated;
revoke all on public.wt_funnel_defs from anon, authenticated;
revoke all on public.wt_settings from anon, authenticated;

grant all on public.wt_visitors to service_role;
grant all on public.wt_sessions to service_role;
grant all on public.wt_events to service_role;
grant all on public.wt_conversions to service_role;
grant all on public.wt_funnel_defs to service_role;
grant all on public.wt_settings to service_role;
