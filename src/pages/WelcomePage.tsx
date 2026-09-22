import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/companion/Button'
import { CloudAtmosphere } from '../components/companion/CloudAtmosphere'
import { KeaMark } from '../components/companion/KeaMark'
import { AuthPanel } from '../components/companion/AuthPanel'
import { PasswordField } from '../components/companion/PasswordField'
import { SUPPORTED_LANGUAGES } from '../config/languages'
import { isAdminEmail } from '../architecture/adminAuth'
import { useSession } from '../context/SessionContext'
import { isPasswordRecoveryLocation } from '../services/keaProfile'
import type { LanguageCode } from '../types'

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

type AuthOpen = false | 'register' | 'login'

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
    authReady,
    cloudAuth,
    isSignedIn,
  } = useSession()
  const [name, setName] = useState(firstName)
  const [mail, setMail] = useState(email)
  const [spoken, setSpoken] = useState<LanguageCode | ''>(nativeLanguage || '')
  const [learning, setLearning] = useState<LanguageCode | ''>(languageCode ?? '')
  const [password, setPassword] = useState('')
  const [authOpen, setAuthOpen] = useState<AuthOpen>(() =>
    isPasswordRecoveryLocation() ? 'login' : false,
  )

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
  const spokenLabel = SUPPORTED_LANGUAGES.find((item) => item.code === spoken)
  const learningLabel = SUPPORTED_LANGUAGES.find((item) => item.code === learning)

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
    setAuthOpen('register')
  }

  function openLogin() {
    if (isPasswordRecoveryLocation()) {
      setAuthOpen('login')
      return
    }
    if (isSignedIn && isOnboarded) {
      navigate('/conversation')
      return
    }
    setAuthOpen('login')
  }

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
            onChange={(event) => setMail(event.target.value)}
          />
        </label>
      )}
      <div className="welcome-languages">
        <label className="welcome-field">
          <span>I speak</span>
          <select
            value={spoken}
            onChange={(event) => setSpoken(event.target.value as LanguageCode)}
          >
            <option value="">Choose language</option>
            {SUPPORTED_LANGUAGES.map((language) => (
              <option key={language.code} value={language.code}>
                {language.name} · {language.nativeName}
              </option>
            ))}
          </select>
        </label>
        <label className="welcome-field">
          <span>I am learning</span>
          <select
            value={learning}
            onChange={(event) =>
              setLearning(event.target.value as LanguageCode)
            }
          >
            <option value="">Choose language</option>
            {SUPPORTED_LANGUAGES.map((language) => (
              <option key={`learn-${language.code}`} value={language.code}>
                {language.name} · {language.nativeName}
              </option>
            ))}
          </select>
        </label>
      </div>
      {spokenLabel && learningLabel ? (
        <p className="welcome-screen__pair">
          {spokenLabel.name} → {learningLabel.name}
        </p>
      ) : null}
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
      className={`companion-screen welcome-screen${authOpen ? ' welcome-screen--modal' : ''}`}
    >
      <CloudAtmosphere presence="idle" tempo="sunrise" />
      <header className="welcome-screen__top">
        <span />
        <span />
      </header>
      <div className="welcome-screen__content">
        <div className="welcome-screen__brand">
          <KeaMark className="kea-mark--welcome" />
        </div>
        <h1>Chat with Kea</h1>
        <p className="welcome-screen__lede">
          Kea is a hands-free conversational companion that helps you learn
          languages naturally through real conversation, remembered topics, and
          a personalised Learn List.
        </p>
        <p className="welcome-screen__lede">
          Kea behaves like a friend, not a teacher. As you chat, you impact her
          personality, and change her mood, just as you do with a friend.
        </p>
        <p className="welcome-screen__lede welcome-screen__lede--extra">
          She's there for you whenever you've got a few spare minutes; in your
          car, walking the dog, doing the dishes.
        </p>
        <p className="welcome-screen__lede">
          No games, no fluff, no structured lesson plan. Just an anything goes
          companion, available in your chosen language, whenever you want to
          chat.
        </p>

        {!authReady ? (
          <p className="settings-note">One moment…</p>
        ) : (
          <div className="welcome-screen__actions welcome-screen__actions--home">
            <Button type="button" onClick={openRegister}>
              Create account
            </Button>
            <Button type="button" variant="ghost" onClick={openLogin}>
              Sign in
            </Button>
          </div>
        )}
      </div>

      {authOpen ? (
        <div
          className="auth-modal"
          role="dialog"
          aria-modal="true"
          aria-label={authOpen === 'login' ? 'Sign in' : 'Create account'}
          onClick={() => setAuthOpen(false)}
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
    </main>
  )
}
