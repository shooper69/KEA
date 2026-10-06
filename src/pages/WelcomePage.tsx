/**
 * MARKETING HOME — LOCKED.
 * Do not change layout, copy, or visuals here unless the user explicitly asks.
 * Agents: see `.cursor/rules/marketing-home-lock.mdc` — prompt before editing.
 */
import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { Link, NavLink, useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '../components/companion/Button'
import { CloudAtmosphere } from '../components/companion/CloudAtmosphere'
import { AuthPanel } from '../components/companion/AuthPanel'
import { LeaveAccountPopup, preloadLeaveFunnelAssets } from '../components/companion/LeaveAccountPopup'
import { KeaLanguageField } from '../components/companion/KeaLanguageField'
import { OfferPopup } from '../components/companion/OfferPopup'
import { PasswordField } from '../components/companion/PasswordField'
import { StoreBadges } from '../components/companion/StoreBadges'
import { HomeCommentsStrip } from '../components/companion/HomeCommentsStrip'
import { MobileAudioRoutePopup } from '../components/companion/MobileAudioRoutePopup'
import { SiteFooter } from '../components/companion/SiteFooter'
import { getLanguage, SUPPORTED_LANGUAGES } from '../config/languages'
import { isAdminEmail } from '../architecture/adminAuth'
import { hasActiveSubscription } from '../architecture/keaBilling'
import { getMarketingIntroVoice } from '../architecture/voiceCatalog'
import {
  welcomeScriptForLanguage,
  WELCOME_ANYTHING_INDEX,
  WELCOME_CLOSING_TTS_HINT,
} from '../architecture/welcomeMarketing'
import { usePwaInstall } from '../components/companion/InstallAppButton'
import {
  dismissHomeOffer,
  getOffer,
  shouldShowPopup1,
} from '../data/keaOffers'
import { getWelcomeTitle } from '../data/keaWelcomeTitle'
import { loadLeaveFunnel } from '../data/keaLeaveFunnel'
import { useSession } from '../context/SessionContext'
import { isPasswordRecoveryLocation } from '../services/keaProfile'
import { speakManagedVoice, speakKeaLine, stopKeaSpeech, prefetchManagedVoiceAudio } from '../services/keaSpeak'
import type { LanguageCode } from '../types'

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

type AuthOpen = false | 'register' | 'login'

function snapToWordEnd(text: string, charIndex: number) {
  if (charIndex <= 0) return ''
  if (charIndex >= text.length) return text
  let end = charIndex
  while (end < text.length && !/\s/.test(text[end]!)) end += 1
  return text.slice(0, end)
}

const LEAVE_PROMPT_KEY = 'kea-leave-account-prompt'

function leavePromptAlreadyShown() {
  try {
    return sessionStorage.getItem(LEAVE_PROMPT_KEY) === '1'
  } catch {
    return false
  }
}

function markLeavePromptShown() {
  try {
    sessionStorage.setItem(LEAVE_PROMPT_KEY, '1')
  } catch {
    // ignore
  }
}

export function WelcomePage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const {
    firstName,
    email,
    languageCode,
    nativeLanguage,
    isOnboarded,
    adminUnlocked,
    setProfile,
    setNativeLanguage,
    authReady,
    cloudAuth,
    isSignedIn,
  } = useSession()
  const [welcomeTitle] = useState(getWelcomeTitle)
  const [name, setName] = useState(firstName)
  const [mail, setMail] = useState(email)
  const [spoken, setSpoken] = useState<LanguageCode | ''>(nativeLanguage || '')
  const [learning, setLearning] = useState<LanguageCode | ''>(languageCode ?? '')
  const [password, setPassword] = useState('')
  const [authOpen, setAuthOpen] = useState<AuthOpen>(() =>
    isPasswordRecoveryLocation() ? 'login' : false,
  )
  const [langMenuOpen, setLangMenuOpen] = useState(false)
  const [audioRouteOpen, setAudioRouteOpen] = useState(false)
  const pendingIntroLang = useRef<LanguageCode | null>(null)
  const [prospectLang, setProspectLang] = useState<LanguageCode | ''>(
    nativeLanguage || '',
  )
  const [visibleCopy, setVisibleCopy] = useState('')
  const [introBusy, setIntroBusy] = useState(false)
  const [introHeard, setIntroHeard] = useState(false)
  const [homeOfferOpen, setHomeOfferOpen] = useState(false)
  const [leavePromptOpen, setLeavePromptOpen] = useState(false)
  const introRunId = useRef(0)
  const introBusyRef = useRef(false)
  const langMenuRef = useRef<HTMLDivElement>(null)
  const introScrollRef = useRef<HTMLDivElement>(null)
  const leaveArmedRef = useRef(false)
  const leaveAllowRef = useRef(false)
  const leaveShownRef = useRef(leavePromptAlreadyShown())
  const leavePromptOpenRef = useRef(false)
  leavePromptOpenRef.current = leavePromptOpen
  introBusyRef.current = introBusy

  const { installed: appInstalled } = usePwaInstall()
  const [subscribed, setSubscribed] = useState(hasActiveSubscription)

  useEffect(() => {
    function refreshSub() {
      setSubscribed(hasActiveSubscription())
    }
    refreshSub()
    window.addEventListener('kea-billing-changed', refreshSub)
    return () => window.removeEventListener('kea-billing-changed', refreshSub)
  }, [])

  const needsAdminPassword = isAdminEmail(mail || email)
  const showCloudAuth = cloudAuth && !isSignedIn
  const needsProfileFinish = isSignedIn && !isOnboarded

  const ready = Boolean(
    name.trim() &&
      isEmail(mail) &&
      spoken &&
      learning &&
      spoken !== learning &&
      (!isAdminEmail(mail) || adminUnlocked || password.length > 0),
  )

  useEffect(() => {
    if (!authReady) return
    if (isSignedIn) return
    if (isPasswordRecoveryLocation()) return
    const register = searchParams.get('register') === '1'
    const login = searchParams.get('login') === '1'
    if (!register && !login) return
    setLeavePromptOpen(false)
    setAuthOpen(login ? 'login' : 'register')
    const next = new URLSearchParams(searchParams)
    next.delete('register')
    next.delete('login')
    setSearchParams(next, { replace: true })
  }, [authReady, isSignedIn, searchParams, setSearchParams])

  useEffect(() => {
    if (!authReady) return
    if (isPasswordRecoveryLocation()) return
    if (isSignedIn) navigate('/conversation', { replace: true })
  }, [authReady, isSignedIn, navigate])

  useEffect(() => {
    function onRecovery() {
      setAuthOpen('login')
    }
    window.addEventListener('kea-password-recovery', onRecovery)
    return () => window.removeEventListener('kea-password-recovery', onRecovery)
  }, [])

  useEffect(() => {
    if (!authOpen) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isPasswordRecoveryLocation()) {
        setAuthOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [authOpen])

  useEffect(() => {
    function maybeShow() {
      if (!authReady || authOpen || isSignedIn) {
        setHomeOfferOpen(false)
        return
      }
      setHomeOfferOpen(shouldShowPopup1('marketing'))
    }
    maybeShow()
    window.addEventListener('kea-offers-changed', maybeShow)
    return () => window.removeEventListener('kea-offers-changed', maybeShow)
  }, [authReady, authOpen, isSignedIn])

  // Leave-without-account: back button (phone + PC) and exit-intent (PC).
  // Skip once they have the app installed or an active subscription.
  useEffect(() => {
    const skipLeave = isSignedIn || appInstalled || subscribed
    const canArm =
      authReady && !skipLeave && !authOpen && !leaveShownRef.current
    leaveArmedRef.current = canArm
    if (!canArm) {
      if (leavePromptOpenRef.current && skipLeave) setLeavePromptOpen(false)
      return
    }

    preloadLeaveFunnelAssets()
    const leaveVoice = getMarketingIntroVoice()
    const firstLeaveLine = loadLeaveFunnel().steps[0]?.spoken
    if (leaveVoice && firstLeaveLine) {
      void prefetchManagedVoiceAudio(leaveVoice, firstLeaveLine)
    }

    const guardState = { keaLeaveGuard: 1 as const }
    if (history.state?.keaLeaveGuard !== 1) {
      history.pushState(guardState, '')
    }

    function showLeavePrompt() {
      if (!leaveArmedRef.current || leaveAllowRef.current || leaveShownRef.current) {
        return
      }
      // Do not interrupt the spoken welcome — leave funnel waits until she finishes.
      if (introBusyRef.current) return
      setLeavePromptOpen(true)
      setHomeOfferOpen(false)
    }

    function onPopState() {
      if (leaveAllowRef.current) return
      // Leave funnel already open → Back means stay / restore marketing home.
      if (leavePromptOpenRef.current) {
        leaveShownRef.current = true
        leaveArmedRef.current = false
        markLeavePromptShown()
        setLeavePromptOpen(false)
        setIntroBusy(false)
        setVisibleCopy('')
        history.pushState(guardState, '')
        return
      }
      if (leaveShownRef.current) return
      if (!leaveArmedRef.current) return
      history.pushState(guardState, '')
      showLeavePrompt()
    }

    function onMouseOut(event: MouseEvent) {
      if (event.clientY > 8) return
      if (event.relatedTarget != null) return
      showLeavePrompt()
    }

    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (!leaveArmedRef.current || leaveAllowRef.current || leaveShownRef.current) {
        return
      }
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('popstate', onPopState)
    document.addEventListener('mouseout', onMouseOut)
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      leaveArmedRef.current = false
      window.removeEventListener('popstate', onPopState)
      document.removeEventListener('mouseout', onMouseOut)
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [authReady, isSignedIn, authOpen, appInstalled, subscribed])

  useEffect(() => {
    if (!langMenuOpen) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setLangMenuOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [langMenuOpen])

  function onLangPointerLeave(event: PointerEvent<HTMLDivElement>) {
    const root = langMenuRef.current
    if (!root) return
    const next = event.relatedTarget
    if (next instanceof Node && root.contains(next)) return
    if (next == null) return
    setLangMenuOpen(false)
  }

  useEffect(() => {
    return () => {
      introRunId.current += 1
      stopKeaSpeech()
    }
  }, [])

  function startWelcomeIntro(code: LanguageCode) {
    setLangMenuOpen(false)
    setProspectLang(code)
    setSpoken(code)
    setNativeLanguage(code)
    // Unlock autoplay while we still have the language-menu click gesture.
    try {
      const unlock = new Audio(
        'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=',
      )
      void unlock.play().then(() => {
        unlock.pause()
      }).catch(() => undefined)
    } catch {
      // ignore
    }
    pendingIntroLang.current = code
    setAudioRouteOpen(true)
  }

  function finishAudioRoute() {
    setAudioRouteOpen(false)
    const code = pendingIntroLang.current
    pendingIntroLang.current = null
    if (code) void playWelcomeIntro(code)
  }

  async function playWelcomeIntro(code: LanguageCode) {
    const runId = ++introRunId.current
    stopKeaSpeech()
    setVisibleCopy('')
    introBusyRef.current = true
    setIntroBusy(true)
    setLangMenuOpen(false)
    setProspectLang(code)
    setSpoken(code)
    setNativeLanguage(code)

    try {
      const paragraphs = await welcomeScriptForLanguage(code)
      if (runId !== introRunId.current) return
      const locale = getLanguage(code).speechLocale
      const introVoice = getMarketingIntroVoice()
      let spokenSoFar = ''
      /** Prefetch next paragraph while the current one plays — cuts the gap. */
      let nextUrl: Promise<string | null> | null =
        introVoice && paragraphs.length > 0
          ? prefetchManagedVoiceAudio(
              introVoice,
              paragraphs[0],
              paragraphs.length === 1 ? WELCOME_CLOSING_TTS_HINT : undefined,
            )
          : null
      const gapMs = 90
      // Fetch the anything-goes line now so it can start as soon as the line before ends.
      if (
        introVoice &&
        WELCOME_ANYTHING_INDEX > 0 &&
        WELCOME_ANYTHING_INDEX < paragraphs.length
      ) {
        void prefetchManagedVoiceAudio(
          introVoice,
          paragraphs[WELCOME_ANYTHING_INDEX],
        )
      }

      for (let index = 0; index < paragraphs.length; index++) {
        if (runId !== introRunId.current) return
        const paragraph = paragraphs[index]
        const closingHint =
          index === paragraphs.length - 1 ? WELCOME_CLOSING_TTS_HINT : undefined
        const intoAnything = index + 1 === WELCOME_ANYTHING_INDEX
        const prefix = spokenSoFar
        const prefetchedUrl = nextUrl ? await nextUrl : null
        nextUrl =
          introVoice && index + 1 < paragraphs.length
            ? prefetchManagedVoiceAudio(
                introVoice,
                paragraphs[index + 1],
                index + 1 === paragraphs.length - 1
                  ? WELCOME_CLOSING_TTS_HINT
                  : undefined,
              )
            : null

        await new Promise<void>((resolve) => {
          const opts = {
            lang: locale,
            prefetchedUrl,
            ttsInstructions: closingHint,
            endTailMs: intoAnything ? 0 : undefined,
            handoffEarlyMs: intoAnything ? 560 : undefined,
            onCharIndex: (charIndex: number) => {
              if (runId !== introRunId.current) return
              const piece = snapToWordEnd(paragraph, charIndex)
              setVisibleCopy(
                prefix ? `${prefix}\n\n${piece}`.trim() : piece,
              )
            },
            onend: () => resolve(),
            onerror: () => {
              setVisibleCopy(
                prefix ? `${prefix}\n\n${paragraph}`.trim() : paragraph,
              )
              resolve()
            },
          }
          if (introVoice) {
            void speakManagedVoice(introVoice, paragraph, opts)
          } else {
            void speakKeaLine(paragraph, opts)
          }
        })
        spokenSoFar = spokenSoFar
          ? `${spokenSoFar}\n\n${paragraph}`
          : paragraph
        setVisibleCopy(spokenSoFar)
        if (
          index + 1 < paragraphs.length &&
          index + 1 !== WELCOME_ANYTHING_INDEX &&
          runId === introRunId.current
        ) {
          await new Promise((resolve) => window.setTimeout(resolve, gapMs))
        }
      }
    } finally {
      if (runId === introRunId.current) {
        introBusyRef.current = false
        setIntroBusy(false)
        setIntroHeard(true)
      }
    }
  }

  function completeOnboarding() {
    if (!spoken || !learning) return
    setProfile({
      firstName: name.trim(),
      email: mail.trim() || email,
      nativeLanguage: spoken,
      targetLanguage: learning,
    })
  }

  function finishLocalProfile() {
    completeOnboarding()
    window.setTimeout(() => navigate('/conversation'), 0)
  }

  function openRegister() {
    if (isSignedIn && isOnboarded) {
      navigate('/conversation')
      return
    }
    setLeavePromptOpen(false)
    setAuthOpen('register')
  }

  function openLogin() {
    if (isPasswordRecoveryLocation()) {
      setAuthOpen('login')
      return
    }
    setLeavePromptOpen(false)
    if (isSignedIn && isOnboarded) {
      navigate('/conversation')
      return
    }
    setAuthOpen('login')
  }

  function dismissLeavePrompt() {
    leaveShownRef.current = true
    leaveArmedRef.current = false
    markLeavePromptShown()
    introRunId.current += 1
    stopKeaSpeech()
    setIntroBusy(false)
    setVisibleCopy('')
    setLeavePromptOpen(false)
  }

  function confirmLeaveAnyway() {
    leaveAllowRef.current = true
    leaveShownRef.current = true
    leaveArmedRef.current = false
    markLeavePromptShown()
    introRunId.current += 1
    stopKeaSpeech()
    setIntroBusy(false)
    setVisibleCopy('')
    setLeavePromptOpen(false)
    // Drop the guard entry, then leave to the previous page if there is one.
    history.back()
    window.setTimeout(() => {
      if (document.visibilityState === 'visible') {
        history.back()
      }
    }, 40)
  }

  const visibleParagraphs = visibleCopy
    ? visibleCopy.split(/\n\n+/).filter(Boolean)
    : []
  const introMode = introBusy || visibleParagraphs.length > 0

  useEffect(() => {
    if (!introMode) return
    const scroller = introScrollRef.current
    if (!scroller) return
    let frame = 0
    frame = window.requestAnimationFrame(() => {
      const latest = (scroller.querySelector('.welcome-method-cta--after-intro') ||
        scroller.querySelector(
          '.welcome-screen__speech:last-of-type, .welcome-screen__lede--hint',
        )) as HTMLElement | null
      if (!latest) return
      const scrollerRect = scroller.getBoundingClientRect()
      const latestRect = latest.getBoundingClientRect()
      const room = scrollerRect.bottom - 12
      if (latestRect.bottom <= room && latestRect.top >= scrollerRect.top + 8) {
        return
      }
      const nextTop = scroller.scrollTop + (latestRect.bottom - room) + 8
      scroller.scrollTop = Math.max(0, nextTop)
    })
    return () => window.cancelAnimationFrame(frame)
  }, [visibleCopy, introBusy, introHeard, visibleParagraphs.length, introMode])

  const langPicker = !authOpen ? (
    <div
      className="welcome-lang-picker"
      ref={langMenuRef}
      onPointerLeave={onLangPointerLeave}
    >
      <button
        type="button"
        className="welcome-lang-picker__trigger"
        aria-expanded={langMenuOpen}
        aria-haspopup="listbox"
        disabled={introBusy}
        onClick={() => setLangMenuOpen((open) => !open)}
      >
        <span>Choose to chat with Kea</span>
        <span
          className={`welcome-lang-picker__arrow${langMenuOpen ? ' is-open' : ''}`}
          aria-hidden="true"
        >
          ▾
        </span>
      </button>
      {langMenuOpen ? (
        <ul className="welcome-lang-picker__menu" role="listbox">
          {SUPPORTED_LANGUAGES.map((language) => (
            <li key={language.code}>
              <button
                type="button"
                role="option"
                aria-selected={prospectLang === language.code}
                className={
                  prospectLang === language.code ? 'is-selected' : undefined
                }
                onClick={() => startWelcomeIntro(language.code)}
              >
                {language.name} · {language.nativeName}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  ) : null

  const homeActions =
    !authReady ? (
      <p className="settings-note">One moment…</p>
    ) : !authOpen ? (
      <div className="welcome-screen__actions welcome-screen__actions--home">
        <div className="welcome-screen__auth-pair">
          <Button type="button" onClick={openRegister}>
            Create free account
          </Button>
        </div>
      </div>
    ) : null

  const spokenBlock = !authOpen ? (
    <div
      className="welcome-screen__spoken"
      aria-live="polite"
      aria-busy={introBusy}
    >
      {introBusy && visibleParagraphs.length === 0 ? (
        <p className="welcome-screen__lede welcome-screen__lede--hint">
          Kea is getting ready…
        </p>
      ) : null}
      {visibleParagraphs.map((paragraph, index) => (
        <p
          key={`${index}-${paragraph.slice(0, 12)}`}
          className="welcome-screen__speech"
        >
          {paragraph}
        </p>
      ))}
      {introHeard && !introBusy ? (
        <Link to="/method" className="welcome-method-cta welcome-method-cta--after-intro">
          The Method
        </Link>
      ) : null}
    </div>
  ) : null

  const localProfileForm = (
    <div className="auth-profile-form">
      <h2 className="welcome-screen__onboard-title">
        {needsProfileFinish ? 'Finish your profile' : 'Create your profile'}
      </h2>
      <label className="welcome-field">
        <span>First name</span>
        <input
          type="text"
          autoComplete="given-name"
          value={name}
          required
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      {needsProfileFinish ? (
        <p className="settings-note">{email}</p>
      ) : (
        <label className="welcome-field">
          <span>Email</span>
          <input
            type="email"
            autoComplete="email"
            value={mail}
            required
            onChange={(event) => setMail(event.target.value)}
          />
        </label>
      )}
      <div className="welcome-languages">
        <KeaLanguageField
          label="I speak"
          tone="onboarding"
          value={spoken}
          placeholder="Choose language"
          onChange={(code) => {
            setSpoken(code)
            if (learning === code) setLearning('')
          }}
        />
        <KeaLanguageField
          label="I am learning"
          tone="onboarding"
          value={learning}
          placeholder="Choose language"
          onChange={(code) => {
            setLearning(code)
            if (spoken === code) setSpoken('')
          }}
        />
      </div>
      {needsAdminPassword && !adminUnlocked && !needsProfileFinish ? (
        <PasswordField
          label="Password"
          autoComplete="current-password"
          value={password}
          onChange={setPassword}
        />
      ) : null}
      <div className="welcome-screen__actions">
        <Button
          type="button"
          className="auth-login-submit"
          disabled={!ready}
          onClick={finishLocalProfile}
        >
          Create account
        </Button>
      </div>
    </div>
  )

  return (
    <main
      className={`companion-screen welcome-screen${authOpen ? ' welcome-screen--modal' : ''}${homeOfferOpen && !authOpen ? ' has-offer-dock' : ''}${leavePromptOpen && !authOpen ? ' welcome-screen--leave-funnel' : ''}${introMode ? ' welcome-screen--intro' : ''}${langMenuOpen && !authOpen ? ' welcome-screen--lang-open' : ''}`}
    >
      <CloudAtmosphere presence="idle" tempo="sunrise" />
      {!authOpen ? (
        <header className="welcome-screen__header method-screen__top">
          <Link to="/" className="method-screen__brand" aria-label="Kea home">
            <img
              className="method-screen__logo"
              src="/kea-mark.png"
              alt="Kea"
              width={180}
              height={90}
              fetchPriority="high"
            />
          </Link>
          <nav className="method-screen__nav" aria-label="Site">
            <NavLink to="/" end className="method-screen__home">
              Home
            </NavLink>
            <NavLink to="/method" className="method-screen__page-title">
              The Method
            </NavLink>
            <button
              type="button"
              className="method-screen__page-title method-screen__login"
              onClick={openLogin}
            >
              Login
            </button>
          </nav>
        </header>
      ) : null}
      {!authOpen ? (
        <div
          className={`welcome-screen__shell${
            introMode ? ' welcome-screen__shell--intro' : ''
          }`}
        >
          <div className="welcome-screen__pinned">
            {introMode ? <h1>{welcomeTitle}</h1> : null}
          </div>
          <div className="welcome-screen__scroll" ref={introScrollRef}>
            {!introMode ? (
              <div className="welcome-stage">
                <div className="welcome-stage__mascot" aria-hidden="true">
                  <div className="welcome-stage__bird-wrap welcome-stage__bird-wrap--waving">
                    <span className="welcome-stage__mic-waves">
                      <span className="welcome-stage__mic-ring welcome-stage__mic-ring--1" />
                      <span className="welcome-stage__mic-ring welcome-stage__mic-ring--2" />
                      <span className="welcome-stage__mic-ring welcome-stage__mic-ring--3" />
                    </span>
                    <img
                      className="welcome-stage__bird"
                      src="/kea-branch.png"
                      alt=""
                      width={432}
                      height={512}
                    />
                  </div>
                </div>
                <div className="welcome-stage__panel">
                  <p className="welcome-stage__eyebrow">
                    Hands-free language companion
                  </p>
                  <h1>{welcomeTitle}</h1>
                  <p className="welcome-stage__support">
                    Say &ldquo;Hey Kea&rdquo; and talk like a friend — she
                    listens, replies, and helps you learn as you go.
                  </p>
                  {langPicker}
                  {homeActions}
                </div>
              </div>
            ) : null}

            {spokenBlock}
          </div>
          {introMode ? (
            <div className="welcome-screen__dock">{homeActions}</div>
          ) : null}
        </div>
      ) : null}

      {!authOpen ? (
        <footer className="welcome-screen__store-footer">
          {!introMode ? <HomeCommentsStrip /> : null}
          <div className="welcome-screen__store-footer-bar">
            <StoreBadges />
            <SiteFooter tone="marketing" />
          </div>
        </footer>
      ) : null}

      {authOpen ? (
        <div
          className="auth-modal"
          role="dialog"
          aria-modal="true"
          aria-label={authOpen === 'login' ? 'Sign in' : 'Create account'}
          onPointerDown={(event) => {
            if (event.target !== event.currentTarget) return
            if (event.pointerType !== 'mouse') return
            setAuthOpen(false)
          }}
        >
          <div
            className="auth-modal__stage"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="auth-modal__mascot" aria-hidden="true">
              <div className="auth-modal__bird-wrap">
                <img
                  className="auth-modal__bird"
                  src="/kea-04.png"
                  alt=""
                />
              </div>
            </div>
            <div
              className={`auth-modal__card${
                authOpen === 'login' ? ' auth-modal__card--compact' : ''
              }`}
            >
              <button
                type="button"
                className="auth-modal__close"
                onClick={() => setAuthOpen(false)}
              >
                Close
              </button>
              {showCloudAuth || authOpen === 'login' ? (
                <AuthPanel
                  initialView={
                    isPasswordRecoveryLocation()
                      ? 'reset'
                      : window.location.hash.includes('type=recovery')
                        ? 'reset'
                        : authOpen
                  }
                />
              ) : (
                localProfileForm
              )}
            </div>
          </div>
        </div>
      ) : null}
      {homeOfferOpen && !authOpen && !leavePromptOpen ? (
        <OfferPopup
          offer={getOffer('home')}
          tone="home"
          onClose={() => {
            dismissHomeOffer()
            setHomeOfferOpen(false)
          }}
        />
      ) : null}
      {audioRouteOpen ? (
        <MobileAudioRoutePopup onDone={finishAudioRoute} />
      ) : null}
      {leavePromptOpen && !authOpen && !isSignedIn ? (
        <LeaveAccountPopup
          onCreateAccount={openRegister}
          onStay={dismissLeavePrompt}
          onLeave={confirmLeaveAnyway}
        />
      ) : null}
    </main>
  )
}
