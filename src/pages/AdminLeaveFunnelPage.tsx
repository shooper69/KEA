import { useState } from 'react'
import {
  DEFAULT_LEAVE_FUNNEL,
  loadLeaveFunnel,
  resetLeaveFunnel,
  saveLeaveFunnel,
  type LeaveFunnelAdvance,
  type LeaveFunnelStep,
} from '../data/keaLeaveFunnel'

const ADVANCE_OPTIONS: Array<{ id: LeaveFunnelAdvance; label: string }> = [
  { id: 'any', label: 'Opening (interest / decline)' },
  { id: 'yes', label: 'Yes / No question' },
  { id: 'start', label: 'Final CTA (create account)' },
]

function blankStep(): LeaveFunnelStep {
  return {
    id: crypto.randomUUID(),
    spoken: '',
    advance: 'yes',
  }
}

export function AdminLeaveFunnelPage() {
  const [steps, setSteps] = useState(() => loadLeaveFunnel().steps)
  const [saved, setSaved] = useState('')

  function patch(index: number, next: Partial<LeaveFunnelStep>) {
    setSteps((current) =>
      current.map((step, i) => (i === index ? { ...step, ...next } : step)),
    )
    setSaved('')
  }

  function commit() {
    const cleaned = steps
      .map((step) => ({
        ...step,
        id: step.id.trim() || crypto.randomUUID(),
        spoken: step.spoken.trim(),
        declineSpoken: step.declineSpoken?.trim() || undefined,
      }))
      .filter((step) => step.spoken)
    if (cleaned.length === 0) {
      setSaved('Add at least one step with wording.')
      return
    }
    saveLeaveFunnel({ steps: cleaned })
    setSteps(cleaned)
    setSaved('Saved.')
  }

  return (
    <>
      <section className="settings-card">
        <h2>Leave funnel</h2>
        <p className="settings-note">
          When someone tries to leave the marketing page without an account, Kea
          walks them through these lines — spoken aloud and shown on screen, one
          after another. Fine-tune the wording here.
        </p>
      </section>

      {steps.map((step, index) => (
        <section key={step.id} className="settings-card">
          <h2>
            Step {index + 1}
            <span className="leave-funnel-admin__meta"> · {step.advance}</span>
          </h2>
          <label className="welcome-field">
            <span>Kea says</span>
            <textarea
              rows={4}
              value={step.spoken}
              onChange={(event) =>
                patch(index, { spoken: event.target.value })
              }
            />
          </label>
          <label className="welcome-field">
            <span>Step type</span>
            <select
              value={step.advance}
              onChange={(event) =>
                patch(index, {
                  advance: event.target.value as LeaveFunnelAdvance,
                })
              }
            >
              {ADVANCE_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          {step.advance === 'any' ? (
            <label className="welcome-field">
              <span>If they say no</span>
              <textarea
                rows={2}
                value={step.declineSpoken ?? ''}
                onChange={(event) =>
                  patch(index, { declineSpoken: event.target.value })
                }
              />
            </label>
          ) : null}
          <div className="leave-funnel-admin__row">
            <button
              type="button"
              className="kea-button kea-button--ghost"
              disabled={index === 0}
              onClick={() => {
                setSteps((current) => {
                  const next = [...current]
                  const [item] = next.splice(index, 1)
                  next.splice(index - 1, 0, item)
                  return next
                })
                setSaved('')
              }}
            >
              Move up
            </button>
            <button
              type="button"
              className="kea-button kea-button--ghost"
              disabled={index >= steps.length - 1}
              onClick={() => {
                setSteps((current) => {
                  const next = [...current]
                  const [item] = next.splice(index, 1)
                  next.splice(index + 1, 0, item)
                  return next
                })
                setSaved('')
              }}
            >
              Move down
            </button>
            <button
              type="button"
              className="kea-button kea-button--ghost"
              disabled={steps.length <= 1}
              onClick={() => {
                setSteps((current) => current.filter((_, i) => i !== index))
                setSaved('')
              }}
            >
              Remove
            </button>
          </div>
        </section>
      ))}

      <section className="settings-card">
        <button
          type="button"
          className="kea-button kea-button--ghost settings-save"
          onClick={() => {
            setSteps((current) => [...current, blankStep()])
            setSaved('')
          }}
        >
          Add step
        </button>
        {saved ? <p className="settings-note">{saved}</p> : null}
        <button type="button" className="kea-button settings-save" onClick={commit}>
          Save leave funnel
        </button>
        <button
          type="button"
          className="kea-button kea-button--ghost settings-save"
          onClick={() => {
            resetLeaveFunnel()
            setSteps(structuredClone(DEFAULT_LEAVE_FUNNEL.steps))
            setSaved('Restored defaults.')
          }}
        >
          Restore defaults
        </button>
      </section>
    </>
  )
}
