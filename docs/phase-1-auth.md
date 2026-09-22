# Phase 1 — Auth and profiles (Kea Production)

Kea only. Project ref `laubnngplqvsxokbfski`. No billing, no subscriptions, free tier.

## SQL

In [Kea Production SQL editor](https://supabase.com/dashboard/project/laubnngplqvsxokbfski/sql/new) run:

1. `supabase/migrations/20260922120000_kea_auth_memory.sql`
2. `supabase/migrations/20260922190000_kea_admin_autoconfirm.sql`

The first creates `profiles`, `learn_list`, and `conversation_topics` with RLS so a user only sees their own rows. A trigger fills `profiles` when someone registers.

The second confirms `simonghooper@gmail.com` in Auth and keeps that admin account confirmed, so the admin can sign in without clicking a confirmation email. Other users still confirm by email.

## Auth + Resend

Dashboard → Authentication:

1. Enable email / password.
2. Confirm email: on.
3. Site URL: `https://kea.chat`
4. Redirect URLs:
   - `http://localhost:5173`
   - `http://localhost:5173/**`
   - `https://kea.chat`
   - `https://kea.chat/**`
   - `https://keachat.netlify.app`
   - `https://keachat.netlify.app/**`
5. SMTP (Resend):
   - Host `smtp.resend.com`
   - Port `465`
   - User `resend`
   - Password = Resend API key
   - Sender `Kea <noreply@kea.chat>` (domain must be verified in Resend)

## Local environment

Copy `.env.example` to `.env.local`:

```
OPENAI_API_KEY=
VITE_SUPABASE_URL=https://laubnngplqvsxokbfski.supabase.co
VITE_SUPABASE_ANON_KEY=
RESEND_API_KEY=
```

`VITE_SUPABASE_ANON_KEY` is the publishable / anon key from Kea Production → Settings → API Keys. Never put the service role in Vite or the browser.

## Netlify variables (site keachat)

Build-time (exposed to the browser, anon only):

- `VITE_SUPABASE_URL` = `https://laubnngplqvsxokbfski.supabase.co`
- `VITE_SUPABASE_ANON_KEY` = Kea Production anon key

Server-only:

- `OPENAI_API_KEY`
- `RESEND_API_KEY` (optional here if SMTP is set on Supabase)

Then redeploy so the Vite bundle picks up the `VITE_` values.

## Deploy

1. Run the SQL on Kea Production.
2. Set Auth + Resend SMTP as above.
3. Set Netlify env vars on **keachat**.
4. Push `shooper69/KEA` (or trigger a keachat deploy).
5. Confirm a new user gets a Resend verification mail, can sign in, and sees the same profile in Settings.
