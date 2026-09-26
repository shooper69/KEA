-- Kea Production only (laubnngplqvsxokbfski).
-- Stripe subscription fields on profiles (updated by billing webhooks via service role).

alter table public.profiles
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists subscription_plan_id text,
  add column if not exists subscription_status text not null default 'none',
  add column if not exists subscription_current_period_end timestamptz;

create index if not exists profiles_stripe_customer_idx
  on public.profiles (stripe_customer_id)
  where stripe_customer_id is not null;

create index if not exists profiles_stripe_subscription_idx
  on public.profiles (stripe_subscription_id)
  where stripe_subscription_id is not null;

comment on column public.profiles.stripe_customer_id is 'Stripe Customer id (cus_…)';
comment on column public.profiles.stripe_subscription_id is 'Stripe Subscription id (sub_…)';
comment on column public.profiles.subscription_plan_id is 'starter | companion | unlimited';
comment on column public.profiles.subscription_status is 'none | active | past_due | canceled | unpaid | incomplete | trialing';
