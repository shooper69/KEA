select table_schema, table_name
from information_schema.tables
where (table_schema = 'auth' and table_name = 'users')
   or (table_schema = 'public' and table_name in ('profiles', 'learn_list', 'conversation_topics'))
order by table_schema, table_name;

select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name in ('profiles', 'learn_list', 'conversation_topics')
order by table_name, ordinal_position;

select version, name
from supabase_migrations.schema_migrations
order by version;
