import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CloudAtmosphere } from '../components/companion/CloudAtmosphere'
import { CompanionNav } from '../components/companion/CompanionNav'
import { MobileAudioRoutePopup } from '../components/companion/MobileAudioRoutePopup'
import { OfferPopup } from '../components/companion/OfferPopup'
import { SubLeaveOfferPopup } from '../components/companion/SubLeaveOfferPopup'
import { PaywallModal, useTalkGate } from '../components/companion/PaywallModal'
import { RisingWords } from '../components/companion/RisingWords'
import { TextComposer } from '../components/companion/TextComposer'
import { VoiceMic } from '../components/companion/VoiceMic'
import { LearnerQuestionnaire } from '../components/companion/LearnerQuestionnaire'
import { KEA_FLY_SRC } from '../data/keaAbout'
import { shouldOfferAudioRoutePrompt } from '../architecture/keaAudioRoute'
import {
  shouldShowLearnerQuiz,
  shouldShowSpokenTour,
} from '../architecture/learnerQuizGate'
import { hasUserTalked } from '../data/keaLearnerProfile'
import { getTalkAccess, recordTalkSeconds } from '../architecture/keaBilling'
import {
  buildStartSpeechLine,
} from '../architecture/keaStartSpeech'
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
  const [searchParams, setSearchParams] = useSearchParams()
  const {
    languageCode,
    nativeLanguage,
    level,
    listenIdleSeconds,
    firstName,
    email,
    isAdmin,
    learnerAnswers,
  } = useSession()
  const { block, setBlock, guardStart } = useTalkGate(isAdmin)
  const [audioRouteOpen, setAudioRouteOpen] = useState(shouldOfferAudioRoutePrompt)

  useEffect(() => {
    if (shouldOfferAudioRoutePrompt()) setAudioRouteOpen(true)
  }, [])
  const [popup1Open, setPopup1Open] = useState(() => shouldShowPopup1('home'))
  const [subLeaveOpen, setSubLeaveOpen] = useState(() => {
    if (!consumeSubLeaveOfferPending()) return false
    return shouldShowSubLeaveOffer(getTalkAccess(isAdmin).status === 'active')
  })
  const userKey = email.trim().toLowerCase() || firstName.trim().toLowerCase()
  const profileKnown = learnerAnswers !== undefined
  const reviewOnboarding = searchParams.get('onboarding') === '1'
  const quizOpen = shouldShowLearnerQuiz({
    isAdmin,
    review: reviewOnboarding,
    profileKnown,
    hasAnswers: learnerAnswers != null,
    hasTalked: hasUserTalked(),
  })
  const [onboardingRevision, setOnboardingRevision] = useState(0)
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
  const sessionGreetedRef = useRef('')

  useEffect(() => {
    const bump = () => setOnboardingRevision((n) => n + 1)
    window.addEventListener(ONBOARDING_CHANGED, bump)
    return () => window.removeEventListener(ONBOARDING_CHANGED, bump)
  }, [])

  const spokenTour = shouldShowSpokenTour({
    isAdmin,
    profileKnown,
    hasName: Boolean(firstName.trim()),
    hasTalked: hasUserTalked(),
    completed: onboardingRevision >= 0 && hasCompletedSpokenOnboarding(userKey),
    busy: Boolean(block) || audioRouteOpen || textMode || quizOpen,
  })

  const onboard = useSpokenOnboarding({
    active: spokenTour,
    nativeLanguage: nativeLanguage ?? 'en',
    userKey,
    onStepText: setOnboardLine,
    onComplete: () => setOnboardLine(''),
  })

  useEffect(() => {
    function maybeShow() {
      setPopup1Open(
        !block &&
          !audioRouteOpen &&
          !spokenTour &&
          shouldShowPopup1('home'),
      )
    }
    maybeShow()
    window.addEventListener('kea-offers-changed', maybeShow)
    return () => window.removeEventListener('kea-offers-changed', maybeShow)
  }, [block, audioRouteOpen, spokenTour])

  function beginTalking() {
    if (audioRouteOpen || spokenTour || quizOpen) return
    if (liveRef.current) return
    if (!guardStart()) return
    // Already greeted this session — just listen.
    if (sessionGreetedRef.current) {
      void voice.start()
      return
    }
    sessionGreetedRef.current = 'talk'
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

  const greetingPrefetchRef = useRef<{
    text: string
    url: string | null
    promise: Promise<string | null>
  } | null>(null)

  // Prefetch the short welcome-back line.
  useEffect(() => {
    if (audioRouteOpen || block || spokenTour || quizOpen) return
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
    spokenTour,
    quizOpen,
    target,
    firstName,
    voice.messages,
  ])

  // On login / Talk ready: one short welcome in the learning language.
  useEffect(() => {
    if (audioRouteOpen || block || spokenTour || quizOpen || !profileKnown) {
      return
    }
    const line = buildStartSpeechLine({
      languageCode: target,
      firstName,
      messages: voice.messages,
    })
    if (sessionGreetedRef.current === line.spoken) return
    sessionGreetedRef.current = line.spoken
    const pref = greetingPrefetchRef.current
    const speechOpts =
      pref && pref.text === line.spoken
        ? {
            listenAfter: false as const,
            silent: textMode,
            prefetchedUrl: pref.url,
            prefetchPromise: pref.url ? null : pref.promise,
          }
        : { listenAfter: false as const, silent: textMode }
    void voice.start(line.spoken, line.english, line.kind, speechOpts)
    // Intentionally omit `voice` — greet once per Talk visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    audioRouteOpen,
    block,
    spokenTour,
    textMode,
    quizOpen,
    profileKnown,
    target,
    firstName,
  ])

  const wake = useKeaWakeWord({
    enabled:
      profileKnown &&
      !live &&
      !block &&
      !audioRouteOpen &&
      !spokenTour &&
      !textMode &&
      !quizOpen,
    onWake: beginTalking,
  })

  useEffect(() => {
    const keepAwake =
      !block &&
      !audioRouteOpen &&
      (live || wake.armed || voice.handsFree || spokenTour)
    setScreenWakeLock(keepAwake)
    return () => setScreenWakeLock(false)
  }, [block, audioRouteOpen, live, wake.armed, voice.handsFree, spokenTour])

  useEffect(() => {
    if (!live) return
    const timer = window.setInterval(() => {
      if (liveRef.current) {
        recordTalkSeconds(1)
        window.dispatchEvent(new Event('kea-user-activity'))
      }
    }, 1000)
    return () => window.clearInterval(timer)
  }, [live])

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
      setOnboardLine('')
    }
  }

  function sendTyped(text: string) {
    if (!guardStart()) return
    wake.release()
    voice.stop()
    void voice.sendText(text)
  }

  const micStatus: VoicePresenceState = spokenTour
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
        block || popup1Open || audioRouteOpen || spokenTour || quizOpen
          ? ' has-offer-dock'
          : ''
      }`}
    >
      <CloudAtmosphere presence={micStatus} />
      <h1 className="visually-hidden">Talk with Kea</h1>
      <header className="conversation-screen__header">
        <CompanionNav
          textMode={textMode}
          onToggleTextMode={toggleTextMode}
        />
      </header>
      <div className="conversation-screen__stage">
        {quizOpen ? (
          <LearnerQuestionnaire
            targetLanguage={target}
            onDone={() => {
              if (searchParams.get('onboarding') === '1') {
                const next = new URLSearchParams(searchParams)
                next.delete('onboarding')
                setSearchParams(next, { replace: true })
              }
            }}
          />
        ) : spokenTour && !textMode ? (
          <div className="onboarding-caption" role="status" aria-live="polite">
            <span className="rising-words__who rising-words__who--kea" aria-hidden="true">
              <img src={KEA_FLY_SRC} alt="" />
            </span>
            {onboardLine ? (
              <p className="onboarding-caption__line">{onboardLine}</p>
            ) : null}
            {onboard.canAdvance ? (
              <div className="onboarding-caption__actions">
                <button
                  type="button"
                  className="kea-button onboarding-caption__next"
                  onClick={onboard.advance}
                >
                  Next
                </button>
                <p className="onboarding-caption__hint">Or say yes</p>
              </div>
            ) : null}
          </div>
        ) : (
          <RisingWords
            messages={voice.messages}
            live={false}
            userName={firstName}
            targetLanguage={target}
            allowListen={!textMode}
          />
        )}
      </div>
      {voice.error ? <p className="voice-error">{voice.error}</p> : null}
      {textMode && !quizOpen ? (
        <div
          className="text-composer-dock"
          style={keyboardInset > 0 ? { bottom: keyboardInset } : undefined}
        >
          <TextComposer busy={voice.status === 'thinking'} onSend={sendTyped} />
        </div>
      ) : !quizOpen ? (
      <VoiceMic
        live={live || spokenTour}
        status={micStatus}
        wakePhrase={wake.listens && !audioRouteOpen && !spokenTour}
        onToggle={() => {
          if (audioRouteOpen || spokenTour || quizOpen) return
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
      ) : null}
      {audioRouteOpen ? (
        <MobileAudioRoutePopup onDone={() => setAudioRouteOpen(false)} />
      ) : null}
      {block ? (
        <PaywallModal reason={block} onClose={() => setBlock(null)} />
      ) : null}
      {!block && !audioRouteOpen && !spokenTour && !quizOpen && popup1Open ? (
        <OfferPopup
          offer={getOffer('home')}
          tone="home"
          onClose={() => {
            dismissHomeOffer()
            setPopup1Open(false)
          }}
        />
      ) : null}
      {!block && !audioRouteOpen && !spokenTour && !quizOpen && subLeaveOpen ? (
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
