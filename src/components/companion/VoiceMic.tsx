import type { VoicePresenceState } from '../../types'

interface VoiceMicProps {
  live: boolean
  status: VoicePresenceState
  onToggle: () => void
}

const STATUS_LABEL: Record<VoicePresenceState, string> = {
  idle: 'Tap to talk',
  listening: 'Listening',
  thinking: 'Thinking',
  speaking: 'Speaking',
}

export function VoiceMic({ live, status, onToggle }: VoiceMicProps) {
  const waving = status === 'listening' || status === 'speaking'

  return (
    <div className="voice-mic-wrap">
      <button
        type="button"
        className={`voice-mic ${live ? 'voice-mic--live' : ''} ${
          waving ? 'voice-mic--waving' : ''
        } ${status === 'speaking' ? 'voice-mic--reply' : ''} ${
          status === 'thinking' ? 'voice-mic--thinking' : ''
        }`}
        aria-pressed={live}
        aria-label={live ? 'Stop conversation' : 'Start conversation'}
        onClick={onToggle}
      >
        <svg className="voice-mic__icon" viewBox="0 0 120 120" aria-hidden="true">
          <defs>
            <linearGradient id="mic-body" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7cf0ff" />
              <stop offset="50%" stopColor="#6b8cff" />
              <stop offset="100%" stopColor="#c46bff" />
            </linearGradient>
          </defs>
          <path
            className="voice-mic__wave voice-mic__wave--l2"
            d="M28 46 C22 52 20 60 20 68 C20 76 22 84 28 90"
            fill="none"
            stroke="url(#mic-body)"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            className="voice-mic__wave voice-mic__wave--l1"
            d="M38 52 C34 56 32 62 32 68 C32 74 34 80 38 84"
            fill="none"
            stroke="url(#mic-body)"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            className="voice-mic__wave voice-mic__wave--r1"
            d="M82 52 C86 56 88 62 88 68 C88 74 86 80 82 84"
            fill="none"
            stroke="url(#mic-body)"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            className="voice-mic__wave voice-mic__wave--r2"
            d="M92 46 C98 52 100 60 100 68 C100 76 98 84 92 90"
            fill="none"
            stroke="url(#mic-body)"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <rect x="50" y="22" width="20" height="36" rx="10" fill="url(#mic-body)" />
          <path
            d="M44 56 C44 66 51 72 60 72 C69 72 76 66 76 56"
            fill="none"
            stroke="url(#mic-body)"
            strokeWidth="3.2"
            strokeLinecap="round"
          />
          <line
            x1="60"
            y1="72"
            x2="60"
            y2="86"
            stroke="url(#mic-body)"
            strokeWidth="3.2"
            strokeLinecap="round"
          />
          <line
            x1="48"
            y1="86"
            x2="72"
            y2="86"
            stroke="url(#mic-body)"
            strokeWidth="3.2"
            strokeLinecap="round"
          />
        </svg>
      </button>
      <p className="voice-mic__status">{STATUS_LABEL[status]}</p>
    </div>
  )
}
