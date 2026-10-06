import { useCallback, useEffect, useState } from 'react'
import {
  dailyPaceFromMonthlyMinutes,
  formatHoursFromMinutes,
} from '../architecture/keaCostsMath'
import type { CostsAdminReport, CostsOptimizerRow } from '../architecture/keaCostsTypes'
import {
  formatUsd,
  loadPlanCatalog,
  savePlanCatalog,
  type PlanId,
} from '../architecture/keaPlans'
import { getSupabase } from '../lib/supabase'

function money(value: number) {
  return formatUsd(value)
}

function pct(value: number) {
  if (!Number.isFinite(value)) return '—'
  return `${Math.round(value * 1000) / 10}%`
}

function lightLabel(status: string) {
  if (status === 'green') return 'Green'
  if (status === 'amber') return 'Amber'
  return 'Red'
}

function hoursLabel(monthlyMinutes: number) {
  return `${formatHoursFromMinutes(monthlyMinutes)}/mo`
}

function BreakdownTable({
  rows,
  firstHeader,
}: {
  rows: CostsAdminReport['byFeature']
  firstHeader: string
}) {
  if (!rows.length) {
    return <p className="settings-note">No usage in this window yet.</p>
  }
  return (
    <div className="cost-table-wrap">
      <table className="cost-table">
        <thead>
          <tr>
            <th>{firstHeader}</th>
            <th>Events</th>
            <th>Cost</th>
            <th>Prompt tok</th>
            <th>Completion tok</th>
            <th>Audio sec</th>
            <th>TTS chars</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <td>{row.label}</td>
              <td>{row.events}</td>
              <td>{money(row.costUsd)}</td>
              <td>{Math.round(row.promptTokens)}</td>
              <td>{Math.round(row.completionTokens)}</td>
              <td>{row.audioSeconds.toFixed(1)}</td>
              <td>{Math.round(row.ttsCharacters)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

type RateDraft = {
  whisperPerMinute: string
  chatInputPerMillion: string
  chatOutputPerMillion: string
  ttsInputPerMillion: string
  ttsAudioPerMillion: string
  ttsHdPerMillionChars: string
}

function ratesToDraft(rates: CostsAdminReport['rates']): RateDraft {
  return {
    whisperPerMinute: String(rates.whisperPerMinute),
    chatInputPerMillion: String(rates.chatInputPerMillion),
    chatOutputPerMillion: String(rates.chatOutputPerMillion),
    ttsInputPerMillion: String(rates.ttsInputPerMillion),
    ttsAudioPerMillion: String(rates.ttsAudioPerMillion),
    ttsHdPerMillionChars: String(rates.ttsHdPerMillionChars),
  }
}

async function authHeaders() {
  const supabase = getSupabase()
  const {
    data: { session },
  } = (await supabase?.auth.getSession()) ?? { data: { session: null } }
  if (!session?.access_token) return null
  return {
    Authorization: `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  }
}

function isPaidPlanId(id: string): id is PlanId {
  return id === 'starter' || id === 'companion' || id === 'unlimited'
}

export function AdminCostAnalysisPage() {
  const [days, setDays] = useState(30)
  const [data, setData] = useState<CostsAdminReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [rateDraft, setRateDraft] = useState<RateDraft | null>(null)
  const [rateBusy, setRateBusy] = useState(false)
  const [rateNote, setRateNote] = useState<string | null>(null)
  const [catalogNote, setCatalogNote] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const headers = await authHeaders()
      if (!headers) {
        setError('Sign in as admin to load live costs.')
        setData(null)
        return
      }
      const res = await fetch(`/api/costs/admin?days=${days}`, { headers })
      const raw = await res.text()
      let json: CostsAdminReport & { error?: string }
      try {
        json = JSON.parse(raw) as CostsAdminReport & { error?: string }
      } catch {
        setError(
          res.status === 404 || raw.trimStart().startsWith('<!')
            ? 'Costs API is not reachable. Restart Vite locally, or redeploy kea.chat.'
            : `Invalid costs response (${res.status}).`,
        )
        setData(null)
        return
      }
      if (!res.ok) {
        setError(json.error || `Failed (${res.status})`)
        setData(null)
        return
      }
      setData(json)
      setRateDraft(ratesToDraft(json.rates))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => {
    void load()
  }, [load])

  async function saveRateCard() {
    if (!rateDraft) return
    setRateBusy(true)
    setRateNote(null)
    try {
      const headers = await authHeaders()
      if (!headers) {
        setRateNote('Sign in as admin to save the rate card.')
        return
      }
      const res = await fetch('/api/costs/admin', {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          whisperPerMinute: Number(rateDraft.whisperPerMinute),
          chatInputPerMillion: Number(rateDraft.chatInputPerMillion),
          chatOutputPerMillion: Number(rateDraft.chatOutputPerMillion),
          ttsInputPerMillion: Number(rateDraft.ttsInputPerMillion),
          ttsAudioPerMillion: Number(rateDraft.ttsAudioPerMillion),
          ttsHdPerMillionChars: Number(rateDraft.ttsHdPerMillionChars),
        }),
      })
      const json = (await res.json()) as {
        error?: string
        rates?: CostsAdminReport['rates']
      }
      if (!res.ok) {
        setRateNote(json.error || `Save failed (${res.status})`)
        return
      }
      setRateNote('Rate card saved. New estimates use these rates; refresh for updated COGS.')
      await load()
    } catch (e) {
      setRateNote(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setRateBusy(false)
    }
  }

  function applyRowToCatalog(row: CostsOptimizerRow, mode: 'price' | 'allowance' | 'action') {
    if (!isPaidPlanId(row.planId)) {
      setCatalogNote('Trial recommendations are watch-only; they are not applied to paid catalog.')
      return
    }
    const catalog = loadPlanCatalog()
    const nextPlans = catalog.plans.map((plan) => {
      if (plan.id !== row.planId) return plan
      if (mode === 'price' || (mode === 'action' && row.action === 'raise_price')) {
        return { ...plan, monthlyPrice: row.recommendedPrice }
      }
      if (mode === 'allowance' || (mode === 'action' && row.action === 'cut_allowance')) {
        return {
          ...plan,
          dailyMinutes: dailyPaceFromMonthlyMinutes(row.recommendedMonthlyMinutes),
        }
      }
      return plan
    })
    savePlanCatalog({ ...catalog, plans: nextPlans })
    const label =
      mode === 'price' || (mode === 'action' && row.action === 'raise_price')
        ? `price → ${money(row.recommendedPrice)}`
        : `allowance → ${hoursLabel(row.recommendedMonthlyMinutes)}`
    setCatalogNote(
      `Applied ${row.name} ${label} to the local plan catalog (Admin → Plans). Stripe Price IDs were not changed — update Stripe Dashboard separately if the sticker price moves.`,
    )
  }

  function applyPreferredActions() {
    if (!data) return
    const catalog = loadPlanCatalog()
    let changed = 0
    const nextPlans = catalog.plans.map((plan) => {
      const row = data.optimizer.find((item) => item.planId === plan.id)
      if (!row || row.action === 'ok') return plan
      changed += 1
      if (row.action === 'raise_price') {
        return { ...plan, monthlyPrice: row.recommendedPrice }
      }
      if (row.action === 'cut_allowance') {
        return {
          ...plan,
          dailyMinutes: dailyPaceFromMonthlyMinutes(row.recommendedMonthlyMinutes),
        }
      }
      return plan
    })
    if (!changed) {
      setCatalogNote('No red-plan actions to apply.')
      return
    }
    savePlanCatalog({ ...catalog, plans: nextPlans })
    setCatalogNote(
      `Applied preferred actions for ${changed} plan(s) to the local catalog. Stripe products/prices were not updated.`,
    )
  }

  const overview = data?.overview

  return (
    <>
      <section className="settings-card">
        <div className="wt-admin-head">
          <div>
            <h2>Costs</h2>
            <p className="settings-note">
              Monthly economics for Kea subscriptions. Primary SKU unit is hours
              (or minutes) per month. Daily figures are a soft pacing guide only.
              Margin target is 50% after Stripe fees and OpenAI costs, at full
              monthly entitlement and heavy talk intensity.
            </p>
          </div>
          <div className="cost-toolbar">
            <label className="welcome-field cost-toolbar__days">
              <span>Usage window</span>
              <select
                value={days}
                onChange={(event) => setDays(Number(event.target.value))}
              >
                <option value={7}>7 days</option>
                <option value={30}>30 days</option>
                <option value={90}>90 days</option>
              </select>
            </label>
            <button
              type="button"
              className="kea-button kea-button--ghost"
              disabled={loading}
              onClick={() => void load()}
            >
              {loading ? 'Loading…' : 'Refresh'}
            </button>
          </div>
        </div>
        {error ? <p className="settings-note is-loss">{error}</p> : null}
      </section>

      {data && overview ? (
        <section className="settings-card">
          <h2>Is this month profitable?</h2>
          <p className={`cost-verdict cost-verdict--${overview.status}`}>
            {overview.profitable
              ? 'Yes — at or above 50% gross margin on current MRR vs monthly-equivalent OpenAI cost.'
              : overview.paidSubscribers === 0 && overview.openaiMonthlyEquivalent > 0
                ? 'Not yet — OpenAI spend with no paid subscribers in this snapshot.'
                : 'No — below the 50% gross-margin floor (after Stripe and OpenAI).'}
          </p>
          <div className="cost-kpis">
            <div className="cost-kpi">
              <span>Monthly revenue (MRR)</span>
              <strong>{money(overview.revenue)}</strong>
              <em>{overview.paidSubscribers} paid</em>
            </div>
            <div className="cost-kpi">
              <span>Stripe fees / mo</span>
              <strong>{money(overview.stripeFees)}</strong>
              <em>2.9% + $0.30 / sub</em>
            </div>
            <div className="cost-kpi">
              <span>Net after Stripe / mo</span>
              <strong>{money(overview.netAfterStripe)}</strong>
            </div>
            <div className="cost-kpi">
              <span>OpenAI (window)</span>
              <strong>{money(overview.openaiCost)}</strong>
              <em>{data.eventCount} events</em>
            </div>
            <div className="cost-kpi">
              <span>OpenAI / month</span>
              <strong>{money(overview.openaiMonthlyEquivalent)}</strong>
            </div>
            <div className={`cost-kpi cost-kpi--${overview.status}`}>
              <span>Gross margin</span>
              <strong>{pct(overview.grossMargin)}</strong>
              <em>Profit {money(overview.grossProfit)}</em>
            </div>
          </div>
          <p className="settings-note">
            Mode:{' '}
            {data.mode === 'observed'
              ? 'observed usage'
              : 'planning (not enough events yet)'}
            . COGS used for monthly allowances:{' '}
            {money(data.cogsPerMinute.used)} / talk-minute (planning{' '}
            {money(data.cogsPerMinute.planning)}
            {data.cogsPerMinute.observed != null
              ? `; observed ${money(data.cogsPerMinute.observed)}`
              : ''}
            ). Green &gt; 60%, amber 50–60%, red &lt; 50%.
          </p>
        </section>
      ) : null}

      {data ? (
        <>
          <section className="settings-card">
            <h2>Monthly pricing optimizer</h2>
            <p className="settings-note">
              Full monthly entitlement × heavy intensity. Prefer cutting the
              monthly allowance before raising the sticker price. Recommendations
              do not change Stripe — use Apply to Catalog, then update Stripe
              Price IDs in Admin → Plans / Dashboard when ready.
            </p>
            {catalogNote ? (
              <p className="settings-note settings-note--status">{catalogNote}</p>
            ) : null}
            <div className="cost-toolbar cost-toolbar--actions">
              <button
                type="button"
                className="kea-button kea-button--ghost"
                onClick={applyPreferredActions}
              >
                Apply preferred actions to catalog
              </button>
            </div>
            <div className="cost-table-wrap">
              <table className="cost-table">
                <thead>
                  <tr>
                    <th>Plan</th>
                    <th>Price / mo</th>
                    <th>Price rec.</th>
                    <th>Allowance / mo</th>
                    <th>Allowance rec.</th>
                    <th>Monthly COGS</th>
                    <th>Net after Stripe</th>
                    <th>Margin now</th>
                    <th>Margin if applied</th>
                    <th>Status</th>
                    <th>Action</th>
                    <th>Apply</th>
                  </tr>
                </thead>
                <tbody>
                  {data.optimizer.map((row) => (
                    <tr key={row.planId}>
                      <td>{row.name}</td>
                      <td>{money(row.currentPrice)}</td>
                      <td>{money(row.recommendedPrice)}</td>
                      <td>
                        {hoursLabel(row.currentMonthlyMinutes)}
                        {row.currentDailyPace > 0 ? (
                          <em className="cost-soft-pace">
                            {' '}
                            (~{row.currentDailyPace} min/day)
                          </em>
                        ) : null}
                      </td>
                      <td>
                        {hoursLabel(row.recommendedMonthlyMinutes)}
                        {row.recommendedDailyPace > 0 ? (
                          <em className="cost-soft-pace">
                            {' '}
                            (~{row.recommendedDailyPace} min/day)
                          </em>
                        ) : null}
                      </td>
                      <td>{money(row.monthlyCogsAtCap)}</td>
                      <td>{money(row.netAfterStripe)}</td>
                      <td className={row.currentMargin < 0.5 ? 'is-loss' : 'is-gain'}>
                        {pct(row.currentMargin)}
                      </td>
                      <td>{pct(row.projectedMarginAtRecommended)}</td>
                      <td>
                        <span className={`cost-light cost-light--${row.status}`}>
                          {lightLabel(row.status)}
                        </span>
                      </td>
                      <td>{row.actionLabel}</td>
                      <td className="cost-apply-cell">
                        {isPaidPlanId(row.planId) ? (
                          <>
                            <button
                              type="button"
                              className="kea-button kea-button--ghost cost-apply-btn"
                              onClick={() => applyRowToCatalog(row, 'price')}
                            >
                              Price
                            </button>
                            <button
                              type="button"
                              className="kea-button kea-button--ghost cost-apply-btn"
                              onClick={() => applyRowToCatalog(row, 'allowance')}
                            >
                              Hours
                            </button>
                            {row.action !== 'ok' ? (
                              <button
                                type="button"
                                className="kea-button cost-apply-btn"
                                onClick={() => applyRowToCatalog(row, 'action')}
                              >
                                Preferred
                              </button>
                            ) : null}
                          </>
                        ) : (
                          <span className="settings-note">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="settings-card">
            <h2>OpenAI rate card</h2>
            <p className="settings-note">
              List rates used to estimate each logged call. Stored in Supabase (
              <code>ai_rate_card</code>
              ). If the row is missing, handlers fall back to code defaults.
              Source now:{' '}
              {data.rates.source === 'database' ? 'database' : 'code defaults'}
              {data.rates.updatedAt
                ? ` · last updated ${new Date(data.rates.updatedAt).toLocaleString()}`
                : ''}
              {data.rates.updatedBy ? ` by ${data.rates.updatedBy}` : ''}.
            </p>
            {rateDraft ? (
              <div className="cost-rate-grid">
                {(
                  [
                    ['whisperPerMinute', 'Whisper $/min'],
                    ['chatInputPerMillion', 'Chat input $/1M tok'],
                    ['chatOutputPerMillion', 'Chat output $/1M tok'],
                    ['ttsInputPerMillion', 'TTS input $/1M tok'],
                    ['ttsAudioPerMillion', 'TTS audio $/1M tok'],
                    ['ttsHdPerMillionChars', 'tts-1-hd $/1M chars'],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="welcome-field">
                    <span>{label}</span>
                    <input
                      type="number"
                      step="any"
                      min={0}
                      value={rateDraft[key]}
                      onChange={(event) =>
                        setRateDraft({ ...rateDraft, [key]: event.target.value })
                      }
                    />
                  </label>
                ))}
              </div>
            ) : null}
            <div className="cost-toolbar cost-toolbar--actions">
              <button
                type="button"
                className="kea-button"
                disabled={rateBusy || !rateDraft}
                onClick={() => void saveRateCard()}
              >
                {rateBusy ? 'Saving…' : 'Save rate card'}
              </button>
              {rateNote ? <p className="settings-note">{rateNote}</p> : null}
            </div>
          </section>

          <section className="settings-card">
            <h2>Cost by user</h2>
            <p className="settings-note">
              Highest OpenAI cost first. Profit uses that user’s monthly catalog
              price minus Stripe, vs their usage scaled to 30 days.
            </p>
            {data.byUser.length ? (
              <div className="cost-table-wrap">
                <table className="cost-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Plan</th>
                      <th>Events</th>
                      <th>AI cost (window)</th>
                      <th>Revenue / mo</th>
                      <th>Profit / mo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byUser.map((row) => (
                      <tr key={row.key}>
                        <td>{row.label}</td>
                        <td>{row.planId || '—'}</td>
                        <td>{row.events}</td>
                        <td>{money(row.costUsd)}</td>
                        <td>{money(row.revenueUsd)}</td>
                        <td className={row.profitUsd < 0 ? 'is-loss' : 'is-gain'}>
                          {money(row.profitUsd)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="settings-note">No per-user events in this window.</p>
            )}
          </section>

          <section className="settings-card">
            <h2>Cost by feature</h2>
            <BreakdownTable rows={data.byFeature} firstHeader="Feature" />
          </section>

          <section className="settings-card">
            <h2>Cost by model</h2>
            <BreakdownTable rows={data.byModel} firstHeader="Model" />
          </section>

          <section className="settings-card">
            <h2>Cost by subscription tier</h2>
            <BreakdownTable rows={data.byPlan} firstHeader="Plan at call time" />
          </section>

          <section className="settings-card">
            <h2>Monthly forecast</h2>
            <p className="settings-note">
              Mix from current paid subscribers (equal split if none). Worst case
              is full monthly entitlement at heavy intensity. Observed uses this
              window’s monthly-equivalent cost per paid user.
            </p>
            <div className="cost-table-wrap">
              <table className="cost-table">
                <thead>
                  <tr>
                    <th>Users</th>
                    <th>Revenue / mo</th>
                    <th>Stripe / mo</th>
                    <th>OpenAI worst / mo</th>
                    <th>Margin worst</th>
                    <th>OpenAI observed / mo</th>
                    <th>Margin observed</th>
                    <th>Worst status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.forecast.map((row) => (
                    <tr key={row.users}>
                      <td>{row.users.toLocaleString('en-US')}</td>
                      <td>{money(row.revenue)}</td>
                      <td>{money(row.stripeFees)}</td>
                      <td>{money(row.openaiWorstCase)}</td>
                      <td
                        className={
                          row.marginWorstCase < 0.5 ? 'is-loss' : 'is-gain'
                        }
                      >
                        {pct(row.marginWorstCase)}
                      </td>
                      <td>{money(row.openaiObserved)}</td>
                      <td>{pct(row.marginObserved)}</td>
                      <td>
                        <span
                          className={`cost-light cost-light--${row.statusWorstCase}`}
                        >
                          {lightLabel(row.statusWorstCase)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </>
  )
}
