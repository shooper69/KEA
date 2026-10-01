import { useEffect, useRef, useState } from 'react'
import { KEA_FLY_SRC } from '../../data/keaAbout'
import {
  loadLeaveFunnel,
  type LeaveFunnelStep,
} from '../../data/keaLeaveFunnel'
import { getMarketingIntroVoice } from '../../architecture/voiceCatalog'
import { speakManagedVoice, speakKeaLine, stopKeaSpeech } from '../../services/keaSpeak'

const KEA_MIC_SRC = '/kea-04.png'
const KEA_MARK_SRC = '/kea-05.png'

const SCENE_COUNT = 8

const KEA_BY_SCENE = [
  KEA_FLY_SRC,
  KEA_MIC_SRC,
  KEA_MARK_SRC,
  KEA_FLY_SRC,
  KEA_MIC_SRC,
  KEA_MARK_SRC,
  KEA_FLY_SRC,
  KEA_MIC_SRC,
] as const

interface LeaveAccountPopupProps {
  onCreateAccount: () => void
  onStay: () => void
  onLeave: () => void
}

/** Conversational leave funnel — Kea speaks and shows each line in turn. */
export function LeaveAccountPopup({
  onCreateAccount,
  onStay,
  onLeave,
}: LeaveAccountPopupProps) {
  const [steps] = useState(() => loadLeaveFunnel().steps)
  const [index, setIndex] = useState(0)
  const [declineLine, setDeclineLine] = useState('')
  const [busy, setBusy] = useState(false)
  const [awaiting, setAwaiting] = useState(false)
  const [declining, setDeclining] = useState(false)
  const runId = useRef(0)

  const step: LeaveFunnelStep | undefined = steps[index]
  const visibleLine = declining ? declineLine : (step?.spoken ?? '')
  const scene = declining ? SCENE_COUNT - 1 : index % SCENE_COUNT
  const keaSrc = KEA_BY_SCENE[scene] ?? KEA_FLY_SRC

  useEffect(() => {
    return () => {
      runId.current += 1
      stopKeaSpeech()
    }
  }, [])

  useEffect(() => {
    if (!step || declining) return
    const id = ++runId.current
    const text = step.spoken
    setBusy(true)
    setAwaiting(false)
    stopKeaSpeech()
    const voice = getMarketingIntroVoice()
    const finish = () => {
      if (id !== runId.current) return
      setBusy(false)
      setAwaiting(true)
    }
    const opts = {
      onend: finish,
      onerror: finish,
    }
    // One path only — never fall through to a second speak.
    if (voice) void speakManagedVoice(voice, text, opts)
    else void speakKeaLine(text, opts)
  }, [index, declining, step?.id, step?.spoken])

  async function speakDeclineThenLeave() {
    const decline =
      step?.declineSpoken?.trim() ||
      "OK see you, but I think you'll be back."
    setDeclining(true)
    setAwaiting(false)
    setBusy(true)
    setDeclineLine(decline)
    const id = ++runId.current
    stopKeaSpeech()
    const voice = getMarketingIntroVoice()
    await new Promise<void>((resolve) => {
      const finish = () => {
        if (id !== runId.current) return
        setBusy(false)
        resolve()
      }
      const opts = {
        onend: finish,
        onerror: finish,
      }
      if (voice) void speakManagedVoice(voice, decline, opts)
      else void speakKeaLine(decline, opts)
    })
    window.setTimeout(() => {
      stopKeaSpeech()
      onLeave()
    }, 900)
  }

  function goNext() {
    stopKeaSpeech()
    if (index >= steps.length - 1) {
      onCreateAccount()
      return
    }
    setIndex((value) => value + 1)
  }

  function onStart() {
    stopKeaSpeech()
    onCreateAccount()
  }

  if (!step) return null

  return (
    <div
      className="leave-account"
      role="dialog"
      aria-modal="true"
      aria-labelledby="leave-funnel-line"
    >
      <div
        key={`scene-${scene}-${declining ? 'bye' : index}`}
        className={`leave-account__card leave-account__card--funnel leave-funnel--scene-${scene}`}
      >
        <button
          type="button"
          className="leave-account__close"
          onClick={() => {
            stopKeaSpeech()
            onStay()
          }}
        >
          Close
        </button>
        <div className="leave-funnel__stage" aria-hidden="true">
          <span className="leave-funnel__blob leave-funnel__blob--a" />
          <span className="leave-funnel__blob leave-funnel__blob--b" />
          <span className="leave-funnel__blob leave-funnel__blob--c" />
          <div className="leave-funnel__who">
            <img src={keaSrc} alt="" />
          </div>
        </div>
        <div className="leave-funnel__copy">
          <p
            id="leave-funnel-line"
            className="leave-funnel__line"
            aria-live="polite"
            aria-busy={busy}
          >
            {visibleLine}
          </p>
          {awaiting && !declining ? (
            <div className="leave-funnel__actions">
              {step.advance === 'any' ? (
                <>
                  <button
                    type="button"
                    className="kea-button"
                    onClick={goNext}
                  >
                    I&apos;m up for a quick chat
                  </button>
                  <button
                    type="button"
                    className="kea-button kea-button--ghost"
                    onClick={() => void speakDeclineThenLeave()}
                  >
                    No thanks
                  </button>
                </>
              ) : null}
              {step.advance === 'yes' ? (
                <>
                  <button type="button" className="kea-button" onClick={goNext}>
                    Yes
                  </button>
                  <button
                    type="button"
                    className="kea-button kea-button--ghost"
                    onClick={goNext}
                  >
                    No
                  </button>
                </>
              ) : null}
              {step.advance === 'start' ? (
                <>
                  <button type="button" className="kea-button" onClick={onStart}>
                    Let&apos;s get to know each other
                  </button>
                  <button
                    type="button"
                    className="kea-button kea-button--ghost"
                    onClick={() => {
                      stopKeaSpeech()
                      onStay()
                    }}
                  >
                    Not now
                  </button>
                </>
              ) : null}
            </div>
          ) : null}
          {declining && !busy ? (
            <p className="leave-funnel__footnote">Closing…</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
