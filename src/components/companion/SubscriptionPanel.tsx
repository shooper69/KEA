import { useEffect, useState } from 'react'
import {
  activatePlan,
  getTalkAccess,
  refreshBillingStatus,
  trialDaysLeft,
} from '../../architecture/keaBilling'
import {
  applyDiscountCode,
  clearAppliedDiscount,
  discountedPrice,
  getAppliedDiscount,
  type AppliedDiscount,
} from '../../architecture/keaDiscountCodes'
import {
  formatDailyMinutes,
  formatUsd,
  loadPlanCatalog,
  subscribePlanCatalog,
  type KeaPlanCatalog,
  type PlanId,
} from '../../architecture/keaPlans'
import { confirmCheckoutSession, startKeaCheckout } from '../../services/keaPay'

export function SubscriptionPanel({
  email,
  isAdmin,
  onViewUsage,
}: {
  email: string
  isAdmin: boolean
  onViewUsage: () => void
}) {
  const [catalog, setCatalog] = useState<KeaPlanCatalog>(() => loadPlanCatalog())
  const [access, setAccess] = useState(() => getTalkAccess(isAdmin))
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState<PlanId | null>(null)
  const [discountDraft, setDiscountDraft] = useState(
    () => getAppliedDiscount()?.code ?? '',
  )
  const [applied, setApplied] = useState<AppliedDiscount | null>(() =>
    getAppliedDiscount(),
  )

  useEffect(() => {
    function refreshCatalog() {
      setCatalog(loadPlanCatalog())
    }
    refreshCatalog()
    return subscribePlanCatalog(refreshCatalog)
  }, [])

  useEffect(() => {
    refreshBillingStatus()
    setAccess(getTalkAccess(isAdmin))
    const current = getAppliedDiscount()
    setApplied(current)
    if (current?.code) setDiscountDraft(current.code)
    const params = new URLSearchParams(window.location.search)
    const sessionId = params.get('session_id')
    if (params.get('checkout') === 'success' && sessionId) {
      void confirmCheckoutSession(sessionId)
        .then((state) => {
          if (state) {
            clearAppliedDiscount()
            setApplied(null)
            setDiscountDraft('')
            setMessage('You are subscribed. Thank you.')
            setAccess(getTalkAccess(isAdmin))
          }
        })
        .catch(() => {
          setMessage(
            'Payment returned, but Kea could not confirm it yet. Refresh in a moment.',
          )
        })
    }
    if (params.get('checkout') === 'cancel') {
      setMessage('Checkout was cancelled.')
    }
  }, [isAdmin])

  const days = trialDaysLeft()
  const percentOff = applied?.percentOff ?? 0

  function priceLabel(monthlyPrice: number) {
    const next = discountedPrice(monthlyPrice, percentOff)
    if (percentOff <= 0) return formatUsd(monthlyPrice)
    if (next <= 0) return 'Free'
    return formatUsd(next)
  }

  function subscribe(plan: (typeof catalog.plans)[number]) {
    setBusy(plan.id)
    setMessage('')
    const price = discountedPrice(plan.monthlyPrice, percentOff)
    if (price <= 0) {
      activatePlan(plan.id, applied ? `discount:${applied.code}` : 'discount')
      clearAppliedDiscount()
      setApplied(null)
      setAccess(getTalkAccess(isAdmin))
      setMessage(
        applied
          ? `Subscribed with “${applied.code}” — no charge.`
          : 'Subscribed — no charge.',
      )
      setBusy(null)
      return
    }
    void startKeaCheckout({
      planId: plan.id,
      planName: plan.name,
      monthlyPrice: price,
      stripePriceId: percentOff > 0 ? '' : plan.stripePriceId,
      email,
    }).catch((error: unknown) => {
      setMessage(
        error instanceof Error ? error.message : 'Could not start payment.',
      )
      setBusy(null)
    })
  }

  return (
    <section className="settings-card settings-card--plans">
      <p className="settings-note settings-note--lead">{catalog.trialBlurb}</p>
      <p className="settings-note settings-note--status">
        {access.status === 'active' && access.planId
          ? `You are on ${catalog.plans.find((item) => item.id === access.planId)?.name ?? 'a paid plan'}. ${formatDailyMinutes(access.dailyMinutesAllowed)}.`
          : access.status === 'expired'
            ? 'Your trial has expired. Choose a plan to keep talking.'
            : `${days} day${days === 1 ? '' : 's'} left on the trial · ${catalog.trialDailyMinutes} minutes a day.`}{' '}
        <button type="button" className="settings-usage-link" onClick={onViewUsage}>
          Click here to view Usage
        </button>
      </p>

      <div className="discount-code">
        <div className="discount-code__row">
          <span className="discount-code__label">Discount code</span>
          <input
            type="text"
            className="discount-code__input"
            value={discountDraft}
            placeholder="Enter a code"
            autoComplete="off"
            aria-label="Discount code"
            onChange={(event) => {
              const next = event.target.value
              setDiscountDraft(next)
              if (next.trim()) return
              if (!applied) return
              clearAppliedDiscount()
              setApplied(null)
              setMessage('')
            }}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return
              event.preventDefault()
              try {
                const next = applyDiscountCode(discountDraft)
                setApplied(next)
                setMessage(
                  next.percentOff >= 100
                    ? `Code “${next.code}” applied — plans are free.`
                    : `Code “${next.code}” applied — ${next.percentOff}% off.`,
                )
              } catch (caught) {
                setMessage(
                  caught instanceof Error
                    ? caught.message
                    : 'Could not apply that code.',
                )
              }
            }}
          />
          <button
            type="button"
            className="kea-button discount-code__apply"
            onClick={() => {
              try {
                const next = applyDiscountCode(discountDraft)
                setApplied(next)
                setMessage(
                  next.percentOff >= 100
                    ? `Code “${next.code}” applied — plans are free.`
                    : `Code “${next.code}” applied — ${next.percentOff}% off.`,
                )
              } catch (caught) {
                setMessage(
                  caught instanceof Error
                    ? caught.message
                    : 'Could not apply that code.',
                )
              }
            }}
          >
            Apply
          </button>
          {applied ? (
            <button
              type="button"
              className="discount-code__clear"
              onClick={() => {
                clearAppliedDiscount()
                setApplied(null)
                setDiscountDraft('')
                setMessage('Discount removed.')
              }}
            >
              Clear
            </button>
          ) : null}
        </div>
        {applied ? (
          <p className="discount-code__active">
            Active: <strong>{applied.code}</strong> · {applied.percentOff}% off
          </p>
        ) : null}
      </div>

      {message ? <p className="settings-note">{message}</p> : null}
      <div className="plan-grid">
        {catalog.plans.map((plan) => {
          const price = discountedPrice(plan.monthlyPrice, percentOff)
          return (
            <article
              key={plan.id}
              className={`plan-card${plan.featured ? ' plan-card--featured' : ''}${
                access.planId === plan.id ? ' is-current' : ''
              }`}
            >
              <h3>{plan.name}</h3>
              <p className="plan-card__price">
                {priceLabel(plan.monthlyPrice)}
                {price > 0 ? <span> / month</span> : null}
                {percentOff > 0 && plan.monthlyPrice > 0 ? (
                  <span className="plan-card__was">
                    {' '}
                    was {formatUsd(plan.monthlyPrice)}
                  </span>
                ) : null}
              </p>
              <p className="plan-card__tagline">{plan.tagline}</p>
              <p className="plan-card__minutes">
                {formatDailyMinutes(plan.dailyMinutes)}
              </p>
              <ul>
                {plan.bullets.map((line, index) => (
                  <li key={`${plan.id}-${index}`}>{line}</li>
                ))}
              </ul>
              <button
                type="button"
                className="kea-button"
                disabled={busy !== null || access.planId === plan.id}
                onClick={() => subscribe(plan)}
              >
                {access.planId === plan.id
                  ? 'Current plan'
                  : busy === plan.id
                    ? price <= 0
                      ? 'Activating…'
                      : 'Opening Stripe…'
                    : price <= 0
                      ? 'Subscribe free'
                      : `Subscribe · ${formatUsd(price)}`}
              </button>
            </article>
          )
        })}
      </div>
    </section>
  )
}
