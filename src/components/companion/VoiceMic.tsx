import type { VoicePresenceState } from '../../types'

const KEA_MIC_SRC = '/kea-04.png'

interface VoiceMicProps {
  live: boolean
  status: VoicePresenceState
  hint?: string
  onToggle: () => void
}

export function VoiceMic({ live, status, onToggle }: VoiceMicProps) {
  const waving = status === 'listening' || status === 'speaking'

  return (
    <div
      className={`voice-mic-wrap${live ? ' voice-mic-wrap--live' : ''}`}
      onClick={(event) => {
        const target = event.target as HTMLElement
        if (target.closest('button.voice-mic')) return
        onToggle()
      }}
    >
      <p className="voice-mic__prompt voice-mic__prompt--left" aria-hidden="true">
        Tap to talk
        <br />
        or stop me
      </p>
      <button
        type="button"
        className={`voice-mic ${live ? 'voice-mic--live' : ''} ${
          waving ? 'voice-mic--waving' : ''
        } ${status === 'speaking' ? 'voice-mic--reply' : ''} ${
          status === 'thinking' ? 'voice-mic--thinking' : ''
        }`}
        aria-pressed={live}
        aria-label={
          live
            ? 'Stop conversation'
            : "Tap to talk or stop me, or say 'Yo Kea' or 'Stop Kea'"
        }
        onClick={onToggle}
      >
        <span className="voice-mic__waves" aria-hidden="true">
          <span className="voice-mic__ring voice-mic__ring--1" />
          <span className="voice-mic__ring voice-mic__ring--2" />
          <span className="voice-mic__ring voice-mic__ring--3" />
        </span>
        <img className="voice-mic__icon" src={KEA_MIC_SRC} alt="" />
      </button>
      <p className="voice-mic__prompt voice-mic__prompt--right" aria-hidden="true">
        or say 'Yo Kea'
        <br />
        or 'Stop Kea'
      </p>
    </div>
  )
}
