select conrelid::regclass as table_name, conname, contype
from pg_constraint
where connamespace = 'public'::regnamespace
  and conrelid::regclass::text in ('profiles', 'learn_list', 'conversation_topics')
order by 1, 2;
