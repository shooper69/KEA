# Kea pricing model

Living document for stack COGS, margin targets, tier prices/caps, and market positioning.  
Update this file as OpenAI rates, plan catalog, or rival pricing change.

**Last updated:** 2026-10-06  
**Related canvases (optional UI):** Cursor canvases `kea-pricing-model` / `kea-market-pricing`  
**Product catalog code:** `src/architecture/keaPlanCatalog.ts` / `keaPlans.ts`  
**Live optimizer:** Admin → Costs (`/admin/costs`) — see §8

---

## 1. Goal

Price three paid tiers so that a subscriber who uses their **full monthly talk entitlement** (planning month = 30 days) still leaves about a **50% gross margin** on AI stack costs (optionally after Stripe fees). Daily minutes are a soft pacing guide only — the commercial SKU is monthly hours.

**Margin definition used here**

\[
\text{Gross margin} = \frac{\text{Net revenue} - \text{COGS}}{\text{Net revenue}} = 50\%
\quad\Rightarrow\quad
\text{Net} = 2 \times \text{COGS}
\]

With Stripe: \(\text{Net} = \text{Price} \times (1 - 0.029) - \$0.30\).

Without Stripe: \(\text{Net} = \text{Price}\).

Then \(\text{Price} = \dfrac{\text{Net needed} + \$0.30}{0.971}\) when Stripe is included.

---

## 2. AI stack (what we pay OpenAI for)

| Layer | Model / API | List rate (as of research) |
| --- | --- | --- |
| Chat (LLM) | `gpt-4o-mini` Chat Completions | **$0.15** / 1M input tokens · **$0.60** / 1M output tokens |
| Speech → text | `whisper-1` transcriptions | **$0.006** / minute of audio |
| Text → speech | `gpt-4o-mini-tts` (fallback `tts-1-hd`) | ~**$0.015** / minute of audio (OpenAI estimate; also billed as text in + audio out tokens) |

Kea routes: `/api/chat`, `/api/transcribe`, `/api/tts` (Netlify + local handlers).

**Not in this COGS model yet:** Netlify, Supabase, support, CAC, tax, App Store cut (if any), or admin/marketing TTS outside paid talk.

### OpenAI account in use (identity / isolation)

Checked 2026-10-06 against the local Kea `OPENAI_API_KEY` (`.env.local`; same env name on Netlify `keachat` production).

| Field | Value |
| --- | --- |
| Key shape | Project key (`sk-proj…`, fingerprint `sk-proj…zZQA`) |
| OpenAI user name | **Investech** |
| OpenAI login email | **team@investech.app** |
| User id | `user-axb1yDSRJ1rNMGa17cu7xbCf` |
| Default org | `org-fUQbodSgbGeUAu8B9IRbvpM3` (role: owner) |

**Implication for COGS / isolation:** Kea talk spend is currently landing on the **Investech** OpenAI account, not a Kea-only org. For clean margin tracking and Kea isolation, create a **Kea-only** OpenAI project + key, set `OPENAI_API_KEY` on Netlify `keachat` + local env, then rotate the old key.

**How to pull usage / analytics safely (do not paste keys or passwords into chat)**

1. Prefer dashboard: [platform.openai.com](https://platform.openai.com) → Usage / Costs for that org.  
2. Or create an **Admin API key** (Settings → Admin keys), store only in gitignored `.kea/openai-admin-key`, and use OpenAI Admin Usage / Costs APIs.  
3. Never share the OpenAI password or paste production keys into Cursor chat.

Confirm production still matches by checking Netlify → `keachat` → Environment → `OPENAI_API_KEY` (presence only; do not copy into chat).

---

## 3. Unit cost: $ per billed talk minute

Kea bills **conversation / talk minutes** (see talk timer / daily minutes in billing).  
Per billed minute we allocate:

- Fraction of minute that is **user audio** → Whisper  
- Fraction that is **Kea audio** → TTS  
- Number of **chat turns** × tokens → `gpt-4o-mini`

### Intensity presets

| Intensity | User speak | Kea speak | Turns / min | Input tok / turn | Output tok / turn |
| --- | --- | --- | ---: | ---: | ---: |
| Light | 35% | 25% | 1.2 | 1 600 | 45 |
| **Typical (default)** | **42%** | **33%** | **1.6** | **2 200** | **55** |
| Heavy | 50% | 45% | 2.2 | 3 800 | 90 |

### Typical unit COGS (default planning number)

| Component | ≈ $/talk-min |
| --- | ---: |
| Whisper (STT) | ~$0.0025 |
| TTS | ~$0.0050 |
| Chat | ~$0.0005 |
| **Total** | **≈ $0.008–$0.012** |

**Planning figure used in recommendations:** treat **~$0.01 / talk-minute** as a round typical COGS, and re-run with Heavy (~$0.012+) when reply length or TTS share rises.

Formula sketch:

```
stt  = userSpeakFrac * 0.006
tts  = keaSpeakFrac  * 0.015
chat = turnsPerMin * (inputTok * 0.15 + outputTok * 0.60) / 1e6
cogsPerMin = stt + tts + chat
```

---

## 4. Current Kea catalog (product)

From `DEFAULT_PLAN_CATALOG` in `keaPlans.ts`:

| Plan | Monthly price | Daily talk cap | Month max (×30) |
| --- | ---: | ---: | ---: |
| Trial | $0 (7 days) | 10 min/day | — |
| **Starter** | **$9.99** | **15 min** | 450 min |
| **Companion** (featured) | **$19.99** | **45 min** | 1 350 min |
| **Unlimited** | **$34.99** | **No hard cap** | Soft-cost at **90 min/day** fair use → 2 700 min |

Stripe Price IDs live in the same catalog (update Dashboard if prices change).

---

## 5. Full-use economics at 50% margin

Assume **typical** intensity, **30-day** month, **Stripe on**.

Rough full-use COGS ≈ `dailyCap × 30 × $0.01`.

| Plan | Month max | ≈ COGS @ $0.01/min | Net needed (50% margin) | Directional price @ 50% + Stripe |
| --- | ---: | ---: | ---: | ---: |
| Starter (15) | 450 | ~$4.50 | ~$9.00 | ~**$10–11** |
| Companion (45) | 1 350 | ~$13.50 | ~$27.00 | ~**$28–33** |
| Unlimited (soft 90) | 2 700 | ~$27.00 | ~$54.00 | ~**$56–65** |

### Safe daily caps if we **keep today’s prices** (50% margin, Stripe on)

Max minutes ≈ \((\text{Net from price}) \times 0.5) / \text{cogsPerMin}\), then ÷ 30 for daily.

| Plan | Current price | Approx safe daily @ 50% | Current daily |
| --- | ---: | ---: | ---: |
| Starter | $9.99 | ~**14 min** | 15 min (tight / OK) |
| Companion | $19.99 | ~**28–30 min** | **45 min (over-provisioned)** |
| Unlimited | $34.99 | ~**50–55 min** soft | No hard cap |

**Main finding:** Companion at **$19.99 / 45 min/day** does **not** clear 50% margin if users max the cap every day. Either **raise price**, **cut daily cap (~30)**, or accept lower margin / lower utilization.

---

## 6. Balanced recommendation (working target)

| Plan | Recommended price | Recommended cap | Rationale |
| --- | ---: | --- | --- |
| **Starter** | **$9.99–$10.99** | **15 min/day** | Aligns with ~50% at full use; market entry next to Praktika |
| **Companion** | **~$20–25** *or keep $19.99* | **30 min/day** if price stays ~$20 | Matches Langua Standard-style caps; fixes margin hole vs 45 min |
| **Unlimited** | **~$30–35** short-term; **~$55–65** if fair-use is high | Soft **fair use ~60–90 min/day** | True uncapped burns AI margin; publish fair use |

Optional later: **annual SKUs** — rivals look much cheaper on yearly billing ($7–$14/mo effective).

---

## 7. Market comparison (US, researched 2026-10)

Directional list / App Store prices; confirm at checkout.

| Product | Monthly | Annual (eff. /mo) | Usage / limits | Notes |
| --- | ---: | ---: | --- | --- |
| **Kea Starter** | **$9.99** | — | 15 min/day | Kea |
| **Kea Companion** | **$19.99** | — | 45 min/day | Kea featured |
| **Kea Unlimited** | **$34.99** | — | No hard cap | Kea |
| Speak Premium | $17.99 | ~$7.00 ($83.99/yr) | Core AI speaking | Closest speaking rival |
| Speak Premium Plus | $39.99 | ~$13.75 ($164.99/yr) | Unlimited personalization | Above Kea Unlimited monthly |
| TalkPal Premium | $19.99 | ~$10.00 ($119.99/yr) | Unlimited modes | Free: ~10 min/day |
| Langua Standard | $19.99 | ~$12.50 ($149.99/yr) | ~30 min call / 75 msgs/day | Same sticker, tighter cap than Companion |
| Langua Unlimited | $29.99 | ~$16.67 ($199.99/yr) | Uncapped practice | Below Kea Unlimited monthly |
| Praktika Premium | $9.99 | ~$10.00 ($119.99/yr) | Premium avatars | Matches Starter monthly |
| Duolingo Max | $29.99 | ~$14.00 ($167.99/yr) | Roleplay / Video Call | Course-first AI add-on |
| Duolingo Super | ~$13–14 | ~$7–8 | Energy / no ads | Not a talk companion |
| ELSA Speak Premium | ~$19.99 | ~$13 (web annual) | Pronunciation | English-focused |
| Babbel | $17.95 | $8.95 ($107.40/yr) | Course content | Not open AI chat |

**Positioning takeaway:** Companion sits in the crowded **~$18–20/mo AI talk** band with TalkPal and Langua, but with a **richer daily minute cap** than Langua Standard — good marketing, stressed unit economics.

---

## 8. What we built: `/admin/costs` (Approach B)

This is the **operating system for Kea pricing**, not a spreadsheet snapshot.  
It turns real OpenAI spend and Stripe-style revenue into **monthly price and monthly-allowance recommendations** that still clear a **50% gross margin** in the worst case.

There is **no** `OPENAI_ADMIN_KEY` and no Organization Costs API in V1. Kea records its own meters on every inference call, prices them with a rate card, and joins that to subscription revenue.

### Proposition

TTS and Whisper are the expensive layers. If subscribers use their full monthly entitlement, Companion at $19.99 / 22.5 h/month can lose money. The admin page exists so we can answer, at any time:

| Question | How the page answers it |
| --- | --- |
| Is this plan profitable? | Gross margin after **Stripe fees + OpenAI COGS** at full monthly entitlement |
| How many hours/month can we include? | Recommended monthly allowance at current price |
| What should the monthly price be? | Recommended sticker for current allowance |
| Which plan is underpriced? | Traffic light on **full monthly entitlement × heavy** margin |
| What margin at full consumption? | Margin now vs margin if recommendation applied |
| Which users / features / models cost most? | Ranked OpenAI $ breakdowns |

**Margin rule (locked):**  
Revenue − Stripe (2.9% + $0.30 per sub) − OpenAI estimated cost = gross profit.  
Target: gross profit ≥ **50% of net-after-Stripe**. That means net-after-Stripe must be at least **2 × OpenAI COGS**. Green &gt; 60%, amber 50–60%, red &lt; 50%.

**Worst-case intensity (locked):** every subscriber uses their **entire monthly entitlement** (soft daily pace × 30), at **heavy** talk density (50% user audio, 45% Kea audio, 2.2 turns/min). Unlimited is costed at **90 min/day × 30 = 45 h/month** fair use.

**Optimizer policy:** if a plan is red (&lt; 50%), **cut the monthly allowance first** (keep the sticker price) down to a monthly floor (Starter 4 h, Companion 10 h, Unlimited fair-use 22.5 h). Only **raise price** if the allowance cannot go lower.

**Apply to Catalog:** recommendations never write Stripe products/prices. Admins apply price and/or hours to the local plan catalog (Admin → Plans), then update Stripe Dashboard Price IDs separately.

**Rate card:** OpenAI list rates live in Supabase `ai_rate_card` (editable on Costs). Handlers fall back to code defaults if the row is missing.

### Data used

| Source | What | Why |
| --- | --- | --- |
| `ai_usage_events` (Supabase, service role) | One row per OpenAI call | User/feature/model cost that OpenAI’s org APIs cannot give us |
| Chat Completions `usage` | `prompt_tokens`, `completion_tokens` | Exact chat meters (Kea used to discard these) |
| Whisper `verbose_json.duration` | `audio_seconds` | STT billed by audio time |
| TTS input length | `tts_characters` + model used | TTS is the largest COGS; include welcome/public lines |
| Request metadata | `user_id`, email, `feature`, `request_type`, `plan_id_at_time`, `request_id`, timestamp | Attribution for “who / what / which tier” |
| Rate card (`ai_rate_card` + code defaults) | Whisper $/min, chat $/1M tok, TTS token or $/1M chars | Convert meters → **estimated USD** (invoice-true $ is Phase 2) |
| `profiles` | `subscription_plan_id`, `subscription_status` | **MRR** and mix of paid users |
| Plan catalog | Starter / Companion / Unlimited prices and caps | Current vs recommended |
| Stripe formula (not live invoices in V1) | 2.9% + $0.30 × paid-sub count | Net revenue after processing fees |

**Not used in V1:** OpenAI Admin Usage/Costs APIs, staff, hosting, marketing, tax, App Store cut.

**Cold start:** until about **50 logged events**, COGS/minute is the **planning** heavy figure (~$0.01–$0.012). After that, the optimizer uses the **stricter** of planning vs observed (observed ≈ window OpenAI $ ÷ estimated talk minutes from audio seconds + TTS).

Logged features (closed set): `conversation_chat`, `translation`, `plain_translation`, `transcription`, `tts`, `welcome_tts`, `other`. Anonymous welcome TTS has nullable `user_id`.

### Outputs that enable pricing optimization

Open **Admin → Costs**. Window: 7 / 30 / 90 days (OpenAI $ in the window is scaled to a 30-day equivalent when compared with MRR).

1. **Overview** — Revenue (current MRR), Stripe fees, net after Stripe, OpenAI (window and /30 days), gross profit, **gross margin %**, traffic light, paid-sub count. This is the “are we profitable?” line.
2. **Cost by user** — Events, window AI $, catalog revenue, monthly profit (net after Stripe − scaled AI $). Identifies heavy users who would break a tier.
3. **Cost by feature** — Where money goes (especially TTS vs Whisper vs chat). Tells us whether to shorten Kea’s replies, cache welcome TTS, or change STT chunking — not only list prices.
4. **Cost by model** — Confirms `gpt-4o-mini-tts` / Whisper share vs cheap chat.
5. **Cost by plan** — Spend tagged with `plan_id_at_time` (trial / starter / companion / unlimited).
6. **Monthly pricing optimizer** — For each plan:

   | Output | Use |
   | --- | --- |
   | Current / recommended **monthly price** | Sticker so full monthly entitlement × heavy still hits 50% after Stripe |
   | Current / recommended **monthly allowance** | Hours/month the current price can afford at 50% (soft daily pace shown second) |
   | Monthly COGS / net after Stripe | Unit economics at full entitlement |
   | Margin now vs margin if applied | Proof the change restores the floor |
   | Status (green / amber / red) | Which SKUs are unsafe today |
   | Action | `cut_allowance` or `raise_price` (or OK / trial watch) |
   | Apply to Catalog | Writes local Admin → Plans catalog only — **not** Stripe |

   Recommended price is charm-rounded to **.99**. Soft daily pace = monthly minutes ÷ 30.

7. **OpenAI rate card** — Edit list rates without a code deploy; last-updated + fallback to code defaults.

8. **Forecast** — 100 / 1 000 / 10 000 / 100 000 users using **current paid mix** (equal 1/3 if none). Two columns: **worst-case** (full monthly entitlement × heavy) and **observed** (this window’s $ per paid user). Scale only if worst-case stays ≥ 50%.

### How to act on it

- Red Companion at 22.5 h/month → cut toward **~14–15 h/month** at $19.99, **or** keep 22.5 h and raise toward **~$28–33**.
- Apply preferred actions to the local catalog, then create new Stripe Prices if the sticker changes.
- Recheck after real traffic: if observed $/min exceeds planning, the optimizer will tighten further.
- Phase 2 (optional): OpenAI Admin Costs API on a **Kea-only** project to reconcile estimated $ vs invoice.

**Code:** logging in chat / transcribe / TTS handlers; report in `src/server/aiUsage/`; UI `AdminCostAnalysisPage`; math `keaCostsMath.ts`.

---

## 9. How to update this doc

When something changes, edit the matching section and bump **Last updated**.

1. **OpenAI rates** — §2 and recompute §3–§5.  
2. **OpenAI account / key** — §2 identity table (org, email, fingerprint); re-check after rotating to a Kea-only project.  
3. **Intensity** (longer replies, more TTS) — §3 presets / planning $/min.  
4. **Catalog** — §4 from `keaPlanCatalog.ts` + Stripe Dashboard.  
5. **Margin target** — §1 and §5 (40% / 50% / 60%).  
6. **Rivals** — §7 (App Store / vendor pricing pages).  
7. **Live optimizer** — §8 (`/admin/costs`); re-read after traffic accumulates.  
8. **Ship** — if prices/caps change in product, update `DEFAULT_PLAN_CATALOG`, Stripe Price IDs, and subscription copy.

### Quick recalculation checklist

- [ ] New `cogsPerMin`  
- [ ] Month COGS = monthlyMinutes × cogsPerMin (Unlimited: 45 h fair-use month)  
- [ ] Net needed = COGS / (1 − margin)  
- [ ] Price = (Net needed + 0.30) / 0.971 if Stripe included  
- [ ] Charm-round to .99  
- [ ] Compare to §7 market band  

---

## 10. Changelog

| Date | Change |
| --- | --- |
| 2026-10-06 | Initial model: stack COGS, 50% margin, current tiers, market table, Companion risk callout |
| 2026-10-06 | Documented live OpenAI account (Investech / team@investech.app), isolation note, safe usage-analytics access |
| 2026-10-06 | Approach B: `/admin/costs` logs every OpenAI call; 50% margin after Stripe + AI; worst-case full-cap optimizer |
| 2026-10-06 | §8 expanded: proposition, data sources, and optimizer outputs for pricing/caps |
| 2026-10-06 | Monthly SKU redesign: hours/month primary, soft daily pace, DB rate card, Apply to Catalog |
