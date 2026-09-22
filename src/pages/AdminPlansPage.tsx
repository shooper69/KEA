import { useState } from 'react'
import {
  DEFAULT_PLAN_CATALOG,
  loadPlanCatalog,
  savePlanCatalog,
  type KeaPlan,
  type KeaPlanCatalog,
} from '../architecture/keaPlans'

export function AdminPlansPage() {
  const [catalog, setCatalog] = useState<KeaPlanCatalog>(loadPlanCatalog)
  const [saved, setSaved] = useState(false)

  function commit(next: KeaPlanCatalog) {
    setCatalog(next)
    savePlanCatalog(next)
    setSaved(true)
  }

  function patchPlan(id: KeaPlan['id'], patch: Partial<KeaPlan>) {
    commit({
      ...catalog,
      plans: catalog.plans.map((plan) =>
        plan.id === id ? { ...plan, ...patch } : plan,
      ),
    })
  }

  return (
    <section className="settings-card">
      <h2>Subscription tiers</h2>
      <p className="settings-note">
        Names, prices, daily time, and the words people see on each card. Saved
        here, no code change needed. Stripe price IDs are optional; if empty,
        checkout creates the price from the monthly amount.
      </p>
      <label className="welcome-field">
        <span>Trial length (days)</span>
        <input
          type="number"
          min={1}
          max={30}
          value={catalog.trialDays}
          onChange={(event) =>
            commit({ ...catalog, trialDays: Number(event.target.value) || 7 })
          }
        />
      </label>
      <label className="welcome-field">
        <span>Trial minutes each day</span>
        <input
          type="number"
          min={1}
          max={120}
          value={catalog.trialDailyMinutes}
          onChange={(event) =>
            commit({
              ...catalog,
              trialDailyMinutes: Number(event.target.value) || 10,
            })
          }
        />
      </label>
      <label className="welcome-field">
        <span>Trial words (shown to users)</span>
        <textarea
          className="master-definition"
          style={{ minHeight: '6rem' }}
          value={catalog.trialBlurb}
          onChange={(event) =>
            commit({ ...catalog, trialBlurb: event.target.value })
          }
        />
      </label>
      {catalog.plans.map((plan) => (
        <article key={plan.id} className="settings-card" style={{ marginTop: '0.85rem' }}>
          <h3>{plan.id}</h3>
          <label className="welcome-field">
            <span>Name people see</span>
            <input
              value={plan.name}
              onChange={(event) => patchPlan(plan.id, { name: event.target.value })}
            />
          </label>
          <label className="welcome-field">
            <span>Short description</span>
            <input
              value={plan.tagline}
              onChange={(event) =>
                patchPlan(plan.id, { tagline: event.target.value })
              }
            />
          </label>
          <label className="welcome-field">
            <span>Monthly price (USD)</span>
            <input
              type="number"
              min={1}
              step="0.01"
              value={plan.monthlyPrice}
              onChange={(event) =>
                patchPlan(plan.id, { monthlyPrice: Number(event.target.value) })
              }
            />
          </label>
          <label className="welcome-field">
            <span>Minutes a day (0 = unlimited)</span>
            <input
              type="number"
              min={0}
              max={600}
              value={plan.dailyMinutes}
              onChange={(event) =>
                patchPlan(plan.id, {
                  dailyMinutes: Math.round(Number(event.target.value) || 0),
                })
              }
            />
          </label>
          <label className="welcome-field">
            <span>Card words (one line each)</span>
            <textarea
              className="master-definition"
              style={{ minHeight: '7rem' }}
              value={plan.bullets.join('\n')}
              onChange={(event) =>
                patchPlan(plan.id, {
                  bullets: event.target.value
                    .split('\n')
                    .map((line) => line.trim())
                    .filter(Boolean),
                })
              }
            />
          </label>
          <label className="welcome-field">
            <span>Stripe price id (optional)</span>
            <input
              value={plan.stripePriceId}
              placeholder="price_…"
              onChange={(event) =>
                patchPlan(plan.id, { stripePriceId: event.target.value.trim() })
              }
            />
          </label>
          <label className="settings-toggle">
            <input
              type="checkbox"
              checked={plan.featured}
              onChange={(event) =>
                patchPlan(plan.id, { featured: event.target.checked })
              }
            />
            Highlight this tier
          </label>
        </article>
      ))}
      <p className="settings-note">{saved ? 'Saved on this device.' : ''}</p>
      <button
        type="button"
        className="kea-button kea-button--ghost"
        onClick={() => {
          const next = structuredClone(DEFAULT_PLAN_CATALOG)
          commit(next)
        }}
      >
        Restore original tiers
      </button>
    </section>
  )
}
