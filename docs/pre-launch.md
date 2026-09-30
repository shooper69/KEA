# Kea pre-launch plan

Security, hardening, review, and go-live checks for **Kea only**  
(GitHub `shooper69/KEA`, Supabase `laubnngplqvsxokbfski`, Netlify `keachat` / `kea.chat`).

---

## Should we do Playwright first?

**Not as the first security step.** Playwright is a regression and smoke tool, not a substitute for secrets, RLS, or API hardening.

Recommended order:

1. **Inventory + secrets** (what can burn money or leak data)
2. **Auth / Supabase RLS / API gates** (real protection)
3. **Thin Playwright smoke** on critical paths (welcome → login → talk → paywall)
4. **Deeper review** (billing, voice cost, privacy copy, admin)
5. **Production config + launch**

Do run the existing e2e suite early and keep it green (`npm run test:e2e`). Expand it after the security baseline, not instead of it. Today coverage is thin (`e2e/welcome.spec.ts`, `e2e/learner-quiz-gate.spec.ts`).

---

## Status legend

- `[ ]` not started  
- `[~]` in progress  
- `[x]` done  
- `[!]` blocked / needs decision  

---

## 0. Scope freeze

- [ ] Agree what “launch” means (open signup vs invite-only, paid tiers live, voice live)
- [ ] Freeze non-essential product changes during the security window
- [ ] Confirm isolation: no Remelife / Investech CLIs, orgs, tokens, or databases (`npm run guard`)

---

## 1. Inventory (do this first)

### Secrets and keys

- [ ] List every secret in Netlify + local `.env` (and nowhere else)
  - `OPENAI_API_KEY`
  - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
  - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (server only)
  - Resend / auth email tokens if used outside Supabase dashboard
- [ ] Confirm **anon** key is the only Supabase key in the browser
- [ ] Confirm **service role** never ships in client bundles or public Netlify env
- [ ] Rotate any key that ever lived in chat logs, screenshots, or shared notes
- [ ] `.kea/` tokens stay gitignored; never commit them

### Attack surface map

- [ ] Public pages: `/`, `/method`, legal, marketing
- [ ] Auth: signup, login, confirm email, password reset
- [ ] App: `/conversation`, `/learn`, `/settings`, `/subscription`, `/usage`, `/performance`
- [ ] Admin routes (email-gated)
- [ ] Netlify functions / API: chat, TTS, transcribe, billing, website-tracker
- [ ] Supabase tables: `profiles`, `learn_list`, `conversation_topics`, billing columns, tracker tables

---

## 2. Auth and account security

- [ ] Email confirmation required for non-admin users (see `docs/phase-1-auth.md`)
- [ ] Password reset works end-to-end on production domain
- [ ] Session expiry / idle timeout behaves as Settings claim
- [ ] Sign-out clears session; another browser cannot keep acting as the user
- [ ] Admin unlock cannot be spoofed from the client alone
- [ ] Auth redirect URLs in Supabase allow only Kea domains (`kea.chat`, localhost for dev)
- [ ] SPF / DKIM / DMARC still verified for `kea.chat` (deliverability = account security)

---

## 3. Supabase hardening

- [ ] Every user table has RLS enabled
- [ ] Policies: user can only `select/insert/update/delete` own rows (`auth.uid() = user_id` / `id`)
- [ ] No table is `GRANT`ed to `anon` beyond what public marketing needs (prefer none)
- [ ] `learn_list` add / practice_count / delete sync cannot be abused cross-user
- [ ] `learner_profile` and subscription fields cannot be forged by another user
- [ ] Service-role usage only in trusted server paths (billing webhook, admin ops)
- [ ] Spot-check with a second test account: cannot read first account’s learn list or profile

---

## 4. API / Netlify function hardening

- [ ] Chat / TTS / Whisper require an authenticated session (or another tight gate) before spending OpenAI money
- [ ] Rate limits or quotas per user / IP on expensive routes (chat, TTS, transcribe)
- [ ] Request size limits on audio upload and chat payloads
- [ ] Stripe webhook verifies signature (`STRIPE_WEBHOOK_SECRET`)
- [ ] Billing endpoints cannot start checkout for arbitrary price IDs outside Kea plans
- [ ] Website-tracker ingest: origin allowlist, consent required, rate limited
- [ ] Website-tracker admin: admin-only auth
- [ ] No stack traces or internal env names returned to the browser
- [ ] CORS / redirects only for Kea origins

---

## 5. Client / front-end hardening

- [ ] No secrets in `src/` beyond published anon / publishable keys
- [ ] Review `localStorage` / `sessionStorage`: nothing sensitive that another shared-device user must not see
- [ ] XSS: user speech and Kea replies rendered as text, not raw HTML
- [ ] Deep links (`?login=1`, `?onboarding=1`) cannot escalate privileges
- [ ] Paywall and talk gates cannot be bypassed by flipping client state alone
- [ ] Content-Security-Policy / security headers on Netlify (at least baseline: frame, sniffing, referrer)

---

## 6. Privacy, legal, and data

- [ ] Privacy / terms pages match what Kea actually stores (voice, transcripts, learn list, profile, payments)
- [ ] Cookie / analytics consent matches website-tracker behaviour
- [ ] “Save transcripts” and notification settings do what they say
- [ ] Account delete / data export path decided (even if manual at launch)
- [ ] Stripe customer portal works; cancelled sub updates Kea access

---

## 7. Product smoke (manual + Playwright)

### Manual critical path

- [ ] Marketing → Login → confirm → onboarding → Talk
- [ ] Mic permission, welcome line, listen / reply / correct flow
- [ ] Learn List: word added → count climbs → removed after mastery uses → row gone in Supabase
- [ ] Settings Sound / languages / profile save to cloud
- [ ] Subscription checkout (test mode) → webhook → access unlocked
- [ ] Leave funnel / offers do not break talk
- [ ] Mobile Chrome + Safari; Bluetooth / headphones path if advertising car use

### Playwright (expand after section 2–4 baseline)

- [ ] Keep existing welcome + learner-quiz-gate green
- [ ] Add: login modal opens from marketing **Login**
- [ ] Add: signed-in redirect to conversation (fixture account)
- [ ] Add: paywall / gate visible when blocked
- [ ] Add: Learn List page renders for signed-in user
- [ ] Optional later: Stripe test checkout (harder; often stay manual)

Command: `npm run test:e2e`

---

## 8. Cost and abuse controls

- [ ] OpenAI spend alerts / hard budget in OpenAI dashboard
- [ ] Stripe test vs live keys clearly separated; live keys only on production
- [ ] Free / trial talk minutes enforced server-side where money is at risk
- [ ] Admin cost page numbers sanity-checked against real invoices
- [ ] Whisper / TTS cannot be hammered anonymously

---

## 9. Build, deploy, and ops

- [ ] `npm run guard` + `npm run build` clean on main
- [ ] Netlify production env complete; preview env has no live Stripe/OpenAI if possible
- [ ] Rollback plan: previous Netlify deploy + known-good Supabase migration state
- [ ] Monitoring: Netlify function errors, Stripe webhooks, Supabase auth failures
- [ ] Support path: how a user reports “I paid but cannot talk”

---

## 10. Launch day checklist

- [ ] DNS / HTTPS / `kea.chat` correct
- [ ] Auth emails landing (not junk) for a fresh Gmail and Apple Mail address
- [ ] One full paid path in **test** mode, then switch carefully to live if launching paid
- [ ] Create a fresh user on a clean device and walk the happy path
- [ ] Watch OpenAI + Stripe + Netlify logs for the first hour
- [ ] Freeze risky admin edits (master definition, offers) unless needed

---

## Suggested week order

| Day | Focus |
| --- | --- |
| 1 | Inventory secrets + attack surface; fix anything exposed |
| 2 | Supabase RLS + second-account cross-access tests |
| 3 | API auth, rate limits, Stripe webhook, tracker gates |
| 4 | Client XSS / storage / paywall bypass review |
| 5 | Expand Playwright smoke; manual mobile path |
| 6 | Privacy copy, cost alerts, deploy/rollback |
| 7 | Launch-day checklist |

---

## Out of scope for v1 (track, don’t block)

- Formal penetration test by a third party
- Full CSP lockdown that breaks TTS / analytics
- Perfect GDPR self-serve delete UI (decide manual process first)
- Exhaustive Playwright for every voice edge case

---

## Notes

- Isolation rule remains: use `npm run kea:supabase` / `kea:netlify` / `kea:github` only.
- Prefer fixing real gates (RLS, auth on spendy APIs) over adding more UI-only checks.
- Revisit this file after each launch candidate; tick boxes in git so the next release inherits the bar.
