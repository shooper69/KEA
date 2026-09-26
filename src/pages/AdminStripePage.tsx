import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  formatUsd,
  loadPlanCatalog,
  subscribePlanCatalog,
  type KeaPlan,
} from '../architecture/keaPlans'

/** Live Kea Stripe account + catalog prices created for the three tiers. */
const KEA_STRIPE = {
  accountName: 'Kea (US)',
  accountId: 'acct_1UJfe36G7iCRQAR8',
  livemode: true,
  currency: 'usd',
  dashboardProducts:
    'https://dashboard.stripe.com/products?active=true',
  dashboardApiKeys: 'https://dashboard.stripe.com/apikeys',
  dashboardWebhooks: 'https://dashboard.stripe.com/webhooks',
  dashboardPayouts: 'https://dashboard.stripe.com/settings/payouts',
  webhookUrl: 'https://kea.chat/api/billing/webhook',
  products: [
    {
      planId: 'starter' as const,
      productId: 'prod_VKVuMNMEKpMfFU',
      priceId: 'price_1UJqsa6G7iCRQAR8Scrj3QK0',
      amount: 999,
    },
    {
      planId: 'companion' as const,
      productId: 'prod_VKVuWFIXakryzw',
      priceId: 'price_1UJqsb6G7iCRQAR8eywbl44K',
      amount: 1999,
    },
    {
      planId: 'unlimited' as const,
      productId: 'prod_VKVuPlBeGKqjor',
      priceId: 'price_1UJqsd6G7iCRQAR87yJmgO4R',
      amount: 3499,
    },
  ],
}

function centsLabel(cents: number) {
  return formatUsd(cents / 100)
}

function planById(plans: KeaPlan[], id: string) {
  return plans.find((plan) => plan.id === id)
}

export function AdminStripePage() {
  const [catalog, setCatalog] = useState(loadPlanCatalog)

  useEffect(() => subscribePlanCatalog(() => setCatalog(loadPlanCatalog())), [])

  return (
    <>
      <section className="settings-card">
        <h2>Stripe</h2>
        <p className="settings-note">
          How Kea takes subscription payments. This is the Kea Stripe account
          only — never wire another product’s keys or price IDs here.
        </p>
      </section>

      <section className="settings-card">
        <h2>Account</h2>
        <dl className="voice-diag stripe-admin__diag">
          <div>
            <dt>Account</dt>
            <dd>
              {KEA_STRIPE.accountName} · {KEA_STRIPE.accountId}
            </dd>
          </div>
          <div>
            <dt>Mode</dt>
            <dd>{KEA_STRIPE.livemode ? 'Live' : 'Test'} · {KEA_STRIPE.currency.toUpperCase()}</dd>
          </div>
          <div>
            <dt>Payouts</dt>
            <dd>
              Confirmed on this account: COLUMN NA MERCURY (default payout bank,
              last4 6910). Manage in{' '}
              <a href={KEA_STRIPE.dashboardPayouts} target="_blank" rel="noreferrer">
                Payout settings
              </a>
              — not in app code.
            </dd>
          </div>
          <div>
            <dt>Dashboard</dt>
            <dd>
              <a href={KEA_STRIPE.dashboardProducts} target="_blank" rel="noreferrer">
                Products
              </a>
              {' · '}
              <a href={KEA_STRIPE.dashboardApiKeys} target="_blank" rel="noreferrer">
                API keys
              </a>
              {' · '}
              <a href={KEA_STRIPE.dashboardWebhooks} target="_blank" rel="noreferrer">
                Webhooks
              </a>
            </dd>
          </div>
        </dl>
      </section>

      <section className="settings-card">
        <h2>Products and prices</h2>
        <p className="settings-note">
          Live monthly prices created to match Admin → Subscription tiers.
          Checkout prefers the Stripe Price ID on each plan; if that field is
          empty it falls back to ad-hoc <code>price_data</code> from the
          displayed monthly amount.
        </p>
        <div className="stripe-admin__table-wrap">
          <table className="stripe-admin__table">
            <thead>
              <tr>
                <th>Plan</th>
                <th>Product</th>
                <th>Price</th>
                <th>Catalog amount</th>
                <th>Saved Price ID</th>
              </tr>
            </thead>
            <tbody>
              {KEA_STRIPE.products.map((row) => {
                const plan = planById(catalog.plans, row.planId)
                const saved = plan?.stripePriceId?.trim() || ''
                const match = saved === row.priceId
                return (
                  <tr key={row.planId}>
                    <td>
                      <strong>{plan?.name ?? row.planId}</strong>
                      <br />
                      <span className="stripe-admin__muted">{row.planId}</span>
                    </td>
                    <td>
                      <code>{row.productId}</code>
                    </td>
                    <td>
                      <code>{row.priceId}</code>
                      <br />
                      <span className="stripe-admin__muted">
                        {centsLabel(row.amount)} / month
                      </span>
                    </td>
                    <td>
                      {plan ? formatUsd(plan.monthlyPrice) : '—'}
                      {plan && Math.round(plan.monthlyPrice * 100) !== row.amount ? (
                        <>
                          <br />
                          <span className="stripe-admin__warn">
                            Differs from Stripe price
                          </span>
                        </>
                      ) : null}
                    </td>
                    <td>
                      {saved ? <code>{saved}</code> : '—'}
                      <br />
                      <span
                        className={
                          match ? 'stripe-admin__ok' : 'stripe-admin__warn'
                        }
                      >
                        {saved
                          ? match
                            ? 'Matches live price'
                            : 'Does not match catalog default'
                          : 'Using default / price_data fallback'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="settings-note">
          Edit Price IDs and amounts in{' '}
          <Link to="/admin/tiers">Admin → Subscription</Link>.
        </p>
      </section>

      <section className="settings-card">
        <h2>Secrets (server only)</h2>
        <p className="settings-note">
          Never put Stripe secrets in <code>VITE_</code> variables. Kea reads
          them only on the server (Vite billing middleware locally, Netlify
          Functions in production).
        </p>
        <dl className="voice-diag stripe-admin__diag">
          <div>
            <dt>STRIPE_SECRET_KEY</dt>
            <dd>
              Live secret key (<code>sk_live_…</code>) for account{' '}
              {KEA_STRIPE.accountId}. Required for checkout, session confirm, and
              billing portal. Set in Netlify env and local <code>.env</code>.
            </dd>
          </div>
          <div>
            <dt>STRIPE_WEBHOOK_SECRET</dt>
            <dd>
              Signing secret (<code>whsec_…</code>) for{' '}
              <code>{KEA_STRIPE.webhookUrl}</code>. Required to verify events and
              update <code>profiles</code> subscription fields.
            </dd>
          </div>
          <div>
            <dt>SUPABASE_SERVICE_ROLE_KEY</dt>
            <dd>
              Service role for Kea Production — used by the webhook handler to
              upsert billing columns on <code>profiles</code> (not exposed to the
              browser).
            </dd>
          </div>
        </dl>
        <p className="settings-note">
          Template: see <code>.env.example</code> in the Kea repo.
        </p>
      </section>

      <section className="settings-card">
        <h2>Checkout process</h2>
        <ol className="stripe-admin__steps">
          <li>
            User picks a plan on <Link to="/subscription">/subscription</Link>{' '}
            (or the leave-offer / paywall path).
          </li>
          <li>
            Browser calls <code>POST /api/billing/checkout</code> with{' '}
            <code>planId</code>, <code>planName</code>, <code>monthlyPrice</code>,{' '}
            <code>stripePriceId</code>, <code>userId</code>, and optional email (
            <code>src/services/keaPay.ts</code>).
          </li>
          <li>
            Server (<code>handleKeaBilling</code>) creates a Stripe Checkout
            Session in <strong>subscription</strong> mode:
            <ul>
              <li>
                Prefer <code>line_items[0][price] = stripePriceId</code> when set.
              </li>
              <li>
                Else build monthly <code>price_data</code> from{' '}
                <code>monthlyPrice</code> (USD cents).
              </li>
              <li>
                Sets <code>metadata.planId</code>, <code>metadata.userId</code>,
                and matching <code>subscription_data.metadata</code>.
              </li>
              <li>
                Success URL:{' '}
                <code>/subscription?checkout=success&amp;session_id=…</code>
              </li>
              <li>
                Cancel URL: <code>/subscription?checkout=cancel</code>
              </li>
            </ul>
          </li>
          <li>
            User pays on Stripe-hosted Checkout, then returns to Kea.
          </li>
          <li>
            Kea calls <code>GET /api/billing/session?id=…</code>. If paid, the
            server upserts the cloud profile and the client runs{' '}
            <code>activatePlan</code> for this device.
          </li>
          <li>
            Webhooks keep access in sync for renewals, cancellations, and failed
            payments (see below).
          </li>
        </ol>
      </section>

      <section className="settings-card">
        <h2>Webhooks and access</h2>
        <p className="settings-note">
          Endpoint: <code>{KEA_STRIPE.webhookUrl}</code>. Signature verified with{' '}
          <code>STRIPE_WEBHOOK_SECRET</code>. Events update Kea Production{' '}
          <code>profiles</code> billing columns; the client applies those fields
          on sign-in.
        </p>
        <dl className="voice-diag stripe-admin__diag">
          <div>
            <dt>checkout.session.completed</dt>
            <dd>Activate subscription (plan + customer + subscription ids).</dd>
          </div>
          <div>
            <dt>customer.subscription.created / updated</dt>
            <dd>Sync plan and status (including past_due).</dd>
          </div>
          <div>
            <dt>customer.subscription.deleted</dt>
            <dd>Mark canceled and revoke talk access.</dd>
          </div>
          <div>
            <dt>invoice.paid</dt>
            <dd>Renewal / recovery — restore active access from the subscription.</dd>
          </div>
          <div>
            <dt>invoice.payment_failed</dt>
            <dd>
              Mark past_due (talk still allowed until Stripe cancels or unpaid).
            </dd>
          </div>
        </dl>
        <p className="settings-note">
          Local talk gate: <code>active</code> / <code>past_due</code> keep
          access; <code>canceled</code> / <code>unpaid</code> revoke it.
        </p>
      </section>

      <section className="settings-card">
        <h2>Other billing routes</h2>
        <dl className="voice-diag stripe-admin__diag">
          <div>
            <dt>POST /api/billing/portal</dt>
            <dd>
              Opens the Stripe Customer Portal for an existing{' '}
              <code>customerId</code> (manage card / cancel). Return URL defaults
              to <code>/subscription</code>.
            </dd>
          </div>
          <div>
            <dt>POST /api/billing/webhook</dt>
            <dd>
              Verified Stripe events → profile subscription fields (see above).
            </dd>
          </div>
        </dl>
      </section>

      <section className="settings-card">
        <h2>Discounts and Price IDs</h2>
        <p className="settings-note">
          Admin discount codes that change the charged amount clear{' '}
          <code>stripePriceId</code> for that checkout so Stripe uses{' '}
          <code>price_data</code> at the discounted monthly figure. Full-price
          checkouts keep the catalog Price ID.
        </p>
      </section>

      <section className="settings-card">
        <h2>Go-live checklist</h2>
        <ul className="stripe-admin__checklist">
          <li>
            Live <code>STRIPE_SECRET_KEY</code> on Netlify site <code>keachat</code>{' '}
            (and local <code>.env</code> for dev).
          </li>
          <li>
            <code>STRIPE_WEBHOOK_SECRET</code> from the webhook endpoint above +
            Supabase service role on the billing function.
          </li>
          <li>
            Each plan’s Stripe Price ID filled in Admin → Subscription (defaults
            already match the live products above).
          </li>
          <li>
            Payout bank is Mercury (or your chosen account) in Stripe Dashboard →
            Payout settings for {KEA_STRIPE.accountId}.
          </li>
          <li>
            Customer Portal enabled in the Stripe Dashboard for the Kea account.
          </li>
          <li>
            Run a real Checkout with a live card (or Stripe test mode only after
            connecting a test account — this page documents the <strong>live</strong>{' '}
            Kea catalog).
          </li>
        </ul>
      </section>
    </>
  )
}
