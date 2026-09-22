import { VOICE_PERSONALITIES } from '../../config/voices'
import type { VoicePersonalityId } from '../../types'

interface VoiceSettingsPanelProps {
  open: boolean
  onClose: () => void
  characterId: VoicePersonalityId
  onCharacter: (id: VoicePersonalityId) => void
  rate: number
  onRate: (value: number) => void
  onPause: () => void
  onResume: () => void
  onStop: () => void
}

export function VoiceSettingsPanel({
  open,
  onClose,
  characterId,
  onCharacter,
  rate,
  onRate,
  onPause,
  onResume,
  onStop,
}: VoiceSettingsPanelProps) {
  if (!open) return null

  return (
    <aside className="voice-cast" aria-label="Choose a voice character">
      <div className="voice-cast__header">
        <div>
          <p className="voice-cast__kicker">Kea’s mood</p>
          <h2>Choose a mood</h2>
          <p>
            It is still Kea. Each mood has a different manner.
          </p>
        </div>
        <button type="button" className="voice-cast__close" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="voice-cast__list" role="listbox" aria-label="Moods">
        {VOICE_PERSONALITIES.map((mood) => {
          const selected = mood.id === characterId
          return (
            <button
              key={mood.id}
              type="button"
              role="option"
              aria-selected={selected}
              className={`voice-cast__choice${selected ? ' is-chosen' : ''}`}
              onClick={() => onCharacter(mood.id)}
            >
              <span className="voice-cast__name">{mood.name}</span>
              <span className="voice-cast__style">{mood.style}</span>
            </button>
          )
        })}
      </div>
      <label className="voice-cast__pace">
        <span>Pace</span>
        <input
          type="range"
          min="0.7"
          max="1.2"
          step="0.05"
          value={rate}
          onChange={(event) => onRate(Number(event.target.value))}
        />
      </label>
      <div className="voice-cast__row">
        <button type="button" onClick={onPause}>
          Hush
        </button>
        <button type="button" onClick={onResume}>
          Go on
        </button>
        <button type="button" onClick={onStop}>
          Rest
        </button>
      </div>
    </aside>
  )
}
