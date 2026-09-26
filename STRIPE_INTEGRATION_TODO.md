# Stripe integration TODO (Kea)

Scenario **A** applied: Kea already creates Checkout Sessions in
[`src/server/handleKeaBilling.ts`](src/server/handleKeaBilling.ts) via
`POST https://api.stripe.com/v1/checkout/sessions` (form body, no Stripe SDK).

Checkout Studio `fixed_by_ui` parameters were merged into that call. Existing
Kea `sample_only` values (`mode`, `success_url`, `cancel_url`, `line_items`)
were **kept** — they are live Kea values, not Studio placeholders.

## Values to replace

No Studio placeholders remain in the Checkout Session create call.

| Field | Current value | Notes |
|-------|---------------|-------|
| mode | `subscription` | Correct for Kea recurring tiers. |
| success_url | `/subscription?checkout=success&session_id={CHECKOUT_SESSION_ID}` | Real Kea URL (origin from client, fallback `https://kea.chat/...`). |
| cancel_url | `/subscription?checkout=cancel` | Real Kea URL. |
| line_items | Catalog Price IDs (`price_1UJqsa…` / `price_1UJqsb…` / `price_1UJqsd…`) or discounted `price_data` | From Admin → Subscription / [`src/architecture/keaPlans.ts`](src/architecture/keaPlans.ts). |

**ui_mode:** Kea does not use the Stripe Node SDK. Set to `hosted_page` (API enum). If you later add `stripe` npm ≥ 21.0.0, keep `hosted_page`; older SDKs use `hosted`.

## Configured parameters

**File:** [`src/server/handleKeaBilling.ts`](src/server/handleKeaBilling.ts)

| Parameter | Value |
|-----------|-------|
| ui_mode | hosted_page |
| billing_address_collection | auto |
| phone_number_collection.enabled | false |
| automatic_tax.enabled | false |
| allow_promotion_codes | true |
| payment_method_collection | always |
| submit_type | auto |
| saved_payment_method_options.payment_method_save | enabled |
| integration_identifier | hosted_web_0001 |
| origin_context | web |

Kea also sets (not from Checkout Studio, required for access sync):
`metadata.planId`, `metadata.userId`, `subscription_data.metadata`, `client_reference_id`, optional `customer_email`.

## Setup and next steps

### Environment variables

| Variable | Where | Purpose |
|----------|--------|---------|
| `STRIPE_SECRET_KEY` | Netlify `keachat` + local `.env.local` | Checkout, portal, session confirm (server only — never `VITE_`) |
| `STRIPE_WEBHOOK_SECRET` | Netlify `keachat` + local `.env.local` | Verify `POST /api/billing/webhook` |
| `SUPABASE_URL` | Netlify (and optional local) | Webhook profile upsert |
| `SUPABASE_SERVICE_ROLE_KEY` | Netlify (server only) | Webhook profile upsert |

Template: [`.env.example`](.env.example). Local secrets go in `.env.local` (gitignored).

Webhook endpoint (live): `https://kea.chat/api/billing/webhook`  
Signing secret copy (gitignored): `.kea/stripe-webhook-secret`

### How it works

1. User chooses a plan on `/subscription` → `POST /api/billing/checkout`.
2. Server creates a Hosted Checkout Session (`ui_mode=hosted_page`, `mode=subscription`).
3. Browser redirects to Stripe; on return Kea confirms via `GET /api/billing/session`.
4. Webhooks keep `profiles` subscription fields in sync; client applies them on sign-in.

### Testing

- Live catalog is documented in Admin → Stripe. Prefer a small live charge or Stripe test mode only with a test key.
- Cards: https://docs.stripe.com/testing

### Still do

1. **Add `STRIPE_SECRET_KEY`** (`sk_live_…` for Kea account `acct_1UJfe36G7iCRQAR8`) to Netlify site **keachat** and to `.env.local`. It was not present on Netlify when this file was written — Checkout cannot run without it. Dashboard: https://dashboard.stripe.com/apikeys
2. Confirm `STRIPE_WEBHOOK_SECRET` is on Netlify (created/updated from `.kea/stripe-webhook-secret`) and mirrored in `.env.local`.
3. Redeploy Netlify after env changes so the billing function picks up secrets.
4. Run one Checkout end-to-end and confirm profile `subscription_status` updates.

### Resources

- https://support.stripe.com  
- https://docs.stripe.com/mcp  
- https://docs.stripe.com/payments/checkout
