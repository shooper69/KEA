# Admin security (Kea)

Kea Production only. Admin UI is **client email-gated**, not a separate privileged JWT.

## What “admin” means

- Signed-in Supabase user whose email is `simonghooper@gmail.com` (`KEA_ADMIN_EMAIL`).
- `/admin` routes use `RequireAdmin` in `src/App.tsx` — email match only.
- The device admin password (`adminAuth.ts`) unlocks local admin edits; it is **not** a server credential.

## Trust boundary

| Layer | Trusted? |
| --- | --- |
| Admin React pages / localStorage catalog edits | **No** for money — UX and local prefs only |
| Stripe Price IDs / discount % from browser | **No** — server catalog in `keaStripeBilling.ts` |
| Website tracker admin API | **Yes** — server checks admin email |
| Chat / TTS / Whisper | Auth + **cloud** talk access (subscription / trial / admin email) |

## Caveats

- Anyone with the admin account session can open `/admin` without the device password.
- Do not put service-role keys or live Stripe secrets in Vite / the browser.
- Sensitive ops must stay on Netlify functions with service role, never “trust the admin UI”.
