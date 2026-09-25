import { useEffect, useState } from 'react'
import {
  DEFAULT_PLAN_CATALOG,
  formatDailyMinutes,
  formatUsd,
  loadPlanCatalog,
  savePlanCatalog,
  subscribePlanCatalog,
  type KeaPlan,
  type KeaPlanCatalog,
  type PlanId,
} from '../architecture/keaPlans'
import {
  DEFAULT_DISCOUNT_CODES,
  discountedPrice,
  loadDiscountCodes,
  newDiscountCode,
  saveDiscountCodes,
  type KeaDiscountCode,
} from '../architecture/keaDiscountCodes'

function priceLabel(monthlyPrice: number, percentOff: number) {
  const next = discountedPrice(monthlyPrice, percentOff)
  if (percentOff <= 0) return formatUsd(monthlyPrice)
  if (next <= 0) return 'Free'
  return formatUsd(next)
}

function subscribeLabel(monthlyPrice: number, percentOff: number) {
  const price = discountedPrice(monthlyPrice, percentOff)
  if (price <= 0) return 'Subscribe free'
  return `Subscribe · ${formatUsd(price)}`
}

export function AdminPlansPage() {
  const [catalog, setCatalog] = useState<KeaPlanCatalog>(loadPlanCatalog)
  const [discounts, setDiscounts] = useState<KeaDiscountCode[]>(loadDiscountCodes)
  const [saved, setSaved] = useState(false)

  useEffect(() => subscribePlanCatalog(() => setCatalog(loadPlanCatalog())), [])

  function commit(next: KeaPlanCatalog) {
    const savedCatalog = savePlanCatalog(next)
    setCatalog(savedCatalog)
    setSaved(true)
  }

  function commitDiscounts(next: KeaDiscountCode[]) {
    setDiscounts(next)
    saveDiscountCodes(next)
    setSaved(true)
  }

  function patchPlan(id: PlanId, patch: Partial<KeaPlan>) {
    commit({
      ...catalog,
      plans: catalog.plans.map((plan) =>
        plan.id === id ? { ...plan, ...patch } : plan,
      ),
    })
  }

  function patchDiscount(id: string, patch: Partial<KeaDiscountCode>) {
    commitDiscounts(
      discounts.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    )
  }

  return (
    <div className="admin-plans">
      <p className="settings-note">
        Same layout people see under Subscription. Edit in place — this page is
        the source of truth. Saved on this device.
      </p>

      {/* —— Full price (0%) — editable source —— */}
      <section className="settings-card settings-card--plans admin-plans__block">
        <p className="admin-plans__badge">Full price · 0% off</p>
        <label className="admin-plans__field admin-plans__field--blurb">
          <span className="visually-hidden">Trial words</span>
          <textarea
            value={catalog.trialBlurb}
            rows={2}
            onChange={(event) =>
              commit({ ...catalog, trialBlurb: event.target.value })
            }
          />
        </label>
        <p className="settings-note settings-note--status">
          <label className="admin-plans__inline">
            <input
              type="number"
              min={1}
              max={30}
              value={catalog.trialDays}
              aria-label="Trial days"
              onChange={(event) =>
                commit({
                  ...catalog,
                  trialDays: Number(event.target.value) || 7,
                })
              }
            />
            <span>days free</span>
          </label>
          <span> · </span>
          <label className="admin-plans__inline">
            <input
              type="number"
              min={1}
              max={120}
              value={catalog.trialDailyMinutes}
              aria-label="Trial minutes each day"
              onChange={(event) =>
                commit({
                  ...catalog,
                  trialDailyMinutes: Number(event.target.value) || 10,
                })
              }
            />
            <span>minutes a day</span>
          </label>
          <span> · </span>
          <span className="settings-usage-link" aria-hidden="true">
            Click here to view Usage
          </span>
        </p>

        <div className="discount-code">
          <div className="discount-code__row">
            <span className="discount-code__label">Discount code</span>
            <input
              type="text"
              className="discount-code__input"
              value=""
              disabled
              placeholder="None · full price"
              aria-label="Full price — no discount"
            />
            <span className="discount-code__apply kea-button" aria-hidden="true">
              Apply
            </span>
          </div>
          <p className="discount-code__active">Active: none · 0% off</p>
        </div>

        <div className="plan-grid">
          {catalog.plans.map((plan) => (
            <EditablePlanCard
              key={plan.id}
              plan={plan}
              percentOff={0}
              onPatch={(patch) => patchPlan(plan.id, patch)}
            />
          ))}
        </div>
      </section>

      {/* —— One block per discount, live-calculated prices —— */}
      {discounts.map((item, index) => (
        <section
          key={item.id}
          className="settings-card settings-card--plans admin-plans__block"
        >
          <p className="admin-plans__badge">
            Discount {index + 1}
            {item.title.trim() ? ` · ${item.title.trim()}` : ''}
          </p>
          <p className="settings-note settings-note--lead">{catalog.trialBlurb}</p>
          <p className="settings-note settings-note--status">
            {catalog.trialDays} days free · {catalog.trialDailyMinutes} minutes a
            day ·{' '}
            <span className="settings-usage-link" aria-hidden="true">
              Click here to view Usage
            </span>
          </p>

          <div className="discount-code">
            <div className="discount-code__row">
              <span className="discount-code__label">Discount code</span>
              <input
                type="text"
                className="discount-code__input"
                value={item.code}
                placeholder="Code people type"
                aria-label={`Discount code ${index + 1}`}
                onChange={(event) =>
                  patchDiscount(item.id, { code: event.target.value })
                }
              />
              <label className="admin-plans__percent">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={item.percentOff}
                  aria-label="Percent off"
                  onChange={(event) =>
                    patchDiscount(item.id, {
                      percentOff: Math.round(Number(event.target.value) || 0),
                    })
                  }
                />
                <span>% off</span>
              </label>
              <input
                type="text"
                className="admin-plans__title-input"
                value={item.title}
                placeholder="Admin note"
                aria-label="Admin title for this discount"
                onChange={(event) =>
                  patchDiscount(item.id, { title: event.target.value })
                }
              />
              {discounts.length > 1 ? (
                <button
                  type="button"
                  className="discount-code__clear"
                  onClick={() =>
                    commitDiscounts(
                      discounts.filter((row) => row.id !== item.id),
                    )
                  }
                >
                  Remove
                </button>
              ) : null}
            </div>
            <p className="discount-code__active">
              Active:{' '}
              <strong>{item.code.trim() || 'code'}</strong> · {item.percentOff}%
              off
            </p>
          </div>

          <div className="plan-grid">
            {catalog.plans.map((plan) => {
              const price = discountedPrice(plan.monthlyPrice, item.percentOff)
              return (
                <article
                  key={plan.id}
                  className={`plan-card${plan.featured ? ' plan-card--featured' : ''}`}
                >
                  <h3>{plan.name}</h3>
                  <p className="plan-card__price">
                    {priceLabel(plan.monthlyPrice, item.percentOff)}
                    {price > 0 ? <span> / month</span> : null}
                    {item.percentOff > 0 && plan.monthlyPrice > 0 ? (
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
                    {plan.bullets.map((line, bulletIndex) => (
                      <li key={`${plan.id}-${bulletIndex}`}>{line}</li>
                    ))}
                  </ul>
                  <button type="button" className="kea-button" disabled>
                    {subscribeLabel(plan.monthlyPrice, item.percentOff)}
                  </button>
                </article>
              )
            })}
          </div>
        </section>
      ))}

      <div className="admin-plans__footer">
        <button
          type="button"
          className="kea-button"
          onClick={() => commitDiscounts([...discounts, newDiscountCode()])}
        >
          Add another discount code
        </button>
        <button
          type="button"
          className="kea-button kea-button--ghost"
          onClick={() => {
            commit(structuredClone(DEFAULT_PLAN_CATALOG))
            commitDiscounts(structuredClone(DEFAULT_DISCOUNT_CODES))
          }}
        >
          Restore original tiers
        </button>
        <p className="settings-note">{saved ? 'Saved on this device.' : ''}</p>
      </div>
    </div>
  )
}

function EditablePlanCard({
  plan,
  percentOff,
  onPatch,
}: {
  plan: KeaPlan
  percentOff: number
  onPatch: (patch: Partial<KeaPlan>) => void
}) {
  const price = discountedPrice(plan.monthlyPrice, percentOff)

  return (
    <article
      className={`plan-card plan-card--editable${plan.featured ? ' plan-card--featured' : ''}`}
    >
      <label className="admin-plans__field">
        <span className="visually-hidden">Plan name</span>
        <input
          value={plan.name}
          onChange={(event) => onPatch({ name: event.target.value })}
        />
      </label>
      <div className="plan-card__price admin-plans__price-edit">
        <label className="admin-plans__inline">
          <span aria-hidden="true">$</span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={plan.monthlyPrice}
            aria-label={`${plan.name} monthly price`}
            onChange={(event) =>
              onPatch({ monthlyPrice: Number(event.target.value) })
            }
          />
        </label>
        {price > 0 || percentOff <= 0 ? <span> / month</span> : null}
      </div>
      <label className="admin-plans__field">
        <span className="visually-hidden">Short description</span>
        <input
          value={plan.tagline}
          placeholder="Short description"
          onChange={(event) => onPatch({ tagline: event.target.value })}
        />
      </label>
      <label className="admin-plans__field admin-plans__field--minutes">
        <span className="visually-hidden">Minutes a day (0 = unlimited)</span>
        <input
          type="number"
          min={0}
          max={600}
          value={plan.dailyMinutes}
          onChange={(event) =>
            onPatch({
              dailyMinutes: Math.round(Number(event.target.value) || 0),
            })
          }
        />
        <span className="admin-plans__minutes-hint">
          {formatDailyMinutes(plan.dailyMinutes)}
        </span>
      </label>
      <label className="admin-plans__field admin-plans__field--bullets">
        <span className="visually-hidden">Card words (one line each)</span>
        <textarea
          rows={4}
          value={plan.bullets.join('\n')}
          placeholder={'One benefit per line'}
          onChange={(event) =>
            onPatch({
              bullets: event.target.value
                .split('\n')
                .map((line) => line.trim())
                .filter(Boolean),
            })
          }
        />
      </label>
      <label className="admin-plans__field">
        <span className="visually-hidden">Stripe price id</span>
        <input
          value={plan.stripePriceId}
          placeholder="Stripe price id (optional)"
          onChange={(event) =>
            onPatch({ stripePriceId: event.target.value.trim() })
          }
        />
      </label>
      <label className="settings-toggle admin-plans__featured">
        <input
          type="checkbox"
          checked={plan.featured}
          onChange={(event) => onPatch({ featured: event.target.checked })}
        />
        Highlight this tier
      </label>
      <button type="button" className="kea-button" disabled>
        {subscribeLabel(plan.monthlyPrice, percentOff)}
      </button>
    </article>
  )
}
