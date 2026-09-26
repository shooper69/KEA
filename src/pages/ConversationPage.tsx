import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CloudAtmosphere } from '../components/companion/CloudAtmosphere'
import { CompanionNav } from '../components/companion/CompanionNav'
import { MobileAudioRoutePopup } from '../components/companion/MobileAudioRoutePopup'
import { OfferPopup } from '../components/companion/OfferPopup'
import { SubLeaveOfferPopup } from '../components/companion/SubLeaveOfferPopup'
import { PaywallModal, useTalkGate } from '../components/companion/PaywallModal'
import { RisingWords } from '../components/companion/RisingWords'
import { VoiceMic } from '../components/companion/VoiceMic'
import { shouldOfferAudioRoutePrompt } from '../architecture/keaAudioRoute'
import { getTalkAccess, recordTalkSeconds } from '../architecture/keaBilling'
import {
  buildStartSpeechLine,
  isFreshTalkSession,
} from '../architecture/keaStartSpeech'
import { isHomeGreetingMessage } from '../config/languages'
import {
  consumeSubLeaveOfferPending,
  dismissHomeOffer,
  dismissSubLeaveOffer,
  getOffer,
  shouldShowPopup1,
  shouldShowSubLeaveOffer,
} from '../data/keaOffers'
import {
  hasCompletedSpokenOnboarding,
  ONBOARDING_CHANGED,
} from '../data/keaOnboarding'
import { useSession } from '../context/SessionContext'
import { useVoiceConversation } from '../hooks/useVoiceConversation'
import { useKeaWakeWord } from '../hooks/useKeaWakeWord'
import { useSpokenOnboarding } from '../hooks/useSpokenOnboarding'
import { getAnswerSilenceSeconds } from '../data/keaAnswerSilence'
import { setScreenWakeLock } from '../architecture/keaScreenWakeLock'
import type { VoicePresenceState } from '../types'

export function ConversationPage() {
  const navigate = useNavigate()
  const {
    languageCode,
    nativeLanguage,
    level,
    listenIdleSeconds,
    firstName,
    email,
    isAdmin,
  } = useSession()
  const { block, setBlock, guardStart } = useTalkGate(isAdmin)
  const [audioRouteOpen, setAudioRouteOpen] = useState(() =>
    shouldOfferAudioRoutePrompt(),
  )
  const [popup1Open, setPopup1Open] = useState(() => shouldShowPopup1('home'))
  const [subLeaveOpen, setSubLeaveOpen] = useState(() => {
    if (!consumeSubLeaveOfferPending()) return false
    return shouldShowSubLeaveOffer(getTalkAccess(isAdmin).status === 'active')
  })
  const userKey = email.trim().toLowerCase() || firstName.trim().toLowerCase()
  const [onboardingActive, setOnboardingActive] = useState(false)
  const [onboardLine, setOnboardLine] = useState('')

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
    function maybeStart() {
      if (audioRouteOpen || block) return
      if (hasCompletedSpokenOnboarding(userKey)) return
      setOnboardingActive(true)
    }
    maybeStart()
    window.addEventListener(ONBOARDING_CHANGED, maybeStart)
    return () => window.removeEventListener(ONBOARDING_CHANGED, maybeStart)
  }, [audioRouteOpen, block, userKey])

  const onboard = useSpokenOnboarding({
    active: onboardingActive,
    nativeLanguage: nativeLanguage ?? 'en',
    userKey,
    onStepText: setOnboardLine,
    onComplete: () => {
      setOnboardingActive(false)
      setOnboardLine('')
    },
  })

  useEffect(() => {
    function maybeShow() {
      setPopup1Open(
        !block &&
          !audioRouteOpen &&
          !onboardingActive &&
          shouldShowPopup1('home'),
      )
    }
    maybeShow()
    window.addEventListener('kea-offers-changed', maybeShow)
    return () => window.removeEventListener('kea-offers-changed', maybeShow)
  }, [block, audioRouteOpen, onboardingActive])

  function beginTalking() {
    if (audioRouteOpen || onboardingActive) return
    if (liveRef.current) return
    if (!guardStart()) return
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
    enabled: !live && !block && !audioRouteOpen && !onboardingActive,
    onWake: beginTalking,
  })

  useEffect(() => {
    const keepAwake =
      !block &&
      !audioRouteOpen &&
      (live || wake.armed || voice.handsFree || onboardingActive)
    setScreenWakeLock(keepAwake)
    return () => setScreenWakeLock(false)
  }, [block, audioRouteOpen, live, wake.armed, voice.handsFree, onboardingActive])

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

  const micStatus: VoicePresenceState = onboardingActive
    ? onboard.phase === 'listening'
      ? 'listening'
      : onboard.phase === 'speaking'
        ? 'speaking'
        : 'idle'
    : voice.status

  return (
    <main
      className={`companion-screen conversation-screen${
        block || popup1Open || audioRouteOpen || onboardingActive
          ? ' has-offer-dock'
          : ''
      }`}
    >
      <CloudAtmosphere presence={micStatus} />
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
      {onboardingActive ? (
        <div className="onboarding-banner" role="status" aria-live="polite">
          <p className="onboarding-banner__eyebrow">
            Getting started
            {onboard.stepCount > 0
              ? ` · ${onboard.stepIndex + 1} of ${onboard.stepCount}`
              : ''}
          </p>
          <p className="onboarding-banner__line">
            {onboardLine || 'Kea is explaining how things work…'}
          </p>
          <p className="onboarding-banner__hint">
            {onboard.phase === 'listening'
              ? 'Say “yes” when you are ready for the next tip.'
              : 'Listen — then say yes after each OK?'}
          </p>
        </div>
      ) : null}
      {voice.error ? <p className="voice-error">{voice.error}</p> : null}
      <VoiceMic
        live={live || onboardingActive}
        status={micStatus}
        wakePhrase={wake.listens && !audioRouteOpen && !onboardingActive}
        onToggle={() => {
          if (audioRouteOpen || onboardingActive) return
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
      {audioRouteOpen ? (
        <MobileAudioRoutePopup onDone={() => setAudioRouteOpen(false)} />
      ) : null}
      {block ? (
        <PaywallModal reason={block} onClose={() => setBlock(null)} />
      ) : null}
      {!block && !audioRouteOpen && !onboardingActive && popup1Open ? (
        <OfferPopup
          offer={getOffer('home')}
          tone="home"
          onClose={() => {
            dismissHomeOffer()
            setPopup1Open(false)
          }}
        />
      ) : null}
      {!block && !audioRouteOpen && !onboardingActive && subLeaveOpen ? (
        <SubLeaveOfferPopup
          offer={getOffer('subLeave')}
          onClose={() => {
            dismissSubLeaveOffer()
            setSubLeaveOpen(false)
          }}
          onGrab={() => {
            dismissSubLeaveOffer()
            setSubLeaveOpen(false)
            navigate('/subscription')
          }}
        />
      ) : null}
    </main>
  )
}
