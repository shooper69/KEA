-- Kea Production only. Costs admin report reads subscription fields via service_role.
grant select on table public.profiles to service_role;
