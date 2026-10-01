import type { PointerEvent as ReactPointerEvent } from 'react'
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
 * Prefer pointerup (finger/mouse) so taps feel instant on phones.
 */
export function VoiceMic({
  live,
  status,
  wakePhrase = true,
  onToggle,
}: VoiceMicProps) {
  const waving = status === 'listening' || status === 'speaking'
  const actionLabel = live
    ? 'Stop conversation'
    : wakePhrase
      ? "Tap to talk or stop me, or say 'Hey Kea' or 'Stop Kea'"
      : 'Tap to talk or stop me'

  function handlePointerUp(event: ReactPointerEvent<HTMLElement>) {
    // Only primary button / finger; ignore hover leftovers.
    if (event.pointerType === 'mouse' && event.button !== 0) return
    event.preventDefault()
    onToggle()
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
  }

  return (
    <div className={`voice-mic-wrap${live ? ' voice-mic-wrap--live' : ''}`}>
      <button
        type="button"
        className="voice-mic__prompt voice-mic__prompt--left"
        aria-label={actionLabel}
        onPointerUp={handlePointerUp}
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
          onPointerUp={handlePointerUp}
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
        onPointerUp={handlePointerUp}
      >
        or say &apos;Hey Kea&apos;
        <br />
        or &apos;Stop Kea&apos;
      </button>
    </div>
  )
}
