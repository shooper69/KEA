-- Kea Production only (laubnngplqvsxokbfski).
-- Per-call OpenAI usage for /admin/costs (Approach B). Service role only.

create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  user_email text,
  actor text not null default 'user',
  feature text not null,
  request_type text not null,
  model text not null,
  plan_id_at_time text,
  prompt_tokens integer not null default 0,
  completion_tokens integer not null default 0,
  audio_seconds numeric not null default 0,
  tts_characters integer not null default 0,
  estimated_cost_usd numeric not null default 0,
  request_id text,
  status text not null default 'ok',
  created_at timestamptz not null default now(),
  constraint ai_usage_events_actor_chk check (
    actor in ('user', 'anonymous', 'admin')
  ),
  constraint ai_usage_events_feature_chk check (
    feature in (
      'conversation_chat',
      'translation',
      'plain_translation',
      'transcription',
      'tts',
      'welcome_tts',
      'other'
    )
  ),
  constraint ai_usage_events_request_type_chk check (
    request_type in (
      'chat_completions',
      'audio_transcriptions',
      'audio_speech'
    )
  ),
  constraint ai_usage_events_status_chk check (status in ('ok', 'error'))
);

create index if not exists ai_usage_events_created_at_idx
  on public.ai_usage_events (created_at desc);

create index if not exists ai_usage_events_user_id_idx
  on public.ai_usage_events (user_id, created_at desc);

create index if not exists ai_usage_events_feature_idx
  on public.ai_usage_events (feature, created_at desc);

create index if not exists ai_usage_events_model_idx
  on public.ai_usage_events (model, created_at desc);

alter table public.ai_usage_events enable row level security;

-- No anon/authenticated policies: only service_role (ingest + admin API).
revoke all on public.ai_usage_events from anon, authenticated;

comment on table public.ai_usage_events is
  'OpenAI call meters for Kea cost analysis. Written by Netlify/Vite handlers; read by /api/costs/admin.';
