import { useEffect, useMemo, useState } from 'react'
import {
  countEnabled,
  loadVoiceCatalog,
  MAX_USER_VOICES,
  mergeBrowserVoices,
  saveVoiceCatalog,
  VOICE_SAMPLE,
  type ManagedVoice,
  type VoiceCatalog,
} from '../architecture/voiceCatalog'
import { subscribeVoices } from '../lib/chosenTts'
import { speakManagedVoice, stopKeaSpeech } from '../services/keaSpeak'

export function AdminVoiceManagementPage() {
  const [catalog, setCatalog] = useState<VoiceCatalog>(() => loadVoiceCatalog())
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState('')
  const [playingId, setPlayingId] = useState<string | null>(null)

  useEffect(() => {
    return subscribeVoices((installed) => {
      setCatalog((current) => {
        const next = mergeBrowserVoices(current, installed)
        saveVoiceCatalog(next)
        return next
      })
    })
  }, [])

  const openaiVoices = useMemo(
    () => filterGroup(catalog.voices, 'openai', query),
    [catalog.voices, query],
  )
  const browserVoices = useMemo(
    () => filterGroup(catalog.voices, 'browser', query),
    [catalog.voices, query],
  )
  const enabledCount = countEnabled(catalog)

  function commit(next: VoiceCatalog) {
    saveVoiceCatalog(next)
    setCatalog(next)
  }

  function patchVoice(id: string, patch: Partial<ManagedVoice>) {
    if (patch.enabled === true && !catalog.voices.find((item) => item.id === id)?.enabled) {
      if (enabledCount >= MAX_USER_VOICES) {
        setNotice(`Users can only see ${MAX_USER_VOICES} voices. Turn one off first.`)
        return
      }
    }
    setNotice('')
    commit({
      ...catalog,
      voices: catalog.voices.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    })
  }

  async function play(voice: ManagedVoice) {
    setPlayingId(voice.id)
    setNotice('')
    await speakManagedVoice(voice, VOICE_SAMPLE, {
      lang: voice.lang,
      onend: () => setPlayingId(null),
      onerror: () => {
        setPlayingId(null)
        setNotice(
          voice.provider === 'openai'
            ? 'Could not play that OpenAI voice. Check OPENAI_API_KEY on the server.'
            : 'Could not play that browser voice.',
        )
      },
    })
  }

  return (
    <section className="settings-card">
      <h2>Voice Management</h2>
      <p className="settings-note">
        Curate up to {MAX_USER_VOICES} voices for users. They only see the
        names and descriptions you write here. Changes save on this device so
        you can rename voices without a code change. The Voice Tester stays for
        diagnostics.
      </p>
      <p className="settings-note">
        {enabledCount} of {MAX_USER_VOICES} enabled for users.
      </p>
      {notice ? <p className="error-text">{notice}</p> : null}
      <label className="welcome-field">
        <span>Find a voice</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Coral, Microsoft Aria, Friendly Companion…"
        />
      </label>
      <h3 className="voice-manage__heading">OpenAI voices</h3>
      <ul className="voice-manage__list">
        {openaiVoices.map((voice) => (
          <VoiceRow
            key={voice.id}
            voice={voice}
            isDefault={catalog.defaultId === voice.id}
            playing={playingId === voice.id}
            onPatch={(patch) => patchVoice(voice.id, patch)}
            onDefault={() => commit({ ...catalog, defaultId: voice.id })}
            onPlay={() => void play(voice)}
            onStop={stopKeaSpeech}
          />
        ))}
      </ul>
      <h3 className="voice-manage__heading">Browser voices</h3>
      <ul className="voice-manage__list">
        {browserVoices.map((voice) => (
          <VoiceRow
            key={voice.id}
            voice={voice}
            isDefault={catalog.defaultId === voice.id}
            playing={playingId === voice.id}
            onPatch={(patch) => patchVoice(voice.id, patch)}
            onDefault={() => commit({ ...catalog, defaultId: voice.id })}
            onPlay={() => void play(voice)}
            onStop={stopKeaSpeech}
          />
        ))}
      </ul>
      {!browserVoices.length ? (
        <p className="settings-note">No installed browser voices found yet.</p>
      ) : null}
    </section>
  )
}

function filterGroup(
  voices: ManagedVoice[],
  provider: ManagedVoice['provider'],
  query: string,
) {
  const needle = query.trim().toLowerCase()
  return voices.filter((item) => {
    if (item.provider !== provider) return false
    if (!needle) return true
    return `${item.actualName} ${item.userName} ${item.userDescription} ${item.lang}`
      .toLowerCase()
      .includes(needle)
  })
}

function VoiceRow({
  voice,
  isDefault,
  playing,
  onPatch,
  onDefault,
  onPlay,
  onStop,
}: {
  voice: ManagedVoice
  isDefault: boolean
  playing: boolean
  onPatch: (patch: Partial<ManagedVoice>) => void
  onDefault: () => void
  onPlay: () => void
  onStop: () => void
}) {
  return (
    <li className={`voice-manage__row${voice.enabled ? ' is-enabled' : ''}${isDefault ? ' is-default' : ''}`}>
      <p className="voice-manage__actual">{voice.actualName}</p>
      <p className="voice-manage__meta">
        {voice.provider === 'openai' ? 'OpenAI' : 'Browser'}
        {voice.lang ? ` · ${voice.lang}` : ''}
      </p>
      <label className="welcome-field">
        <span>User visible name</span>
        <input
          value={voice.userName}
          onChange={(event) => onPatch({ userName: event.target.value })}
          placeholder="Friendly Companion"
        />
      </label>
      <label className="welcome-field">
        <span>User visible description</span>
        <input
          value={voice.userDescription}
          onChange={(event) => onPatch({ userDescription: event.target.value })}
          placeholder="Warm, thoughtful and supportive."
        />
      </label>
      <div className="voice-manage__flags">
        <label>
          <input
            type="checkbox"
            checked={voice.enabled}
            onChange={(event) => onPatch({ enabled: event.target.checked })}
          />
          Enable for users
        </label>
        <label>
          <input
            type="radio"
            name="kea-default-voice"
            checked={isDefault}
            onChange={onDefault}
          />
          Default voice
        </label>
      </div>
      <div className="voice-manage__actions">
        <button type="button" className="memory-button" onClick={playing ? onStop : onPlay}>
          {playing ? 'Stop' : 'Play sample'}
        </button>
      </div>
    </li>
  )
}
