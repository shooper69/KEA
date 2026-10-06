-- Kea Production only (laubnngplqvsxokbfski).
-- Ensure service_role can write/read ai_usage_events (RLS remains on; no anon/auth policies).

grant select, insert, update, delete on table public.ai_usage_events to service_role;
grant usage on schema public to service_role;

revoke all on table public.ai_usage_events from anon, authenticated;
