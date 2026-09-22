import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { CloudAtmosphere } from '../components/companion/CloudAtmosphere'
import { KeaMark } from '../components/companion/KeaMark'
import { RisingWords } from '../components/companion/RisingWords'
import { VoiceMic } from '../components/companion/VoiceMic'
import { VoiceSettingsPanel } from '../components/companion/VoiceSettingsPanel'
import { WordMemoryPanel } from '../components/companion/WordMemoryPanel'
import { getLanguage } from '../config/languages'
import { useSession } from '../context/SessionContext'
import { useVoiceConversation } from '../hooks/useVoiceConversation'
import { PLACEHOLDER_TRANSCRIPTS } from '../data/placeholders'
import type { VoicePresenceState } from '../types'

export function ConversationPage() {
  const { languageCode, nativeLanguage, level, activeVocabulary } = useSession()
  const [memoryOpen, setMemoryOpen] = useState(false)
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
  const displayMessages =
    voice.messages.length > 0
      ? voice.messages
      : PLACEHOLDER_TRANSCRIPTS[languageCode]

  const presence: VoicePresenceState =
    voice.status === 'thinking' ? 'listening' : voice.status

  return (
    <main className="companion-screen conversation-screen">
      <CloudAtmosphere presence={presence} />
      <header className="conversation-screen__header">
        <KeaMark className="kea-mark--header" />
        <div className="conversation-screen__header-actions">
          <p className="conversation-screen__language">{language.name}</p>
          <button
            type="button"
            className="memory-button"
            onClick={() => {
              setSettingsOpen((open) => !open)
              setMemoryOpen(false)
            }}
          >
            Voice
          </button>
          <button
            type="button"
            className="memory-button"
            aria-expanded={memoryOpen}
            aria-controls="word-memory"
            onClick={() => {
              setMemoryOpen((open) => !open)
              setSettingsOpen(false)
            }}
          >
            Memory
            <span className="memory-button__count">{activeVocabulary.length}</span>
          </button>
        </div>
      </header>
      <div id="word-memory">
        <WordMemoryPanel open={memoryOpen} onClose={() => setMemoryOpen(false)} />
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
      </div>
      <RisingWords messages={displayMessages} live={voice.messages.length > 0} />
      {voice.error ? <p className="voice-error">{voice.error}</p> : null}
      <VoiceMic live={live} status={voice.status} onToggle={voice.toggle} />
    </main>
  )
}
