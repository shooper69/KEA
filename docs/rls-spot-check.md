# B9 — Second-account RLS spot-check (Kea Production)

Run after two real users exist on `laubnngplqvsxokbfski`. Use the **anon key + each user’s access token**, not the service role (service role bypasses RLS).

## Expect

User A must **not** read or write User B’s `profiles` or `learn_list` rows.

## Steps (browser / PostgREST)

1. Sign in as User A → copy session `access_token`.
2. `GET /rest/v1/learn_list?select=*` with `Authorization: Bearer <A>` — only A’s rows.
3. `GET /rest/v1/profiles?select=id,email&id=eq.<B_uuid>` with A’s token — empty / denied.
4. Attempt `PATCH` B’s learn_list row with A’s token — must fail.
5. Repeat swapped (B → A).

## SQL sanity (service role, read-only)

In SQL editor, confirm policies exist:

```sql
select schemaname, tablename, policyname, cmd, qual, with_check
from pg_policies
where tablename in ('profiles', 'learn_list', 'conversation_topics')
order by tablename, policyname;
```

Tick Phase B item 9 in `docs/pre-launch.md` only after the live two-user check passes.
