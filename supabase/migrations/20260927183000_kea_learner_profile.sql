-- Kea Production only (project ref laubnngplqvsxokbfski).
-- Onboarding answers live on the user, not on one browser.

alter table public.profiles
  add column if not exists learner_profile jsonb;

comment on column public.profiles.learner_profile is
  'First-visit answers: level, reason, weeklyTime, age, interests.';
