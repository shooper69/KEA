interface VoiceSettingsPanelProps {
  open: boolean
  onClose: () => void
  voices: SpeechSynthesisVoice[]
  voiceURI: string
  onVoiceURI: (value: string) => void
  rate: number
  onRate: (value: number) => void
  onPause: () => void
  onResume: () => void
  onStop: () => void
}

export function VoiceSettingsPanel({
  open,
  onClose,
  voices,
  voiceURI,
  onVoiceURI,
  rate,
  onRate,
  onPause,
  onResume,
  onStop,
}: VoiceSettingsPanelProps) {
  if (!open) return null

  const targetVoices = voices.filter((voice) =>
    /es|fr|de|en/i.test(voice.lang),
  )
  const options = targetVoices.length > 0 ? targetVoices : voices

  return (
    <aside className="word-memory" aria-label="Voice settings">
      <div className="word-memory__header">
        <div>
          <h2>Voice</h2>
          <p>Choose a browser voice, then tap the microphone to talk.</p>
        </div>
        <button type="button" className="word-memory__close" onClick={onClose}>
          Close
        </button>
      </div>
      <label className="voice-settings__label">
        Voice
        <select
          value={voiceURI}
          onChange={(event) => onVoiceURI(event.target.value)}
        >
          <option value="">Match the language</option>
          {options.map((voice) => (
            <option key={voice.voiceURI} value={voice.voiceURI}>
              {voice.name} ({voice.lang})
            </option>
          ))}
        </select>
      </label>
      <label className="voice-settings__label">
        Speed {rate.toFixed(2)}
        <input
          type="range"
          min="0.7"
          max="1.2"
          step="0.05"
          value={rate}
          onChange={(event) => onRate(Number(event.target.value))}
        />
      </label>
      <div className="voice-settings__row">
        <button type="button" onClick={onPause}>
          Pause
        </button>
        <button type="button" onClick={onResume}>
          Resume
        </button>
        <button type="button" onClick={onStop}>
          Stop
        </button>
      </div>
    </aside>
  )
}
