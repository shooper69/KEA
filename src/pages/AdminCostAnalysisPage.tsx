import { useEffect, useMemo, useState } from 'react'
import {
  analyseCosts,
  loadCostAssumptions,
  loadMonthlyCostSeries,
  loadOpenAiRates,
  saveCostAssumptions,
  saveOpenAiRates,
  type CostAssumptions,
  type MonthlyCostPoint,
  type OpenAiRates,
} from '../architecture/keaCostModel'
import { formatUsd, loadPlanCatalog } from '../architecture/keaPlans'
import { getAverageReplyWords } from '../data/keaSpeech'

function money(value: number) {
  return formatUsd(value)
}

function pct(value: number) {
  return `${Math.round(value * 100)}%`
}

function formatTokens(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`
  if (value >= 10_000) return `${Math.round(value / 1000)}k`
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`
  return `${Math.round(value)}`
}

function monthLabel(yyyyMm: string) {
  const [year, month] = yyyyMm.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleString('en', {
    month: 'short',
    year: '2-digit',
  })
}

function CostTrendChart({ points }: { points: MonthlyCostPoint[] }) {
  const width = 720
  const height = 260
  const pad = { left: 56, right: 56, top: 18, bottom: 36 }
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom
  const maxTokens = Math.max(1, ...points.map((p) => p.tokens))
  const maxMoney = Math.max(1, ...points.map((p) => Math.max(p.cost, p.revenue)))
  const last = points[points.length - 1]
  const n = points.length

  function xAt(index: number) {
    if (n <= 1) return pad.left + innerW / 2
    return pad.left + (index / (n - 1)) * innerW
  }

  function yTokens(value: number) {
    return pad.top + innerH * (1 - value / maxTokens)
  }

  function yMoney(value: number) {
    return pad.top + innerH * (1 - value / maxMoney)
  }

  function line(key: 'tokens' | 'cost' | 'revenue', yOf: (v: number) => number) {
    return points
      .map((point, index) => `${xAt(index).toFixed(1)},${yOf(point[key]).toFixed(1)}`)
      .join(' ')
  }

  const ticks = 4

  return (
    <div className="cost-chart">
      <svg
        className="cost-chart__svg"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Token usage, cost, and revenue by calendar month"
      >
        {Array.from({ length: ticks + 1 }, (_, i) => {
          const y = pad.top + (innerH * i) / ticks
          const tokenTick = maxTokens * (1 - i / ticks)
          const moneyTick = maxMoney * (1 - i / ticks)
          return (
            <g key={i}>
              <line
                className="cost-chart__grid"
                x1={pad.left}
                x2={width - pad.right}
                y1={y}
                y2={y}
              />
              <text className="cost-chart__axis cost-chart__axis--left" x={pad.left - 8} y={y + 4}>
                {formatTokens(tokenTick)}
              </text>
              <text
                className="cost-chart__axis cost-chart__axis--right"
                x={width - pad.right + 8}
                y={y + 4}
              >
                {money(moneyTick)}
              </text>
            </g>
          )
        })}
        <polyline className="cost-chart__line cost-chart__line--tokens" points={line('tokens', yTokens)} />
        <polyline className="cost-chart__line cost-chart__line--cost" points={line('cost', yMoney)} />
        <polyline className="cost-chart__line cost-chart__line--revenue" points={line('revenue', yMoney)} />
        {points.map((point, index) => (
          <g key={point.month}>
            <circle
              className="cost-chart__dot cost-chart__dot--tokens"
              cx={xAt(index)}
              cy={yTokens(point.tokens)}
              r={3.5}
            />
            <circle
              className="cost-chart__dot cost-chart__dot--cost"
              cx={xAt(index)}
              cy={yMoney(point.cost)}
              r={3.5}
            />
            <circle
              className="cost-chart__dot cost-chart__dot--revenue"
              cx={xAt(index)}
              cy={yMoney(point.revenue)}
              r={3.5}
            />
            <text
              className="cost-chart__month"
              x={xAt(index)}
              y={height - 10}
            >
              {monthLabel(point.month)}
            </text>
          </g>
        ))}
      </svg>
      <ul className="cost-chart__legend">
        <li>
          <span className="cost-chart__swatch cost-chart__swatch--tokens" />
          Used {formatTokens(last?.tokens ?? 0)} tokens
        </li>
        <li>
          <span className="cost-chart__swatch cost-chart__swatch--cost" />
          Cost {money(last?.cost ?? 0)}
        </li>
        <li>
          <span className="cost-chart__swatch cost-chart__swatch--revenue" />
          Revenue {money(last?.revenue ?? 0)}
        </li>
      </ul>
    </div>
  )
}

export function AdminCostAnalysisPage() {
  const [rates, setRates] = useState(loadOpenAiRates)
  const [assume, setAssume] = useState(loadCostAssumptions)
  const catalog = loadPlanCatalog()
  const keaWords = getAverageReplyWords()
  const report = useMemo(
    () => analyseCosts(catalog, rates, assume, keaWords),
    [assume, catalog, keaWords, rates],
  )
  const [series, setSeries] = useState<MonthlyCostPoint[]>(() =>
    loadMonthlyCostSeries(rates, assume, keaWords),
  )
  useEffect(() => {
    setSeries(loadMonthlyCostSeries(rates, assume, keaWords))
  }, [assume, keaWords, rates])

  function patchRates(patch: Partial<OpenAiRates>) {
    const next = { ...rates, ...patch }
    setRates(next)
    saveOpenAiRates(next)
  }

  function patchAssume(patch: Partial<CostAssumptions>) {
    const next = { ...assume, ...patch }
    setAssume(next)
    saveCostAssumptions(next)
  }

  const rows = [report.trial, ...report.plans]
  const startLabel = series[0] ? monthLabel(series[0].month) : monthLabel(
    `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
  )

  return (
    <>
      <section className="settings-card">
        <h2>Cost analysis</h2>
        <p className="settings-note">
          OpenAI cost for a typical day, using the models Kea actually calls:
          Whisper (whisper-1) for listening, gpt-4o-mini for replies, and
          gpt-4o-mini-tts when she speaks. Kea’s average reply length from About
          Kea ({keaWords} words) is part of the chat and TTS estimate. Change
          tier prices or daily minutes on Subscription tiers and this table
          follows.
        </p>
      </section>
      <section className="settings-card">
        <h2>Used, cost, and revenue</h2>
        <p className="settings-note">
          Months from {startLabel} (when this chart first recorded on this
          device) through the current month. New months appear as the calendar
          moves. Token usage and cost come from talk minutes stored on this
          device, using the same Whisper / chat / TTS model as the table below.
          Revenue is the catalog price of a plan recorded on this device, or $0
          if there is no subscription.
        </p>
        <CostTrendChart points={series} />
      </section>
      <section className="settings-card">
        <h2>OpenAI rates</h2>
        <p className="settings-note">
          Defaults match published API prices. Update them if OpenAI changes.
        </p>
        <label className="welcome-field">
          <span>Whisper whisper-1 ($ per audio minute)</span>
          <input
            type="number"
            step="0.001"
            value={rates.whisperPerMinute}
            onChange={(event) =>
              patchRates({ whisperPerMinute: Number(event.target.value) })
            }
          />
        </label>
        <label className="welcome-field">
          <span>gpt-4o-mini input ($ per 1M tokens)</span>
          <input
            type="number"
            step="0.01"
            value={rates.chatInputPerMillion}
            onChange={(event) =>
              patchRates({ chatInputPerMillion: Number(event.target.value) })
            }
          />
        </label>
        <label className="welcome-field">
          <span>gpt-4o-mini output ($ per 1M tokens)</span>
          <input
            type="number"
            step="0.01"
            value={rates.chatOutputPerMillion}
            onChange={(event) =>
              patchRates({ chatOutputPerMillion: Number(event.target.value) })
            }
          />
        </label>
        <label className="welcome-field">
          <span>gpt-4o-mini-tts text input ($ per 1M tokens)</span>
          <input
            type="number"
            step="0.01"
            value={rates.ttsInputPerMillion}
            onChange={(event) =>
              patchRates({ ttsInputPerMillion: Number(event.target.value) })
            }
          />
        </label>
        <label className="welcome-field">
          <span>gpt-4o-mini-tts audio output ($ per 1M tokens)</span>
          <input
            type="number"
            step="0.1"
            value={rates.ttsAudioPerMillion}
            onChange={(event) =>
              patchRates({ ttsAudioPerMillion: Number(event.target.value) })
            }
          />
        </label>
      </section>
      <section className="settings-card">
        <h2>Typical day</h2>
        <label className="welcome-field">
          <span>Typical paid user, minutes a day</span>
          <input
            type="number"
            min={1}
            value={assume.typicalDailyMinutes}
            onChange={(event) =>
              patchAssume({ typicalDailyMinutes: Number(event.target.value) })
            }
          />
        </label>
        <label className="welcome-field">
          <span>Typical unlimited user, minutes a day</span>
          <input
            type="number"
            min={1}
            value={assume.unlimitedTypicalMinutes}
            onChange={(event) =>
              patchAssume({ unlimitedTypicalMinutes: Number(event.target.value) })
            }
          />
        </label>
        <label className="welcome-field">
          <span>Share of the session that is the user speaking (0–1)</span>
          <input
            type="number"
            step="0.05"
            min={0.1}
            max={0.8}
            value={assume.userTalkShare}
            onChange={(event) =>
              patchAssume({ userTalkShare: Number(event.target.value) })
            }
          />
        </label>
        <label className="welcome-field">
          <span>Share of the session that is Kea speaking (0–1)</span>
          <input
            type="number"
            step="0.05"
            min={0.1}
            max={0.8}
            value={assume.keaTalkShare}
            onChange={(event) =>
              patchAssume({ keaTalkShare: Number(event.target.value) })
            }
          />
        </label>
        <label className="welcome-field">
          <span>Target profit margin (%)</span>
          <input
            type="number"
            min={10}
            max={90}
            value={assume.targetMarginPercent}
            onChange={(event) =>
              patchAssume({ targetMarginPercent: Number(event.target.value) })
            }
          />
        </label>
      </section>
      <section className="settings-card">
        <h2>Profit by tier</h2>
        <div className="cost-table-wrap">
          <table className="cost-table">
            <thead>
              <tr>
                <th>Tier</th>
                <th>Price / mo</th>
                <th>Day cap</th>
                <th>AI cost / day at cap</th>
                <th>AI cost / mo at cap</th>
                <th>Profit at cap</th>
                <th>Margin at cap</th>
                <th>Typical day cost</th>
                <th>Profit typical</th>
                <th>Price for target margin</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.name}</td>
                  <td>{money(row.monthlyPrice)}</td>
                  <td>
                    {row.allowanceMinutes <= 0
                      ? `${assume.unlimitedTypicalMinutes}m typ.`
                      : `${row.allowanceMinutes}m`}
                  </td>
                  <td>{money(row.atCap.total)}</td>
                  <td>{money(row.monthlyCostAtCap)}</td>
                  <td className={row.profitAtCap < 0 ? 'is-loss' : 'is-gain'}>
                    {money(row.profitAtCap)}
                  </td>
                  <td>{pct(row.marginAtCap)}</td>
                  <td>{money(row.typical.total)}</td>
                  <td className={row.profitTypical < 0 ? 'is-loss' : 'is-gain'}>
                    {money(row.profitTypical)}
                  </td>
                  <td>{money(row.recommendedPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="settings-note">
          At cap is the expensive case: every subscriber uses their full daily
          minutes (or the unlimited typical for Unlimited). Typical is a lighter
          day. Recommended price is monthly AI cost at cap divided by one minus
          the target margin, so Starter / Companion / Unlimited stay profitable
          even if people talk for the whole allowance.
        </p>
        {report.plans.map((row) => (
          <p key={row.id} className="settings-note">
            {row.name}: Whisper {money(row.atCap.whisper)} · chat{' '}
            {money(row.atCap.chat)} · TTS {money(row.atCap.tts)} per max day (
            {Math.round(row.atCap.turns)} turns).
          </p>
        ))}
      </section>
    </>
  )
}
