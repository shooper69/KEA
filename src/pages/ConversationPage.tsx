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
import {
  clearAudioRoutePromptPending,
  shouldOpenAudioRouteCheck,
} from '../architecture/keaAudioRoute'
import {
  isTalkHeld,
  markFreshChatScreen,
  peekRestartListen,
  releaseRestartListen,
} from '../architecture/keaTalkMemory'
import {
  shouldShowLearnerQuiz,
  shouldShowSpokenTour,
} from '../architecture/learnerQuizGate'
import { hasUserTalked } from '../data/keaLearnerProfile'
import { getTalkAccess, recordTalkSeconds } from '../architecture/keaBilling'
import {
  buildStartSpeechLine,
  markFirstMeetGreetingDone,
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
  clearStaleSpokenTourPending,
  exitOnboardingToChat,
  hasCompletedSpokenOnboarding,
  hasDismissedLearnerQuiz,
  isSpokenTourArmed,
  isSpokenTourPending,
  ONBOARDING_CHANGED,
} from '../data/keaOnboarding'
import { useSession } from '../context/SessionContext'
import { useVoiceConversation } from '../hooks/useVoiceConversation'
import { useKeaWakeWord } from '../hooks/useKeaWakeWord'
import { useSpokenOnboarding } from '../hooks/useSpokenOnboarding'
import { getAnswerSilenceSeconds } from '../data/keaAnswerSilence'
import { consumeParkedTalkSession } from '../architecture/keaTalkPark'
import { setScreenWakeLock } from '../architecture/keaScreenWakeLock'
import { useHoldKeaListening } from '../architecture/keaUiHold'
import { getSpeakVoice } from '../architecture/voiceCatalog'
import { prefetchManagedVoiceAudio, stopKeaSpeech } from '../services/keaSpeak'
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
    answerAfterSilenceSeconds,
    firstName,
    email,
    isAdmin,
    learnerAnswers,
  } = useSession()
  const { block, setBlock, guardStart } = useTalkGate(isAdmin)
  const [restartListen] = useState(() => {
    const restarting = peekRestartListen()
    if (restarting) {
      clearAudioRoutePromptPending()
      saveTextMode(false)
    }
    return restarting
  })
  /** Returning from another page while Kea was live — resume listen, no wake. */
  const [parkResume] = useState(() => consumeParkedTalkSession())
  useEffect(() => {
    const timer = window.setTimeout(() => releaseRestartListen(), 400)
    return () => window.clearTimeout(timer)
  }, [])
  const [audioRouteOpen, setAudioRouteOpen] = useState(() =>
    shouldOpenAudioRouteCheck({ restartListen }),
  )
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
    dismissed: hasDismissedLearnerQuiz(userKey),
  })
  const [onboardingRevision, setOnboardingRevision] = useState(0)
  const [onboardLine, setOnboardLine] = useState('')
  const [textMode, setTextMode] = useState(loadTextMode)
  const [composerFocus, setComposerFocus] = useState(false)
  const [keyboardInset, setKeyboardInset] = useState(0)

  const target = languageCode ?? 'es'

  const voice = useVoiceConversation({
    targetLanguage: target,
    nativeLanguage: nativeLanguage ?? 'en',
    level,
    firstName,
    listenIdleSeconds,
    answerAfterSilenceSeconds:
      answerAfterSilenceSeconds || getAnswerSilenceSeconds(),
  })

  const live = voice.handsFree || voice.status !== 'idle'
  const liveRef = useRef(live)
  liveRef.current = live
  const sessionGreetedRef = useRef('')
  // Wake stays off until this visit's welcome has started, so "Hey Kea"
  // cannot grab the mic and cancel the greeting.
  const [, setOpeningDone] = useState(false)

  useEffect(() => {
    const bump = () => setOnboardingRevision((n) => n + 1)
    window.addEventListener(ONBOARDING_CHANGED, bump)
    return () => window.removeEventListener(ONBOARDING_CHANGED, bump)
  }, [])

  useEffect(() => {
    if (reviewOnboarding) return
    const cleared = clearStaleSpokenTourPending(userKey, {
      hasTalked: hasUserTalked(),
      completed: hasCompletedSpokenOnboarding(userKey),
    })
    if (cleared) setOnboardingRevision((n) => n + 1)
  }, [userKey, reviewOnboarding])

  const spokenTour = shouldShowSpokenTour({
    isAdmin,
    profileKnown,
    hasName: Boolean(firstName.trim()),
    hasTalked: hasUserTalked(),
    completed: onboardingRevision >= 0 && hasCompletedSpokenOnboarding(userKey),
    awaitingTour: isSpokenTourPending(userKey),
    tourArmed: isSpokenTourArmed(),
    busy: Boolean(block) || audioRouteOpen,
  })

  useHoldKeaListening(
    Boolean(block) ||
      audioRouteOpen ||
      quizOpen ||
      spokenTour ||
      popup1Open ||
      subLeaveOpen,
  )

  const onboard = useSpokenOnboarding({
    active: spokenTour,
    nativeLanguage: nativeLanguage ?? 'en',
    userKey,
    onStepText: setOnboardLine,
    onComplete: () => {
      setOnboardLine('')
      markFreshChatScreen()
      sessionGreetedRef.current = ''
      setOpeningDone(false)
      setOnboardingRevision((n) => n + 1)
    },
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
    setOpeningDone(true)
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
      userKey,
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
    if (line.kind === 'welcome') markFirstMeetGreetingDone(userKey)
    void voice.start(line.spoken, line.english, line.kind, speechOpts)
  }

  const greetingPrefetchRef = useRef<{
    text: string
    url: string | null
    promise: Promise<string | null>
  } | null>(null)

  // Prefetch the short welcome-back line as soon as the page opens,
  // including while the mic chooser is on screen.
  useEffect(() => {
    if (block || spokenTour || quizOpen || audioRouteOpen) return
    const line = buildStartSpeechLine({
      languageCode: target,
      firstName,
      messages: voice.messages,
      userKey,
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
  }, [block, spokenTour, quizOpen, audioRouteOpen, target, firstName, userKey, voice.messages])

  // On login / Talk ready: one short welcome in the learning language.
  // A returning name is already on this device, so do not wait for the cloud profile.
  // Stay quiet while the audio check popup is on screen.
  // Parked return: skip greeting — just resume listening and reset the idle window.
  useEffect(() => {
    if (parkResume) {
      sessionGreetedRef.current = 'parked'
      setOpeningDone(true)
      return
    }
    const returning = Boolean(firstName.trim()) || hasUserTalked()
    if (
      isTalkHeld() ||
      block ||
      spokenTour ||
      quizOpen ||
      audioRouteOpen ||
      (!profileKnown && !returning)
    ) {
      return
    }
    const line = buildStartSpeechLine({
      languageCode: target,
      firstName,
      messages: voice.messages,
      userKey,
    })
    if (sessionGreetedRef.current === line.spoken) {
      setOpeningDone(true)
      return
    }
    sessionGreetedRef.current = line.spoken
    const pref = greetingPrefetchRef.current
    // Voice mode: say the welcome, then listen. No wake phrase on login.
    const voiceMode = !textMode
    const speechOpts =
      pref && pref.text === line.spoken
        ? {
            listenAfter: voiceMode,
            silent: !voiceMode,
            prefetchedUrl: pref.url,
            prefetchPromise: pref.url ? null : pref.promise,
          }
        : { listenAfter: voiceMode, silent: !voiceMode }
    setOpeningDone(true)
    if (line.kind === 'welcome') markFirstMeetGreetingDone(userKey)
    void voice.start(line.spoken, line.english, line.kind, speechOpts)
    // Intentionally omit `voice` — greet once per Talk visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    parkResume,
    block,
    spokenTour,
    textMode,
    restartListen,
    quizOpen,
    audioRouteOpen,
    profileKnown,
    target,
    firstName,
    userKey,
  ])

  // If the audio check appears, cut any welcome speech immediately.
  useEffect(() => {
    if (!audioRouteOpen) return
    voice.stopSpeech()
    // Let the welcome run again after they finish the audio check.
    sessionGreetedRef.current = ''
    setOpeningDone(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioRouteOpen])

  // Chat page is live: as soon as chrome clears, open the mic and start the
  // listen window from this visit (not from the last spoken word).
  // Parked return restarts listening without a wake prompt and resets the
  // stay-live timer (default 10 minutes).
  useEffect(() => {
    if (
      textMode ||
      block ||
      spokenTour ||
      quizOpen ||
      audioRouteOpen ||
      !profileKnown
    ) {
      return
    }
    if (voice.handsFree || voice.status !== 'idle') return
    if (parkResume || sessionGreetedRef.current) {
      voice.activateLiveWindow()
      void voice.start()
    }
    // Greeting effect handles first open; this covers return to chat when a
    // welcome was already spoken this visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    parkResume,
    textMode,
    block,
    spokenTour,
    quizOpen,
    audioRouteOpen,
    profileKnown,
    voice.handsFree,
    voice.status,
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
      setComposerFocus(true)
    } else {
      setComposerFocus(false)
    }
  }

  function sendTyped(text: string) {
    if (!guardStart()) return
    setComposerFocus(false)
    wake.release()
    voice.stop()
    void voice.sendText(text)
  }

  const keaBusyTyping = voice.status === 'thinking' || voice.status === 'speaking'

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
          onOpenAudioRoute={() => setAudioRouteOpen(true)}
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
            onExit={() => {
              if (searchParams.get('onboarding') === '1') {
                const next = new URLSearchParams(searchParams)
                next.delete('onboarding')
                setSearchParams(next, { replace: true })
              }
              setOnboardingRevision((n) => n + 1)
              sessionGreetedRef.current = ''
              setOpeningDone(false)
            }}
          />
        ) : spokenTour ? (
          <div className="onboarding-caption" role="status" aria-live="polite">
            <button
              type="button"
              className="onboarding-caption__exit"
              aria-label="Exit onboarding and go to chat"
              onClick={() => {
                try {
                  stopKeaSpeech()
                } catch {
                  // ignore
                }
                exitOnboardingToChat(userKey)
                setOnboardLine('')
                setOnboardingRevision((n) => n + 1)
                sessionGreetedRef.current = ''
                setOpeningDone(false)
              }}
            >
              ✕
            </button>
            <span className="rising-words__who rising-words__who--kea" aria-hidden="true">
              <img src={KEA_FLY_SRC} alt="" />
            </span>
            <p className="onboarding-caption__title">How to use Kea</p>
            {onboardLine ? (
              <p className="onboarding-caption__line">{onboardLine}</p>
            ) : null}
            <div className="onboarding-caption__actions">
              <button
                type="button"
                className="kea-button onboarding-caption__next"
                onClick={onboard.advance}
              >
                Next
              </button>
            </div>
          </div>
        ) : (
          <RisingWords
            messages={voice.messages}
            live={false}
            targetLanguage={target}
            allowListen={!textMode}
          />
        )}
      </div>
      {voice.error ? <p className="voice-error">{voice.error}</p> : null}
      {textMode && !quizOpen && !spokenTour && !keaBusyTyping ? (
        <div
          className="text-composer-dock"
          style={keyboardInset > 0 ? { bottom: keyboardInset } : undefined}
        >
          <TextComposer
            busy={false}
            autoFocus={composerFocus}
            onSend={sendTyped}
          />
        </div>
      ) : !quizOpen && !spokenTour && !textMode && !audioRouteOpen ? (
      <VoiceMic
        live={live}
        status={micStatus}
        wakePhrase
        onToggle={() => {
          if (quizOpen) return
          wake.release()
          // Stop wins whenever talk is live OR still arming — never ignore a stop tap.
          if (live || voice.handsFree || voice.starting || voice.status !== 'idle') {
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
