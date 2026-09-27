import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CloudAtmosphere } from '../components/companion/CloudAtmosphere'
import { CompanionNav } from '../components/companion/CompanionNav'
import { MobileAudioRoutePopup } from '../components/companion/MobileAudioRoutePopup'
import { OfferPopup } from '../components/companion/OfferPopup'
import { SubLeaveOfferPopup } from '../components/companion/SubLeaveOfferPopup'
import { PaywallModal, useTalkGate } from '../components/companion/PaywallModal'
import { RisingWords } from '../components/companion/RisingWords'
import { TextComposer } from '../components/companion/TextComposer'
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
import { getSpeakVoice } from '../architecture/voiceCatalog'
import { prefetchManagedVoiceAudio } from '../services/keaSpeak'
import type { VoicePresenceState } from '../types'

const TEXT_MODE_KEY = 'kea-text-mode'

function loadTextMode() {
  try {
    return localStorage.getItem(TEXT_MODE_KEY) === '1'
  } catch {
    return false
  }
}

function saveTextMode(on: boolean) {
  try {
    localStorage.setItem(TEXT_MODE_KEY, on ? '1' : '0')
  } catch {
    // ignore
  }
}

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
  const [textMode, setTextMode] = useState(loadTextMode)
  const [keyboardInset, setKeyboardInset] = useState(0)

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
      if (audioRouteOpen || block || textMode) return
      if (hasCompletedSpokenOnboarding(userKey)) return
      setOnboardingActive(true)
    }
    maybeStart()
    window.addEventListener(ONBOARDING_CHANGED, maybeStart)
    return () => window.removeEventListener(ONBOARDING_CHANGED, maybeStart)
  }, [audioRouteOpen, block, userKey, textMode])

  const onboard = useSpokenOnboarding({
    active: onboardingActive && !textMode,
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
    const pref = greetingPrefetchRef.current
    const speechOpts =
      pref && pref.text === line.spoken
        ? {
            prefetchedUrl: pref.url,
            prefetchPromise: pref.url ? null : pref.promise,
          }
        : {
            prefetchPromise: (() => {
              const managed = getSpeakVoice()
              if (!managed) return null
              return prefetchManagedVoiceAudio(managed, line.spoken)
            })(),
          }
    void voice.start(line.spoken, line.english, line.kind, speechOpts)
  }

  const beginTalkingRef = useRef(beginTalking)
  beginTalkingRef.current = beginTalking

  const greetingPrefetchRef = useRef<{
    text: string
    url: string | null
    promise: Promise<string | null>
  } | null>(null)

  // Prefetch canned welcome / welcome-back TTS so the first line starts quickly.
  useEffect(() => {
    if (audioRouteOpen || block || onboardingActive) return
    const line = buildStartSpeechLine({
      languageCode: target,
      firstName,
      messages: voice.messages,
    })
    const managed = getSpeakVoice()
    if (!managed || !line.spoken.trim()) return
    if (greetingPrefetchRef.current?.text === line.spoken) return
    const promise = prefetchManagedVoiceAudio(managed, line.spoken)
    greetingPrefetchRef.current = { text: line.spoken, url: null, promise }
    void promise.then((url) => {
      if (greetingPrefetchRef.current?.text === line.spoken) {
        greetingPrefetchRef.current.url = url
      }
    })
  }, [
    audioRouteOpen,
    block,
    onboardingActive,
    target,
    firstName,
    voice.messages,
  ])

  // After blockers clear, start hands-free listening so Kea stays live
  // for the configured idle window (default 10 minutes).
  useEffect(() => {
    if (audioRouteOpen || block || onboardingActive || textMode) return
    if (liveRef.current) return
    const timer = window.setTimeout(() => {
      if (audioRouteOpen || block || onboardingActive || textMode) return
      if (liveRef.current) return
      beginTalkingRef.current()
    }, 180)
    return () => window.clearTimeout(timer)
  }, [audioRouteOpen, block, onboardingActive, textMode])

  const wake = useKeaWakeWord({
    enabled: !live && !block && !audioRouteOpen && !onboardingActive && !textMode,
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

  useEffect(() => {
    if (!textMode) {
      setKeyboardInset(0)
      return
    }
    const viewport = window.visualViewport
    if (!viewport) return
    const sync = () => {
      const covered = window.innerHeight - viewport.height - viewport.offsetTop
      setKeyboardInset(Math.max(0, Math.round(covered)))
    }
    sync()
    viewport.addEventListener('resize', sync)
    viewport.addEventListener('scroll', sync)
    return () => {
      viewport.removeEventListener('resize', sync)
      viewport.removeEventListener('scroll', sync)
    }
  }, [textMode])

  function toggleTextMode() {
    const next = !textMode
    saveTextMode(next)
    setTextMode(next)
    if (next) {
      wake.release()
      voice.stop()
      setOnboardingActive(false)
      setOnboardLine('')
    }
  }

  function sendTyped(text: string) {
    if (!guardStart()) return
    wake.release()
    voice.stop()
    void voice.sendText(text)
  }

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
        textMode ? ' conversation-screen--text' : ''
      }${
        block || popup1Open || audioRouteOpen || onboardingActive
          ? ' has-offer-dock'
          : ''
      }`}
    >
      <CloudAtmosphere presence={micStatus} />
      <h1 className="visually-hidden">Talk with Kea</h1>
      <header className="conversation-screen__header">
        <CompanionNav
          micLabel={micLabel}
          textMode={textMode}
          onToggleTextMode={toggleTextMode}
        />
      </header>
      <div className="conversation-screen__stage">
        <RisingWords
          messages={voice.messages}
          live={false}
          userName={firstName}
          targetLanguage={target}
          allowListen={!textMode}
        />
      </div>
      {onboardingActive && !textMode ? (
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
      {textMode ? (
        <div
          className="text-composer-dock"
          style={keyboardInset > 0 ? { bottom: keyboardInset } : undefined}
        >
          <TextComposer busy={voice.status === 'thinking'} onSend={sendTyped} />
        </div>
      ) : (
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
      )}
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
