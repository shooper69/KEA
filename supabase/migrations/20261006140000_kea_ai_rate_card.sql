-- Kea Production only (laubnngplqvsxokbfski).
-- Singleton OpenAI rate card for /admin/costs. Service role only; code defaults as fallback.

create table if not exists public.ai_rate_card (
  id integer primary key check (id = 1),
  whisper_per_minute numeric not null,
  chat_input_per_million numeric not null,
  chat_output_per_million numeric not null,
  tts_input_per_million numeric not null,
  tts_audio_per_million numeric not null,
  tts_hd_per_million_chars numeric not null,
  updated_at timestamptz not null default now(),
  updated_by text
);

insert into public.ai_rate_card (
  id,
  whisper_per_minute,
  chat_input_per_million,
  chat_output_per_million,
  tts_input_per_million,
  tts_audio_per_million,
  tts_hd_per_million_chars
) values (
  1,
  0.006,
  0.15,
  0.6,
  0.6,
  12,
  30
)
on conflict (id) do nothing;

alter table public.ai_rate_card enable row level security;

revoke all on public.ai_rate_card from anon, authenticated;
grant select, insert, update on public.ai_rate_card to service_role;

comment on table public.ai_rate_card is
  'Singleton OpenAI list rates for AI usage cost estimates. Edited from /admin/costs; handlers fall back to code defaults if missing.';
