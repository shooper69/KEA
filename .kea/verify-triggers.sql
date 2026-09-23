select tgname, rel.relname as table_name
from pg_trigger t
join pg_class rel on rel.oid = t.tgrelid
join pg_namespace n on n.oid = rel.relnamespace
where not t.tgisinternal
  and (
    (n.nspname = 'auth' and rel.relname = 'users')
    or (n.nspname = 'public' and rel.relname = 'profiles')
  )
order by 2, 1;
