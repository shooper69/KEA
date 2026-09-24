import { useEffect, useRef, useState } from 'react'
import { CloudAtmosphere } from '../components/companion/CloudAtmosphere'
import { CompanionNav } from '../components/companion/CompanionNav'
import { OfferPopup } from '../components/companion/OfferPopup'
import { PaywallModal, useTalkGate } from '../components/companion/PaywallModal'
import { RisingWords } from '../components/companion/RisingWords'
import { VoiceMic } from '../components/companion/VoiceMic'
import { recordTalkSeconds } from '../architecture/keaBilling'
import {
  buildStartSpeechLine,
  isFreshTalkSession,
} from '../architecture/keaStartSpeech'
import { isHomeGreetingMessage } from '../config/languages'
import {
  dismissHomeOffer,
  getOffer,
  shouldShowPopup1,
} from '../data/keaOffers'
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
  const [popup1Open, setPopup1Open] = useState(() => shouldShowPopup1('home'))

  const target = languageCode ?? 'es'

  const voice = useVoiceConversation({
    targetLanguage: target,
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

  useEffect(() => {
    function maybeShow() {
      setPopup1Open(!block && shouldShowPopup1('home'))
    }
    maybeShow()
    window.addEventListener('kea-offers-changed', maybeShow)
    return () => window.removeEventListener('kea-offers-changed', maybeShow)
  }, [block])

  function beginTalking() {
    if (liveRef.current) return
    if (!guardStart()) return
    // Welcome already on screen after login — do not say or write it again.
    if (
      isFreshTalkSession(voice.messages) &&
      voice.messages.some(isHomeGreetingMessage)
    ) {
      void voice.start()
      return
    }
    const line = buildStartSpeechLine({
      languageCode: target,
      firstName,
      messages: voice.messages,
    })
    void voice.start(line.spoken, line.english, line.kind)
  }

  const wake = useKeaWakeWord({
    enabled: !live && !block,
    onWake: beginTalking,
  })

  useEffect(() => {
    if (!live) return
    const timer = window.setInterval(() => {
      if (liveRef.current) recordTalkSeconds(1)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [live])

  const micLabel = isAdmin
    ? live
      ? voice.micLabel
      : wake.armed
        ? wake.wakeMic
        : ''
    : ''

  return (
    <main
      className={`companion-screen conversation-screen${
        block || popup1Open ? ' has-offer-dock' : ''
      }`}
    >
      <CloudAtmosphere presence={voice.status} />
      <h1 className="visually-hidden">Talk with Kea</h1>
      <header className="conversation-screen__header">
        <CompanionNav micLabel={micLabel} />
      </header>
      <div className="conversation-screen__stage">
        <RisingWords
          messages={voice.messages}
          live={false}
          userName={firstName}
          targetLanguage={target}
        />
      </div>
      {voice.error ? <p className="voice-error">{voice.error}</p> : null}
      <VoiceMic
        live={live}
        status={voice.status}
        wakePhrase={wake.listens}
        onToggle={() => {
          const now = Date.now()
          if (now - lastTapAt.current < 450) return
          lastTapAt.current = now
          wake.release()
          if (live) {
            voice.stop()
            return
          }
          beginTalking()
        }}
      />
      {block ? (
        <PaywallModal reason={block} onClose={() => setBlock(null)} />
      ) : null}
      {!block && popup1Open ? (
        <OfferPopup
          offer={getOffer('home')}
          tone="home"
          onClose={() => {
            dismissHomeOffer()
            setPopup1Open(false)
          }}
        />
      ) : null}
    </main>
  )
}
