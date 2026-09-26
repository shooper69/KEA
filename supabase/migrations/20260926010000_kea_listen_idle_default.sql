-- Default quiet listen window: 10 minutes (was 10 seconds).
alter table public.profiles
  alter column listen_idle_seconds set default 600;

update public.profiles
set listen_idle_seconds = 600
where listen_idle_seconds is not null
  and listen_idle_seconds > 0
  and listen_idle_seconds < 60;
