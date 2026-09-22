import { useEffect, useMemo, useState } from 'react'
import { listVoices, speakText, stopSpeech } from '../lib/speech'
import {
  readChosenTts,
  saveChosenTts,
  subscribeVoices,
  TTS_SAMPLE,
  type ChosenTtsVoice,
} from '../lib/chosenTts'

export function AdminVoiceTesterPage() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() => listVoices())
  const [rate, setRate] = useState(1)
  const [pitch, setPitch] = useState(1)
  const [chosen, setChosen] = useState<ChosenTtsVoice | null>(readChosenTts)
  const [playing, setPlaying] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => subscribeVoices(setVoices), [])

  useEffect(() => {
    const saved = readChosenTts()
    if (!saved) return
    setChosen(saved)
    setRate(saved.rate)
    setPitch(saved.pitch)
  }, [])

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const list = [...voices].sort((a, b) =>
      a.lang.localeCompare(b.lang) || a.name.localeCompare(b.name),
    )
    if (!needle) return list
    return list.filter(
      (voice) =>
        voice.name.toLowerCase().includes(needle) ||
        voice.lang.toLowerCase().includes(needle),
    )
  }, [query, voices])

  function play(voice: SpeechSynthesisVoice) {
    setPlaying(voice.voiceURI)
    speakText(TTS_SAMPLE, {
      lang: voice.lang,
      rate,
      pitch,
      voiceURI: voice.voiceURI,
      onend: () => setPlaying(null),
      onerror: () => setPlaying(null),
    })
  }

  function select(voice: SpeechSynthesisVoice) {
    const next: ChosenTtsVoice = {
      voiceURI: voice.voiceURI,
      name: voice.name,
      lang: voice.lang,
      rate,
      pitch,
    }
    saveChosenTts(next)
    setChosen(next)
  }

  return (
    <section className="settings-card">
      <h2>Voice Tester</h2>
      <p className="settings-note">
        Diagnostics only. Lists every voice this browser reports. User-facing
        voices are curated in Voice Management.
      </p>
      {chosen ? (
        <p className="settings-note">
          Saved: {chosen.name} · {chosen.lang} · speed {chosen.rate.toFixed(2)} ·
          pitch {chosen.pitch.toFixed(2)}
        </p>
      ) : (
        <p className="settings-note">No voice saved yet.</p>
      )}
      <label className="welcome-field">
        <span>Speed {rate.toFixed(2)}</span>
        <input
          type="range"
          min="0.5"
          max="1.6"
          step="0.05"
          value={rate}
          onChange={(event) => setRate(Number(event.target.value))}
        />
      </label>
      <label className="welcome-field">
        <span>Pitch {pitch.toFixed(2)}</span>
        <input
          type="range"
          min="0.5"
          max="2"
          step="0.05"
          value={pitch}
          onChange={(event) => setPitch(Number(event.target.value))}
        />
      </label>
      <label className="memory-library__search">
        <span className="visually-hidden">Search voices</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name or language"
        />
      </label>
      <p className="settings-note">{rows.length} voices</p>
      {rows.length === 0 ? (
        <p className="settings-note">
          This browser has not listed any voices yet. Try Chrome or Edge, or
          wait a moment.
        </p>
      ) : (
        <ul className="voice-tester__list">
          {rows.map((voice) => {
            const selected = chosen?.voiceURI === voice.voiceURI
            return (
              <li
                key={voice.voiceURI}
                className={`voice-tester__row${selected ? ' is-chosen' : ''}`}
              >
                <div>
                  <p className="voice-tester__name">{voice.name}</p>
                  <p className="voice-tester__lang">{voice.lang}</p>
                </div>
                <div className="voice-tester__actions">
                  <button
                    type="button"
                    className="memory-button"
                    onClick={() => play(voice)}
                  >
                    {playing === voice.voiceURI ? 'Playing' : 'Play'}
                  </button>
                  <button
                    type="button"
                    className="memory-button"
                    onClick={() => select(voice)}
                  >
                    {selected ? 'Saved' : 'Use this'}
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      <button type="button" className="auth-text-link" onClick={() => stopSpeech()}>
        Stop
      </button>
    </section>
  )
}
