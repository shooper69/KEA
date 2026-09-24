import type { KeyboardEvent } from 'react'
import type { VoicePresenceState } from '../../types'

const KEA_MIC_SRC = '/kea-04.png'

interface VoiceMicProps {
  live: boolean
  status: VoicePresenceState
  hint?: string
  wakePhrase?: boolean
  /** Admin-only mic name shown under the Kea image. */
  micLabel?: string
  onToggle: () => void
}

function ignoreAccidentalKeyboardActivate(
  event: KeyboardEvent<HTMLButtonElement>,
) {
  // Typing / Space must not fire the mic like a tap. Allow only real
  // keyboard focus (:focus-visible from Tab).
  if (event.key !== 'Enter' && event.key !== ' ') return
  if (!event.currentTarget.matches(':focus-visible')) {
    event.preventDefault()
  }
}

export function VoiceMic({
  live,
  status,
  wakePhrase = true,
  micLabel = '',
  onToggle,
}: VoiceMicProps) {
  const waving = status === 'listening' || status === 'speaking'
  const actionLabel = live
    ? 'Stop conversation'
    : wakePhrase
      ? "Tap to talk or stop me, or say 'Kea' or 'Stop Kea'"
      : 'Tap to talk or stop me'

  function handleToggle() {
    onToggle()
    // Drop focus so later Space/typing cannot re-trigger the button.
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
        onClick={handleToggle}
        onKeyDown={ignoreAccidentalKeyboardActivate}
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
          onClick={handleToggle}
          onKeyDown={ignoreAccidentalKeyboardActivate}
        >
          <span className="voice-mic__waves" aria-hidden="true">
            <span className="voice-mic__ring voice-mic__ring--1" />
            <span className="voice-mic__ring voice-mic__ring--2" />
            <span className="voice-mic__ring voice-mic__ring--3" />
          </span>
          <img className="voice-mic__icon" src={KEA_MIC_SRC} alt="" />
        </button>
        {micLabel ? (
          <p className="voice-mic-device" aria-live="polite">
            {micLabel}
          </p>
        ) : null}
      </div>
      <p
        className={`voice-mic__prompt voice-mic__prompt--right${
          wakePhrase ? '' : ' voice-mic__prompt--reserved'
        }`}
        aria-hidden="true"
      >
        or say 'Kea'
        <br />
        or 'Stop Kea'
      </p>
    </div>
  )
}
