import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { CloudAtmosphere } from '../components/companion/CloudAtmosphere'
import { KeaMark } from '../components/companion/KeaMark'
import { CompanionNav } from '../components/companion/CompanionNav'
import { PaywallModal, useTalkGate } from '../components/companion/PaywallModal'
import { RisingWords } from '../components/companion/RisingWords'
import { VoiceMic } from '../components/companion/VoiceMic'
import { recordTalkSeconds } from '../architecture/keaBilling'
import { useSession } from '../context/SessionContext'
import { useVoiceConversation } from '../hooks/useVoiceConversation'
import { useKeaWakeWord } from '../hooks/useKeaWakeWord'

export function ConversationPage() {
  const {
    languageCode,
    nativeLanguage,
    level,
    listenIdleSeconds,
    answerAfterSilenceSeconds,
    firstName,
    photoDataUrl,
    isAdmin,
  } = useSession()
  const { block, setBlock, guardStart } = useTalkGate(isAdmin)

  const voice = useVoiceConversation({
    targetLanguage: languageCode ?? 'es',
    nativeLanguage: nativeLanguage ?? 'en',
    level,
    listenIdleSeconds,
    answerAfterSilenceSeconds,
  })

  const live = voice.handsFree || voice.status !== 'idle'
  const liveRef = useRef(live)
  liveRef.current = live

  const { armed } = useKeaWakeWord({
    enabled: !live && !block,
    onWake: () => {
      if (liveRef.current) return
      if (!guardStart()) return
      void voice.start()
    },
  })

  useEffect(() => {
    if (!live) return
    const timer = window.setInterval(() => {
      if (liveRef.current) recordTalkSeconds(1)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [live])

  return (
    <main className="companion-screen conversation-screen">
      <CloudAtmosphere presence={voice.status} />
      <h1 className="visually-hidden">Talk with Kea</h1>
      <header className="conversation-screen__header">
        <Link to="/conversation" aria-label="Kea home">
          <KeaMark className="kea-mark--header" />
        </Link>
        <CompanionNav />
      </header>
      <div className="conversation-screen__stage">
        <RisingWords
          messages={voice.messages}
          live={live}
          userPhoto={photoDataUrl}
          userName={firstName}
        />
      </div>
      {voice.error ? <p className="voice-error">{voice.error}</p> : null}
      <VoiceMic
        live={live}
        status={voice.status}
        hint={
          live
            ? undefined
            : armed
              ? 'Say Yo Kea'
              : 'Tap once, then say Yo Kea'
        }
        onToggle={() => {
          if (live) {
            voice.toggle()
            return
          }
          if (!guardStart()) return
          voice.toggle()
        }}
      />
      {block ? (
        <PaywallModal reason={block} onClose={() => setBlock(null)} />
      ) : null}
    </main>
  )
}
