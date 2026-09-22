-- Kea Production only (project ref laubnngplqvsxokbfski).
-- The admin account signs in without clicking a confirmation email.

create or replace function public.kea_confirm_admin()
returns trigger
language plpgsql
security definer
set search_path = auth, public
as $$
begin
  if lower(coalesce(new.email, '')) = 'simonghooper@gmail.com' then
    new.email_confirmed_at := coalesce(new.email_confirmed_at, now());
  end if;
  return new;
end;
$$;

drop trigger if exists kea_confirm_admin on auth.users;
create trigger kea_confirm_admin
  before insert or update of email, email_confirmed_at
  on auth.users
  for each row
  execute function public.kea_confirm_admin();

update auth.users
set email_confirmed_at = coalesce(email_confirmed_at, now())
where lower(email) = 'simonghooper@gmail.com';
