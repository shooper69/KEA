import { useRef, type PointerEvent as ReactPointerEvent, type MouseEvent as ReactMouseEvent } from 'react'
import type { VoicePresenceState } from '../../types'

const KEA_MIC_SRC = '/kea-04.png'

interface VoiceMicProps {
  live: boolean
  status: VoicePresenceState
  hint?: string
  wakePhrase?: boolean
  onToggle: () => void
}

/**
 * Kea talk control + the two chat-bubble hints.
 * Phones: fire on pointerdown (finger-down) so a slight move still counts.
 * Click is the mouse / accessibility fallback. Debounced so both cannot double-fire.
 */
export function VoiceMic({
  live,
  status,
  wakePhrase = true,
  onToggle,
}: VoiceMicProps) {
  const lastFireAt = useRef(0)
  const waving = status === 'listening' || status === 'speaking'
  const actionLabel = live
    ? 'Stop conversation'
    : wakePhrase
      ? "Tap to talk or stop me, or say 'Hey Kea' or 'Stop Kea'"
      : 'Tap to talk or stop me'

  function fireToggle() {
    const now = Date.now()
    // Absorb pointerdown + synthetic click, and accidental double taps.
    if (now - lastFireAt.current < 320) return
    lastFireAt.current = now
    onToggle()
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLElement>) {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    // Mouse uses click below; touch/pen need immediate down so scroll-cancel
    // cannot swallow the gesture.
    if (event.pointerType === 'mouse') return
    event.preventDefault()
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // ignore
    }
    fireToggle()
  }

  function handleClick(event: ReactMouseEvent<HTMLElement>) {
    event.preventDefault()
    fireToggle()
  }

  return (
    <div className={`voice-mic-wrap${live ? ' voice-mic-wrap--live' : ''}`}>
      <button
        type="button"
        className="voice-mic__prompt voice-mic__prompt--left"
        aria-label={actionLabel}
        onPointerDown={handlePointerDown}
        onClick={handleClick}
      >
        Tap to talk
        <br />
        or stop me
      </button>
      <div className="voice-mic__center">
        <button
          type="button"
          className={`voice-mic ${live ? 'voice-mic--live' : ''} ${
            waving ? 'voice-mic--waving' : ''
          } ${status === 'speaking' ? 'voice-mic--reply' : ''} ${
            status === 'thinking' ? 'voice-mic--thinking' : ''
          }`}
          aria-pressed={live}
          aria-label={actionLabel}
          onPointerDown={handlePointerDown}
          onClick={handleClick}
        >
          <span className="voice-mic__waves" aria-hidden="true">
            <span className="voice-mic__ring voice-mic__ring--1" />
            <span className="voice-mic__ring voice-mic__ring--2" />
            <span className="voice-mic__ring voice-mic__ring--3" />
          </span>
          <img className="voice-mic__icon" src={KEA_MIC_SRC} alt="" />
        </button>
      </div>
      <button
        type="button"
        className="voice-mic__prompt voice-mic__prompt--right"
        aria-label={
          wakePhrase
            ? "Or say 'Hey Kea' or 'Stop Kea'"
            : "Or say 'Hey Kea' or 'Stop Kea' when available"
        }
        onPointerDown={handlePointerDown}
        onClick={handleClick}
      >
        or say &apos;Hey Kea&apos;
        <br />
        or &apos;Stop Kea&apos;
      </button>
    </div>
  )
}
