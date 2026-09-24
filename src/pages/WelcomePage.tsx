import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/companion/Button'
import { CloudAtmosphere } from '../components/companion/CloudAtmosphere'
import { AuthPanel } from '../components/companion/AuthPanel'
import { LeaveAccountPopup } from '../components/companion/LeaveAccountPopup'
import { KeaOptionSheet } from '../components/companion/KeaOptionSheet'
import { OfferPopup } from '../components/companion/OfferPopup'
import { PasswordField } from '../components/companion/PasswordField'
import { getLanguage, SUPPORTED_LANGUAGES } from '../config/languages'
import { isAdminEmail } from '../architecture/adminAuth'
import { getMarketingIntroVoice } from '../architecture/voiceCatalog'
import { welcomeScriptForLanguage } from '../architecture/welcomeMarketing'
import {
  dismissHomeOffer,
  getOffer,
  shouldShowPopup1,
} from '../data/keaOffers'
import { getWelcomeTitle } from '../data/keaWelcomeTitle'
import { useSession } from '../context/SessionContext'
import { isPasswordRecoveryLocation } from '../services/keaProfile'
import { speakManagedVoice, speakKeaLine, stopKeaSpeech } from '../services/keaSpeak'
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
  const [prospectLang, setProspectLang] = useState<LanguageCode | ''>(
    nativeLanguage || '',
  )
  const [visibleCopy, setVisibleCopy] = useState('')
  const [introBusy, setIntroBusy] = useState(false)
  const [homeOfferOpen, setHomeOfferOpen] = useState(false)
  const [leavePromptOpen, setLeavePromptOpen] = useState(false)
  const [langSheet, setLangSheet] = useState<null | 'spoken' | 'learning'>(null)
  const introRunId = useRef(0)
  const langMenuRef = useRef<HTMLDivElement>(null)
  const leaveArmedRef = useRef(false)
  const leaveAllowRef = useRef(false)
  const leaveShownRef = useRef(leavePromptAlreadyShown())

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
  useEffect(() => {
    const canArm =
      authReady && !isSignedIn && !authOpen && !leaveShownRef.current
    leaveArmedRef.current = canArm
    if (!canArm) return

    const guardState = { keaLeaveGuard: 1 as const }
    if (history.state?.keaLeaveGuard !== 1) {
      history.pushState(guardState, '')
    }

    function showLeavePrompt() {
      if (!leaveArmedRef.current || leaveAllowRef.current || leaveShownRef.current) {
        return
      }
      introRunId.current += 1
      stopKeaSpeech()
      setLeavePromptOpen(true)
      setHomeOfferOpen(false)
    }

    function onPopState() {
      if (leaveAllowRef.current || leaveShownRef.current) return
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
  }, [authReady, isSignedIn, authOpen])

  useEffect(() => {
    if (!langMenuOpen) return
    function onPointer(event: MouseEvent) {
      if (!langMenuRef.current?.contains(event.target as Node)) {
        setLangMenuOpen(false)
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setLangMenuOpen(false)
    }
    window.addEventListener('mousedown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [langMenuOpen])

  useEffect(() => {
    return () => {
      introRunId.current += 1
      stopKeaSpeech()
    }
  }, [])

  async function playWelcomeIntro(code: LanguageCode) {
    const runId = ++introRunId.current
    stopKeaSpeech()
    setVisibleCopy('')
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

      for (const paragraph of paragraphs) {
        if (runId !== introRunId.current) return
        const prefix = spokenSoFar
        await new Promise<void>((resolve) => {
          const opts = {
            lang: locale,
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
      }
    } finally {
      if (runId === introRunId.current) setIntroBusy(false)
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
    setLeavePromptOpen(false)
  }

  function confirmLeaveAnyway() {
    leaveAllowRef.current = true
    leaveShownRef.current = true
    leaveArmedRef.current = false
    markLeavePromptShown()
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
        <div className="welcome-field">
          <span>I speak</span>
          <button
            type="button"
            className="settings-picker"
            onClick={() => setLangSheet('spoken')}
          >
            {spoken
              ? `${getLanguage(spoken).name} · ${getLanguage(spoken).nativeName}`
              : 'Choose language'}
          </button>
        </div>
        <div className="welcome-field">
          <span>I am learning</span>
          <button
            type="button"
            className="settings-picker"
            onClick={() => setLangSheet('learning')}
          >
            {learning
              ? `${getLanguage(learning).name} · ${getLanguage(learning).nativeName}`
              : 'Choose language'}
          </button>
        </div>
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
      className={`companion-screen welcome-screen${authOpen ? ' welcome-screen--modal' : ''}${homeOfferOpen && !authOpen ? ' has-offer-dock' : ''}${leavePromptOpen && !authOpen ? ' welcome-screen--leave-funnel' : ''}`}
    >
      <CloudAtmosphere presence="idle" tempo="sunrise" />
      <div className="welcome-screen__content">
        <div className="welcome-screen__brand">
          <img className="welcome-screen__logo" src="/kea-05.png" alt="Kea" />
        </div>
        <h1>{welcomeTitle}</h1>

        {!authOpen ? (
        <div className="welcome-lang-picker" ref={langMenuRef}>
          <button
            type="button"
            className="welcome-lang-picker__trigger"
            aria-expanded={langMenuOpen}
            aria-haspopup="listbox"
            disabled={introBusy}
            onClick={() => setLangMenuOpen((open) => !open)}
          >
            <span>Choose your native language.</span>
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
                    onClick={() => void playWelcomeIntro(language.code)}
                  >
                    {language.name} · {language.nativeName}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        ) : null}

        {!authOpen ? (
        <div
          className="welcome-screen__spoken"
          aria-live="polite"
          aria-busy={introBusy}
        >
          {visibleParagraphs.length === 0 && !introBusy ? (
            <p className="welcome-screen__lede welcome-screen__lede--hint">
              Pick a language and Kea will introduce herself.
            </p>
          ) : null}
          {introBusy && visibleParagraphs.length === 0 ? (
            <p className="welcome-screen__lede welcome-screen__lede--hint">
              Kea is getting ready…
            </p>
          ) : null}
          {visibleParagraphs.map((paragraph, index) => (
            <p key={`${index}-${paragraph.slice(0, 12)}`} className="welcome-screen__lede">
              {paragraph}
            </p>
          ))}
        </div>
        ) : null}

        {!authReady ? (
          <p className="settings-note">One moment…</p>
        ) : !authOpen ? (
          <div className="welcome-screen__actions welcome-screen__actions--home">
            <Button type="button" onClick={openRegister}>
              Create account
            </Button>
            <Button type="button" variant="ghost" onClick={openLogin}>
              Sign in
            </Button>
          </div>
        ) : null}
      </div>

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
            className={`auth-modal__card${
              authOpen === 'login' ? ' auth-modal__card--compact' : ''
            }`}
            onClick={(event) => event.stopPropagation()}
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
      ) : null}
      {langSheet ? (
        <KeaOptionSheet
          title={langSheet === 'spoken' ? 'I speak' : 'I am learning'}
          options={SUPPORTED_LANGUAGES.map((language) => ({
            value: language.code,
            label: `${language.name} · ${language.nativeName}`,
          }))}
          value={langSheet === 'spoken' ? spoken : learning}
          onChange={(next) => {
            const code = next as LanguageCode
            if (langSheet === 'spoken') {
              setSpoken(code)
              if (learning === code) setLearning('')
            } else {
              setLearning(code)
              if (spoken === code) setSpoken('')
            }
          }}
          onClose={() => setLangSheet(null)}
        />
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
