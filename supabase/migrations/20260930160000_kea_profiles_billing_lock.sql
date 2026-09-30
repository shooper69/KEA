-- Kea Production only (laubnngplqvsxokbfski).
-- Stop authenticated clients forging Stripe / subscription fields on profiles.
-- Service role (webhooks / billing upsert) may still change them.

create or replace function public.profiles_preserve_billing_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') is distinct from 'service_role' then
    new.stripe_customer_id := old.stripe_customer_id;
    new.stripe_subscription_id := old.stripe_subscription_id;
    new.subscription_plan_id := old.subscription_plan_id;
    new.subscription_status := old.subscription_status;
    new.subscription_current_period_end := old.subscription_current_period_end;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_preserve_billing on public.profiles;

create trigger profiles_preserve_billing
  before update on public.profiles
  for each row
  execute function public.profiles_preserve_billing_columns();

comment on function public.profiles_preserve_billing_columns() is
  'Blocks non-service-role updates to Stripe/subscription columns on profiles.';
