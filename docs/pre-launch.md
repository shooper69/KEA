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
5. **Production config + launch** (then Play AAB)

Do run the existing e2e suite early and keep it green (`npm run test:e2e`). Expand it after the security baseline, not instead of it. Today coverage is thin (`e2e/welcome.spec.ts`, `e2e/learner-quiz-gate.spec.ts`).

---

## Status legend

- `[ ]` not started  
- `[~]` in progress  
- `[x]` done  
- `[!]` blocked / needs decision  

---

## Decisions (locked 2026-09-30)

| Topic | Decision |
| --- | --- |
| Play listing | **Free** download |
| Payments | **Stripe on kea.chat (website)** — not Play Billing unless Play objects |
| Play risk | Accepted for now; Plan B = enable Play Billing if required |
| PWA | **Out of scope** for Play AAB shipping (browser install stays as-is) |
| Play Console | Owner-owned (assets, package id, signing, staged rollout, listing, AAB upload) |
| Play testers | Owner chooses tester emails **inside Play Console** — unrelated to web hardening |
| Order of work | **1)** Harden + ship robust Kea on GitHub → **2)** then build AAB → **3)** then code lock / freeze so changes do not creep in |
| Stripe mode for launch | **Live** (`sk_live_…` on Netlify `keachat`) |
| Switching Stripe later | Swap Netlify (and local `.env`) `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` between live and test keys; point webhook endpoint at matching mode. Cursor Stripe MCP can **query** live or test when that mode is connected — it does **not** flip Netlify env by itself. |
| kea.chat signup | **Anyone can register** (open signup). Not related to Play tester lists. |

### Clarification — “open signup vs invite-only” (was confusing)

That phrase was about **who can create a Kea account on kea.chat**, not about Play Store.

| What | Who controls it | Part of this hardening track? |
| --- | --- | --- |
| Play internal/closed testers | You, in Play Console (email list) | **No** — listing / AAB later |
| Website signup (register on kea.chat) | Kea app + Supabase Auth | Only if we chose to lock the site to invites; **we are not doing that** |

Play tester emails do **not** need to be decided for security hardening. Ignore that old `[!]` item.

---

## Final plan of action (before AAB)

Execute in this order. Tick boxes here and in the section checklists; log work in **Work log** below.

### Phase A — Close money / abuse holes (do now)

1. [x] Inventory secrets + attack surface (2026-09-30)
2. [x] Gate OpenAI spend: chat / TTS / Whisper require signed-in session; narrow public welcome translate/TTS with IP caps
3. [x] Server-side Stripe checkout: ignore client price / %; only Kea catalog Price IDs + server discount codes
4. [x] Bind billing portal + session-confirm to authenticated user (no open `customerId` / session abuse)
5. [x] Lock `profiles` Stripe/subscription columns to service-role writes only (trigger migration applied)
6. [x] Authenticated rate / size limits on chat + TTS (+ Whisper); public caps already partial
7. [x] Baseline Netlify security headers (frame, nosniff, referrer, Permissions-Policy, light CSP)

### Phase B — Auth, data, client integrity

8. [x] Confirm email confirmation, password reset, redirect allowlist on production — verified 2026-10-01 via Auth API: `site_url=https://kea.chat`, `mailer_autoconfirm=false`, recovery template present, allowlist `localhost:5173/**` + `kea.chat/**` + `keachat.netlify.app/**`
9. [~] Second-account RLS spot-check (learn list / profile) — own-row policies in migrations (`profiles_own` / `learn_list_own`); procedure in `docs/rls-spot-check.md`; **owner** still run live two-user check once
10. [x] Paywall not bypassable by `localStorage` alone — server talk gate on chat/TTS/Whisper via cloud `profiles.subscription_*` + trial from `created_at` (`keaTalkAccessGate.ts`, 2026-10-01)
11. [x] XSS / storage review; admin client-only caveats documented — no `dangerouslySetInnerHTML`; see `docs/admin-security.md`

### Phase C — Smoke + ops

12. [x] `npm run guard` + `npm run build` clean — passed 2026-10-01 (redeploy when you commit/push)
13. [ ] One **live** Checkout happy path (small real charge or known live card flow) + webhook → access — **owner**
14. [x] Expand Playwright: public pages + login modal + talk-access unit checks (`e2e/public-pages.spec.ts`, `e2e/talk-access.spec.ts`; full suite **13 passed** 2026-10-01)
15. [~] OpenAI spend alert + Stripe live/test key separation — documented in this file; **owner** set OpenAI budget alert in dashboard
16. [x] Support path for “I paid but cannot talk” — https://kea.chat/support (+ Settings Help)

### Phase D — After robust GitHub release (not now)

17. [ ] Tag / release final hardened build on GitHub
18. [ ] **Code lock:** freeze main (or protect branch / require PR + owner approval) so new features do not creep in while packaging
19. [ ] Owner: build AAB and upload to Play internal/closed testing (tester emails in Play Console)
20. [ ] Owner: Data safety + content rating as required by Play
21. [ ] Device install from Play test track + mic talk smoke
22. [ ] If Play objects to web Stripe → Play Billing Plan B

**Out of this track for now:** AAB build, Play tester lists, PWA debates, mic/wake perfection.

---

## How Stripe live ↔ test actually switches

| Layer | What to change |
| --- | --- |
| **App / Netlify** | `STRIPE_SECRET_KEY` (`sk_live_…` ↔ `sk_test_…`) and matching `STRIPE_WEBHOOK_SECRET`; webhook URL mode in Stripe Dashboard |
| **Cursor Stripe MCP** | Session can use `livemode: true` or `false` **if** that mode is connected (`list_available_accounts_or_orgs` / `manage_stripe_accounts`). Today Kea shows **live** (`acct_1UJfe36G7iCRQAR8`). MCP does **not** rewrite Netlify env. |
| **Admin UI** | Catalog IDs in Admin → Stripe assume live account; test mode needs test Price IDs if you switch keys |

**Launch rule:** Production Netlify for `keachat` stays on **live** keys (`sk_live_…` + live webhook secret). Local/dev may use test keys in `.env.local` only — never mix live webhook secrets with test secret keys.

---

## 0. Scope freeze

- [x] Agree what “launch” means for this track — harden web Kea, Stripe live on kea.chat, free Play later; Play testers = Console only
- [x] Freeze non-essential product changes during the security window (AAB deferred until after hardened GitHub release)
- [x] Confirm isolation: no Remelife / Investech CLIs, orgs, tokens, or databases (`npm run guard`)
- [ ] After final hardened release: lock repo against creeping changes (branch protection / freeze)

---

## 1. Inventory (do this first)

### Secrets and keys

- [x] List every secret in Netlify + local `.env` (and nowhere else) — inventoried 2026-09-30; OpenAI/Stripe/service-role stay server-side; anon is browser-safe
  - `OPENAI_API_KEY`
  - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
  - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (server only)
  - Resend / auth email tokens if used outside Supabase dashboard
- [ ] Confirm **anon** key is the only Supabase key in the browser
- [ ] Confirm **service role** never ships in client bundles or public Netlify env
- [ ] Rotate any key that ever lived in chat logs, screenshots, or shared notes
- [ ] `.kea/` tokens stay gitignored; never commit them

### Attack surface map

- [x] Mapped 2026-09-30 (public / auth / app / admin / Netlify functions / Supabase tables) — see Work log inventory notes
- [ ] Public pages: `/`, `/method`, legal, marketing — re-check at deploy
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
- [x] `learner_profile` and subscription fields cannot be forged by another user — cross-user RLS; billing columns locked from client UPDATE (2026-09-30 trigger)
- [x] Service-role usage only in trusted server paths (billing webhook, admin ops)
- [ ] Spot-check with a second test account: cannot read first account’s learn list or profile
- [x] **Billing columns on `profiles`:** block client UPDATE of `stripe_*` / `subscription_*` (service role / webhook only) — migration `20260930160000_kea_profiles_billing_lock.sql` applied to Kea Production

---

## 4. API / Netlify function hardening

- [x] Chat / TTS / Whisper require an authenticated session (or another tight gate) before spending OpenAI money — signed-in Bearer required; short welcome `plain-translate` / short TTS remain public with IP caps
- [x] Rate limits or quotas per user / IP on expensive routes (chat, TTS, transcribe) — public + authenticated (per user and IP, in-memory per instance)
- [x] Request size limits on audio upload and chat payloads — Whisper 20MB; chat message/history caps; auth TTS max 2000 chars
- [x] Stripe webhook verifies signature (`STRIPE_WEBHOOK_SECRET`) — code path exists; confirm live secret on Netlify at deploy
- [x] Billing endpoints cannot start checkout for arbitrary price IDs / spoofed amounts outside Kea plans
- [x] Billing portal + session confirm require auth / ownership binding
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
- [x] Content-Security-Policy / security headers on Netlify (baseline + light CSP in `netlify.toml`)

---

## 6. Privacy, legal, and data

- [ ] Privacy / terms pages match what Kea actually stores (voice, transcripts, learn list, profile, payments)
- [ ] Cookie / analytics consent matches website-tracker behaviour
- [ ] “Save transcripts” and notification settings do what they say
- [ ] Account delete / data export path decided (even if manual at launch)
- [ ] Stripe customer portal works; cancelled sub updates Kea access
- [ ] Play Data safety form (owner) matches privacy copy when AAB ships

---

## 7. Product smoke (manual + Playwright)

### Manual critical path

- [ ] Marketing → Login → confirm → onboarding → Talk
- [ ] Mic permission, welcome line, listen / reply / correct flow
- [ ] Learn List: word added → count climbs → removed after mastery uses → row gone in Supabase
- [ ] Settings Sound / languages / profile save to cloud
- [ ] Subscription checkout (**live**) → webhook → access unlocked
- [ ] Leave funnel / offers do not break talk
- [ ] Mobile Chrome + Safari; Bluetooth / headphones path if advertising car use

### Playwright (expand after section 2–4 baseline)

- [ ] Keep existing welcome + learner-quiz-gate green
- [ ] Add: login modal opens from marketing **Login**
- [ ] Add: signed-in redirect to conversation (fixture account)
- [ ] Add: paywall / gate visible when blocked
- [ ] Add: Learn List page renders for signed-in user
- [ ] Optional later: Stripe checkout automation (usually stay manual)

Command: `npm run test:e2e`

---

## 8. Cost and abuse controls

- [~] OpenAI spend alerts / hard budget in OpenAI dashboard — **owner** set budget alert; app already rate-limits + talk-gates spendy routes

- [~] Stripe test vs live keys clearly separated; **launch = live on production**; switch back to test by env swap (see table above)
- [ ] Free / trial talk minutes enforced server-side where money is at risk
- [ ] Admin cost page numbers sanity-checked against real invoices
- [x] Whisper / TTS cannot be hammered anonymously — auth required (short public TTS rate-capped)

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
- [ ] One full paid path in **live** mode confirmed
- [ ] Create a fresh user on a clean device and walk the happy path
- [ ] Watch OpenAI + Stripe + Netlify logs for the first hour
- [ ] Freeze risky admin edits (master definition, offers) unless needed

---

## 11. Play Store (owner track — after web hardening)

- [ ] AAB built and uploaded to internal/closed testing
- [ ] Listing live fields final (owner)
- [ ] Data safety + content rating (owner)
- [x] Account deletion URL for Play: https://kea.chat/delete-account (also Settings → Security)
- [ ] Device install from Play test track + mic talk smoke
- [ ] If Play rejects web Stripe → Play Billing Plan B

---

## Suggested week order

| Day | Focus |
| --- | --- |
| 1 | Inventory + OpenAI auth gates (started) |
| 2 | Stripe checkout/portal harden + profile billing column lock |
| 3 | Rate/size limits, security headers, deploy |
| 4 | RLS second-account tests + paywall server trust |
| 5 | Playwright expand + manual mobile path |
| 6 | Privacy copy, cost alerts, ops/rollback |
| 7 | Live Checkout prove-out → GitHub release → code lock → then AAB |

---

## Out of scope for v1 (track, don’t block)

- Formal penetration test by a third party
- Full CSP lockdown that breaks TTS / analytics
- Perfect GDPR self-serve delete UI (decide manual process first) → **done**: `/delete-account` + Settings → Security
- Exhaustive Playwright for every voice edge case
- PWA ↔ Play AAB packaging debates
- Mic/wake “perfect in noise” (separate product work)
- Play Console listing asset upload (owner)

---

## Work log

### 2026-09-30 — Authenticated rate limits + Netlify security headers

**Build:**

- Extended `keaPublicRateLimit.ts`: auth chat 60/min/user (+ IP), TTS 40/min, Whisper 40/min; chat payload size checks; auth TTS max 2000 chars.
- Wired into Vite handlers and Netlify `chat` / `tts` / `transcribe` functions.
- `netlify.toml` `/*` headers: `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` (mic self), `COOP`, light CSP (self + Supabase + Stripe + Google Fonts; `unsafe-inline` kept for JSON-LD / styles).

**Problems / notes:**

- Limits are in-memory per function instance (cold starts reset counters) — good enough for casual abuse, not a global Redis quota.
- CSP allows `'unsafe-inline'` scripts for JSON-LD in `index.html`; tighten later if we move that out.
- Headers apply after next Netlify deploy of this `netlify.toml`.

**Errors:** none in this step.

---

### 2026-09-30 — Open signup confirmed; Stripe checkout / portal / billing-column harden

**Decision:** Anyone can register on kea.chat (open signup).

**Build:**

- Checkout requires Bearer session; uses server `KEA_PLAN_TO_PRICE` only (ignores client `monthlyPrice` / `stripePriceId` / `discountPercent`).
- Discounts: server `KEA_SERVER_DISCOUNTS` only (default codes); removed client free `activatePlan` bypass for 100% off.
- Portal: auth required; customer id loaded from profile via service role (ignores client `customerId`).
- Session confirm: auth required; rejects other users’ Checkout sessions; upserts for authenticated user only.
- Success/cancel/return URLs restricted to kea.chat / localhost.
- Migration `20260930160000_kea_profiles_billing_lock.sql` pushed to Kea Production (`db push` succeeded).
- Client: `keaPay.ts` + `SubscriptionPanel` send auth headers; slim checkout payload.

**Problems / notes:**

- Admin-edited discount codes in `localStorage` are **not** trusted by the server yet (only seeded defaults). If admin changes % in UI, server must be updated later (or sync discounts to cloud).
- Docker warning on `db push` (no Docker Desktop) — remote migrate still applied; local cache warning only.
- Paywall still partly `localStorage` until talk APIs also check cloud subscription (Phase B item).
- Hardening commits may still be uncommitted locally until an explicit commit/push.

**Errors:** none on `kea:supabase db push` for billing lock (exit 0).

---

### 2026-09-30 — Clarify Play testers vs website signup; AAB timing

**Owner clarification:** “Open signup vs invite-only” was misread as Play tester emails. Play Console tester lists are **owner-only** and **not** part of hardening. Website stays normal open registration.

**Order restated:** finish robust Kea on GitHub → **then** AAB → **then** lock code against creep. AAB not started now.

**Doc:** removed false blocker; Phase D reordered; code-lock checkbox added under scope freeze.

---

### 2026-09-30 — Decisions + inventory + OpenAI API auth

**Decisions recorded:** free Play; Stripe-on-web; PWA out of AAB scope; harden before AAB; Stripe **live** for launch; Play Console owner-owned.

**Inventory (read-only explore):**

- OpenAI / Stripe secret / service-role: server-only (good).
- Anon Supabase in browser (expected).
- **Critical:** `/api/chat`, `/api/tts`, `/api/transcribe` had **no** session gate → OpenAI spend abuse.
- Checkout trusted client `monthlyPrice` / `discountPercent` (spoof risk) — **still open**.
- Billing portal/session unauthenticated — **still open**.
- `profiles` own-row RLS allows self-write of subscription columns — **still open**.
- Tracker ingest/admin and Stripe webhook path relatively stronger.

**Build / code changes:**

- Added `src/server/keaUserAuth.ts`, `keaPublicSpendGate.ts`, `keaPublicRateLimit.ts`, `src/services/keaAuthHeaders.ts`.
- Gated Netlify + Vite handlers for chat / TTS / transcribe; clients send Bearer.
- Public short welcome translate/TTS kept with IP caps; Whisper always auth + 20MB cap on Netlify.
- Release 1 earlier same day: `v1.0.0` / commit `41883d4` (session welcome blank screen + channel prompt). Unrelated auth-gate work may still be **local uncommitted** until next commit.

**Problems / notes:**

- Windows `gh` via `kea:github` mangles titles with spaces (`Release 1` → use `Release-1` or API).
- Welcome marketing still depends on narrow public spend; authenticated quotas not done yet.
- Stripe MCP: Kea account connected in **livemode**; flipping production to test = Netlify key swap, not MCP alone.
- ~~Still need: open signup vs invite-only~~ — **closed:** not about Play testers; web stays open signup.

**Errors:** none blocking in this session after auth-gate edits (typecheck of full tree not re-run in this step).

---

### 2026-10-01 — Phase B/C: server talk access + public e2e

**Sequence (confirmed):** finish Phase B + C → expand Playwright → then Phase D / AAB. AAB not started.

**Build:**

- `src/server/keaTalkAccessGate.ts` — chat/TTS/Whisper require cloud subscription, 7-day trial from `profiles.created_at`, or admin email (not `localStorage`).
- Wired Vite handlers + Netlify `chat` / `tts` / `transcribe`.
- `docs/admin-security.md` — admin is client email gate; money stays server-side.
- `docs/rls-spot-check.md` — live two-user RLS procedure.
- `e2e/public-pages.spec.ts` — `/support` + `/delete-account` (Playwright **2 passed** after Chromium install).
- `npm run guard` + `npm run build` clean.

**Verified (B8 Auth API):**

- Site URL `https://kea.chat`
- Confirm email on (`mailer_autoconfirm: false`)
- Redirect allowlist includes localhost, kea.chat, keachat.netlify.app
- Password recovery mailer template present

**Owner still does:**

- B9: live two-account RLS spot-check (`docs/rls-spot-check.md`)
- C13: one live Checkout + webhook → talk access
- C15: OpenAI dashboard spend alert
- Commit + Netlify deploy so talk gate is live on kea.chat

**Errors:** none on guard/build/public e2e.

---

## Notes

- Isolation rule remains: use `npm run kea:supabase` / `kea:netlify` / `kea:github` only.
- Prefer fixing real gates (RLS, auth on spendy APIs) over adding more UI-only checks.
- Revisit this file after each launch candidate; tick boxes in git so the next release inherits the bar.
- Keep this Work log updated whenever hardening lands or something fails in testing.
