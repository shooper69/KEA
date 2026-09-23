select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name in ('profiles', 'learn_list', 'conversation_topics')
order by table_name, ordinal_position;
