import { useMemo, useState } from 'react'
import {
  analyseCosts,
  loadCostAssumptions,
  loadOpenAiRates,
  saveCostAssumptions,
  saveOpenAiRates,
  type CostAssumptions,
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

export function AdminCostAnalysisPage() {
  const [rates, setRates] = useState(loadOpenAiRates)
  const [assume, setAssume] = useState(loadCostAssumptions)
  const catalog = loadPlanCatalog()
  const keaWords = getAverageReplyWords()
  const report = useMemo(
    () => analyseCosts(catalog, rates, assume, keaWords),
    [assume, catalog, keaWords, rates],
  )

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
