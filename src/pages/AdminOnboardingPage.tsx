import { useState } from 'react'
import {
  DEFAULT_ONBOARDING_STEPS,
  clearSpokenOnboardingComplete,
  loadOnboardingSteps,
  resetOnboardingSteps,
  saveOnboardingSteps,
  type OnboardingStep,
} from '../data/keaOnboarding'
import { getLearnMasteryUses } from '../data/keaLearnMastery'

export function AdminOnboardingPage() {
  const [steps, setSteps] = useState(() => loadOnboardingSteps())
  const [saved, setSaved] = useState('')
  const mastery = getLearnMasteryUses()

  function patch(index: number, next: Partial<OnboardingStep>) {
    setSteps((current) =>
      current.map((item, i) => (i === index ? { ...item, ...next } : item)),
    )
    setSaved('')
  }

  function move(index: number, dir: -1 | 1) {
    setSteps((current) => {
      const target = index + dir
      if (target < 0 || target >= current.length) return current
      const copy = [...current]
      const [row] = copy.splice(index, 1)
      copy.splice(target, 0, row)
      return copy
    })
    setSaved('')
  }

  function remove(index: number) {
    setSteps((current) => current.filter((_, i) => i !== index))
    setSaved('')
  }

  function addStep() {
    setSteps((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        title: 'New step',
        spoken: '',
      },
    ])
    setSaved('')
  }

  function commit() {
    saveOnboardingSteps(steps)
    setSteps(loadOnboardingSteps())
    setSaved('Saved.')
  }

  function reset() {
    resetOnboardingSteps()
    setSteps(loadOnboardingSteps())
    setSaved('Restored defaults.')
  }

  return (
    <>
      <section className="settings-card">
        <h2>Onboarding</h2>
        <p className="settings-note">
          Spoken tour for new registrants after the microphone choice. Kea says
          each step; the user presses Next to continue (no voice “yes”). Use{' '}
          {'{masteryUses}'} for the Learn List threshold (currently {mastery}).
        </p>
        <div className="admin-onboarding__toolbar">
          <button type="button" className="kea-button" onClick={commit}>
            Save
          </button>
          <button type="button" className="kea-button kea-button--ghost" onClick={addStep}>
            Add step
          </button>
          <button type="button" className="kea-button kea-button--ghost" onClick={reset}>
            Reset defaults
          </button>
          <button
            type="button"
            className="kea-button kea-button--ghost"
            onClick={() => {
              clearSpokenOnboardingComplete()
              setSaved('Onboarding will play again on next chat visit.')
            }}
          >
            Replay for me
          </button>
        </div>
        {saved ? <p className="settings-note">{saved}</p> : null}
      </section>

      {steps.map((step, index) => (
        <section key={step.id} className="settings-card">
          <div className="admin-onboarding__row-head">
            <h2>
              Step {index + 1}
              {step.title ? ` · ${step.title}` : ''}
            </h2>
            <div className="admin-onboarding__moves">
              <button
                type="button"
                className="kea-button kea-button--ghost"
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                Up
              </button>
              <button
                type="button"
                className="kea-button kea-button--ghost"
                disabled={index === steps.length - 1}
                onClick={() => move(index, 1)}
              >
                Down
              </button>
              <button
                type="button"
                className="kea-button kea-button--ghost"
                onClick={() => remove(index)}
              >
                Remove
              </button>
            </div>
          </div>
          <label className="welcome-field">
            <span>Admin label</span>
            <input
              value={step.title}
              onChange={(event) => patch(index, { title: event.target.value })}
            />
          </label>
          <label className="welcome-field">
            <span>What Kea says (before OK?)</span>
            <textarea
              rows={4}
              value={step.spoken}
              onChange={(event) => patch(index, { spoken: event.target.value })}
            />
          </label>
        </section>
      ))}

      {steps.length === 0 ? (
        <section className="settings-card">
          <p className="settings-note">
            No steps yet.{' '}
            <button
              type="button"
              className="kea-button kea-button--ghost"
              onClick={() => setSteps(structuredClone(DEFAULT_ONBOARDING_STEPS))}
            >
              Load defaults
            </button>
          </p>
        </section>
      ) : null}
    </>
  )
}
