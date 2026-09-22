import { useEffect, useState } from 'react'
import {
  getTalkAccess,
  refreshBillingStatus,
  trialDaysLeft,
} from '../../architecture/keaBilling'
import {
  formatDailyMinutes,
  formatUsd,
  loadPlanCatalog,
  type PlanId,
} from '../../architecture/keaPlans'
import { confirmCheckoutSession, startKeaCheckout } from '../../services/keaPay'

export function SubscriptionPanel({
  email,
  isAdmin,
}: {
  email: string
  isAdmin: boolean
}) {
  const catalog = loadPlanCatalog()
  const [access, setAccess] = useState(() => getTalkAccess(isAdmin))
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState<PlanId | null>(null)

  useEffect(() => {
    refreshBillingStatus()
    setAccess(getTalkAccess(isAdmin))
    const params = new URLSearchParams(window.location.search)
    const sessionId = params.get('session_id')
    if (params.get('checkout') === 'success' && sessionId) {
      void confirmCheckoutSession(sessionId)
        .then((state) => {
          if (state) {
            setMessage('You are subscribed. Thank you.')
            setAccess(getTalkAccess(isAdmin))
          }
        })
        .catch(() => {
          setMessage('Payment returned, but Kea could not confirm it yet. Refresh in a moment.')
        })
    }
    if (params.get('checkout') === 'cancel') {
      setMessage('Checkout was cancelled.')
    }
  }, [isAdmin])

  const days = trialDaysLeft()

  return (
    <section className="settings-card">
      <h2>Subscriptions</h2>
      <p className="settings-note">{catalog.trialBlurb}</p>
      <p className="settings-note">
        {access.status === 'active' && access.planId
          ? `You are on ${catalog.plans.find((item) => item.id === access.planId)?.name ?? 'a paid plan'}. ${formatDailyMinutes(access.dailyMinutesAllowed)}.`
          : access.status === 'expired'
            ? 'Your trial has expired. Choose a plan to keep talking.'
            : `${days} day${days === 1 ? '' : 's'} left on the trial · ${catalog.trialDailyMinutes} minutes a day · ${access.minutesUsedToday.toFixed(1)} used today.`}
      </p>
      {isAdmin ? (
        <p className="settings-note">
          Admin accounts can talk without a paid plan, for testing.
        </p>
      ) : null}
      {message ? <p className="settings-note">{message}</p> : null}
      <div className="plan-grid">
        {catalog.plans.map((plan) => (
          <article
            key={plan.id}
            className={`plan-card${plan.featured ? ' plan-card--featured' : ''}${
              access.planId === plan.id ? ' is-current' : ''
            }`}
          >
            <h3>{plan.name}</h3>
            <p className="plan-card__price">
              {formatUsd(plan.monthlyPrice)}
              <span> / month</span>
            </p>
            <p className="settings-note">{plan.tagline}</p>
            <p className="settings-note">{formatDailyMinutes(plan.dailyMinutes)}</p>
            <ul>
              {plan.bullets.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <button
              type="button"
              className="kea-button"
              disabled={busy !== null || access.planId === plan.id}
              onClick={() => {
                setBusy(plan.id)
                setMessage('')
                void startKeaCheckout({
                  planId: plan.id,
                  planName: plan.name,
                  monthlyPrice: plan.monthlyPrice,
                  stripePriceId: plan.stripePriceId,
                  email,
                })
                  .catch((error: unknown) => {
                    setMessage(
                      error instanceof Error
                        ? error.message
                        : 'Could not start payment.',
                    )
                    setBusy(null)
                  })
              }}
            >
              {access.planId === plan.id
                ? 'Current plan'
                : busy === plan.id
                  ? 'Opening Stripe…'
                  : `Subscribe · ${formatUsd(plan.monthlyPrice)}`}
            </button>
          </article>
        ))}
      </div>
    </section>
  )
}
