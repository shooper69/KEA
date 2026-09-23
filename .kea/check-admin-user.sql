select
  id,
  email,
  email_confirmed_at is not null as confirmed,
  banned_until,
  deleted_at,
  last_sign_in_at,
  created_at,
  updated_at,
  raw_app_meta_data->>'provider' as provider,
  coalesce(encrypted_password, '') <> '' as has_password,
  is_anonymous
from auth.users
where lower(email) = 'simonghooper@gmail.com';
