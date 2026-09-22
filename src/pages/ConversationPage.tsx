import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { CloudAtmosphere } from '../components/companion/CloudAtmosphere'
import { KeaMark } from '../components/companion/KeaMark'
import { RisingWords } from '../components/companion/RisingWords'
import { VoiceMic } from '../components/companion/VoiceMic'
import { VoiceSettingsPanel } from '../components/companion/VoiceSettingsPanel'
import { getLanguage } from '../config/languages'
import { useSession } from '../context/SessionContext'
import { useVoiceConversation } from '../hooks/useVoiceConversation'
import type { VoicePresenceState } from '../types'

export function ConversationPage() {
  const { languageCode, nativeLanguage, level, activeVocabulary } = useSession()
  const [settingsOpen, setSettingsOpen] = useState(false)

  const voice = useVoiceConversation({
    targetLanguage: languageCode ?? 'es',
    nativeLanguage,
    level,
  })

  if (!languageCode) {
    return <Navigate to="/" replace />
  }

  const language = getLanguage(languageCode)
  const live = voice.handsFree || voice.status !== 'idle'

  const presence: VoicePresenceState =
    voice.status === 'thinking' ? 'listening' : voice.status

  return (
    <main className="companion-screen conversation-screen">
      <CloudAtmosphere presence={presence} />
      <header className="conversation-screen__header">
        <Link to="/" aria-label="KEA home">
          <KeaMark className="kea-mark--header" />
        </Link>
        <div className="conversation-screen__header-actions">
          <p className="conversation-screen__language">{language.name}</p>
          <button
            type="button"
            className="memory-button"
            onClick={() => setSettingsOpen((open) => !open)}
          >
            Voice
          </button>
          <Link className="memory-button" to="/memory">
            Memory
            <span className="memory-button__count">{activeVocabulary.length}</span>
          </Link>
        </div>
      </header>
      <VoiceSettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        voices={voice.voices}
        voiceURI={voice.voiceURI}
        onVoiceURI={voice.setVoiceURI}
        rate={voice.rate}
        onRate={voice.setRate}
        onPause={voice.pauseSpeech}
        onResume={voice.resumeSpeech}
        onStop={voice.stopSpeech}
      />
      <div className="conversation-screen__stage">
        <RisingWords messages={voice.messages} live />
      </div>
      {voice.error ? <p className="voice-error">{voice.error}</p> : null}
      <VoiceMic live={live} status={voice.status} onToggle={voice.toggle} />
    </main>
  )
}
