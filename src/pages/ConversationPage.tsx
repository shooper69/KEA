import { useEffect, useRef } from 'react'
import { CloudAtmosphere } from '../components/companion/CloudAtmosphere'
import { CompanionNav } from '../components/companion/CompanionNav'
import { PaywallModal, useTalkGate } from '../components/companion/PaywallModal'
import { RisingWords } from '../components/companion/RisingWords'
import { VoiceMic } from '../components/companion/VoiceMic'
import { recordTalkSeconds } from '../architecture/keaBilling'
import { useSession } from '../context/SessionContext'
import { useVoiceConversation } from '../hooks/useVoiceConversation'
import { useKeaWakeWord } from '../hooks/useKeaWakeWord'
import { getAnswerSilenceSeconds } from '../data/keaAnswerSilence'

export function ConversationPage() {
  const {
    languageCode,
    nativeLanguage,
    level,
    listenIdleSeconds,
    firstName,
    isAdmin,
  } = useSession()
  const { block, setBlock, guardStart } = useTalkGate(isAdmin)

  const voice = useVoiceConversation({
    targetLanguage: languageCode ?? 'es',
    nativeLanguage: nativeLanguage ?? 'en',
    level,
    firstName,
    listenIdleSeconds,
    answerAfterSilenceSeconds: getAnswerSilenceSeconds(),
  })

  const live = voice.handsFree || voice.status !== 'idle'
  const liveRef = useRef(live)
  liveRef.current = live
  const lastTapAt = useRef(0)

  const wake = useKeaWakeWord({
    enabled: !live && !block,
    onWake: () => {
      if (liveRef.current) return
      if (!guardStart()) return
      void voice.start("Yes I'm here")
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
        <CompanionNav />
      </header>
      <div className="conversation-screen__stage">
        <RisingWords
          messages={voice.messages}
          live={false}
          userName={firstName}
        />
      </div>
      {voice.error ? <p className="voice-error">{voice.error}</p> : null}
      <VoiceMic
        live={live}
        status={voice.status}
        onToggle={() => {
          const now = Date.now()
          if (now - lastTapAt.current < 450) return
          lastTapAt.current = now
          wake.release()
          if (live) {
            voice.stop()
            return
          }
          if (!guardStart()) return
          void voice.start()
        }}
      />
      {block ? (
        <PaywallModal reason={block} onClose={() => setBlock(null)} />
      ) : null}
    </main>
  )
}
