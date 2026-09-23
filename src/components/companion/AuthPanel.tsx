import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from './Button'
import { PasswordField } from './PasswordField'
import { SUPPORTED_LANGUAGES } from '../../config/languages'
import { isAdminEmail } from '../../architecture/adminAuth'
import { getSupabase } from '../../lib/supabase'
import {
  authMessage,
  clearPasswordRecovery,
  isPasswordRecoveryLocation,
  keaAuthRedirect,
} from '../../services/keaProfile'
import { useSession } from '../../context/SessionContext'
import type { LanguageCode } from '../../types'

type AuthView = 'register' | 'login' | 'forgot' | 'check-email' | 'reset'

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

interface AuthPanelProps {
  initialView?: AuthView
}

export function AuthPanel({ initialView = 'register' }: AuthPanelProps) {
  const navigate = useNavigate()
  const { setProfile, firstName, isSignedIn } = useSession()
  const [view, setView] = useState<AuthView>(() =>
    isPasswordRecoveryLocation() ? 'reset' : initialView,
  )
  const [name, setName] = useState(firstName)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [spoken, setSpoken] = useState<LanguageCode | ''>('')
  const [learning, setLearning] = useState<LanguageCode | ''>('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (isPasswordRecoveryLocation()) {
      setView('reset')
      return
    }
    setView(initialView)
  }, [initialView])

  useEffect(() => {
    if (isPasswordRecoveryLocation()) return
    if (isSignedIn) navigate('/conversation', { replace: true })
  }, [isSignedIn, navigate])

  const spokenLabel = SUPPORTED_LANGUAGES.find((item) => item.code === spoken)
  const learningLabel = SUPPORTED_LANGUAGES.find((item) => item.code === learning)

  async function register() {
    const supabase = getSupabase()
    if (!supabase) return
    if (!name.trim() || !isEmail(email) || !spoken || !learning || spoken === learning) {
      setMessage('Fill in your name, email, and two different languages.')
      return
    }
    if (!password || !confirm) {
      setMessage('Enter your password twice.')
      return
    }
    if (password.length < 6) {
      setMessage('Use at least 6 characters for your password.')
      return
    }
    if (password !== confirm) {
      setMessage('The passwords do not match.')
      return
    }
    setBusy(true)
    setMessage('')
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: keaAuthRedirect(),
        data: {
          first_name: name.trim(),
          native_language: spoken,
          target_language: learning,
        },
      },
    })
    setBusy(false)
    if (error) {
      setMessage(authMessage(error, 'Could not create your account.'))
      return
    }
    setProfile({
      firstName: name.trim(),
      email: email.trim(),
      nativeLanguage: spoken,
      targetLanguage: learning,
    })
    setView('check-email')
  }

  async function login() {
    const supabase = getSupabase()
    if (!supabase) {
      setMessage('Kea could not reach sign-in. Refresh the page and try again.')
      return
    }
    if (!isEmail(email) || !password) {
      setMessage('Enter your email and password.')
      return
    }
    setBusy(true)
    setMessage('')
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: password.trim(),
      })
      if (error || !data.session) {
        const raw =
          error && typeof error === 'object' && 'message' in error
            ? String((error as { message: string }).message)
            : ''
        if (isAdminEmail(email) && /not confirmed|email_not_confirmed/i.test(raw)) {
          setMessage(
            'Admin does not confirm by email. Mark this account confirmed in Kea Production Auth, then sign in again.',
          )
          return
        }
        setMessage(authMessage(error, 'Incorrect email or password.'))
        return
      }
      setMessage('Signing you in…')
      navigate('/conversation', { replace: true })
    } catch (caught) {
      setMessage(authMessage(caught, 'Could not sign in.'))
    } finally {
      setBusy(false)
    }
  }

  async function forgot() {
    const supabase = getSupabase()
    if (!supabase) {
      setMessage('Kea could not send a reset note. Refresh and try again.')
      return
    }
    if (!isEmail(email)) {
      setMessage('Enter the email on your Kea account.')
      return
    }
    setBusy(true)
    setMessage('')
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: keaAuthRedirect(),
      })
      if (error) {
        setMessage(authMessage(error, 'Could not send a reset note.'))
        return
      }
      setMessage(
        'If that email has a Kea account, a note is on its way. Check inbox and spam. If nothing arrives, Kea Production Auth mail is not sending yet.',
      )
    } catch (caught) {
      setMessage(authMessage(caught, 'Could not send a reset note.'))
    } finally {
      setBusy(false)
    }
  }

  async function resend() {
    const supabase = getSupabase()
    if (!supabase || !isEmail(email)) return
    setBusy(true)
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
      options: { emailRedirectTo: keaAuthRedirect() },
    })
    setBusy(false)
    setMessage(
      error
        ? authMessage(error, 'Could not send the note again.')
        : 'Another note is on its way.',
    )
  }

  async function saveNewPassword() {
    const supabase = getSupabase()
    if (!supabase) return
    if (password.length < 6) {
      setMessage('Use at least 6 characters for your password.')
      return
    }
    if (password !== confirm) {
      setMessage('The passwords do not match.')
      return
    }
    setBusy(true)
    setMessage('')
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) {
      setMessage(authMessage(error, 'Could not save the new password.'))
      return
    }
    clearPasswordRecovery()
    window.history.replaceState(null, '', window.location.pathname)
    setPassword('')
    setConfirm('')
    setMessage('Password saved. You are signed in.')
    setGoHome(true)
  }

  return (
    <div className="auth-panel">
      {view === 'register' ? (
        <form
          className="auth-register"
          onSubmit={(event) => {
            event.preventDefault()
            void register()
          }}
        >
          <h2 className="welcome-screen__onboard-title">Create account</h2>
          <label className="welcome-field">
            <span className="visually-hidden">First name</span>
            <input
              type="text"
              autoComplete="given-name"
              placeholder="First name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label className="welcome-field">
            <span className="visually-hidden">Email</span>
            <input
              type="email"
              autoComplete="email"
              placeholder="Email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <PasswordField
            label="Password"
            autoComplete="new-password"
            placeholder="Password"
            value={password}
            onChange={setPassword}
          />
          <PasswordField
            label="Enter password again"
            autoComplete="new-password"
            placeholder="Enter password again"
            value={confirm}
            onChange={setConfirm}
          />
          <div className="welcome-languages">
            <label className="welcome-field">
              <span className="visually-hidden">I speak</span>
              <select
                value={spoken}
                onChange={(event) => setSpoken(event.target.value as LanguageCode)}
              >
                <option value="">I speak</option>
                {SUPPORTED_LANGUAGES.map((language) => (
                  <option key={language.code} value={language.code}>
                    {language.name} · {language.nativeName}
                  </option>
                ))}
              </select>
            </label>
            <label className="welcome-field">
              <span className="visually-hidden">I am learning</span>
              <select
                value={learning}
                onChange={(event) =>
                  setLearning(event.target.value as LanguageCode)
                }
              >
                <option value="">I am learning</option>
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
          <div className="welcome-screen__actions auth-login-actions">
            <Button
              type="submit"
              className="auth-login-submit"
              disabled={busy}
            >
              Create account
            </Button>
            <button
              type="button"
              className="auth-text-link"
              onClick={() => setView('login')}
            >
              Sign in
            </button>
          </div>
        </form>
      ) : null}

      {view === 'login' ? (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void login()
          }}
        >
          <h2 className="welcome-screen__onboard-title">Sign in</h2>
          <label className="welcome-field">
            <span className="visually-hidden">Email</span>
            <input
              type="email"
              name="email"
              inputMode="email"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="Email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              onFocus={(event) => {
                event.currentTarget.scrollIntoView({
                  block: 'center',
                  behavior: 'smooth',
                })
              }}
            />
          </label>
          <PasswordField
            hideLabel
            label="Password"
            name="password"
            autoComplete="current-password"
            enterKeyHint="go"
            placeholder="Password"
            value={password}
            onChange={setPassword}
          />
          <p
            className={`auth-panel__message${
              !message || /^signing in/i.test(message)
                ? ' auth-panel__message--info'
                : ''
            }`}
            role="alert"
            aria-live="assertive"
          >
            {message || (busy ? 'Signing in…' : null)}
          </p>
          <div className="welcome-screen__actions auth-login-actions">
            <Button
              type="submit"
              className="auth-login-submit"
              disabled={busy}
            >
              Sign in
            </Button>
            <div className="auth-text-links">
              <button
                type="button"
                className="auth-text-link"
                onClick={() => setView('register')}
              >
                Create account
              </button>
              <button
                type="button"
                className="auth-text-link"
                onClick={() => setView('forgot')}
              >
                Forgot password
              </button>
            </div>
          </div>
        </form>
      ) : null}

      {view === 'forgot' ? (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void forgot()
          }}
        >
          <h2 className="welcome-screen__onboard-title">Reset password</h2>
          <p className="settings-note">
            Kea will send a note to this email. Open it to choose a new
            password. Check spam if it does not appear.
          </p>
          <label className="welcome-field">
            <span className="visually-hidden">Email</span>
            <input
              type="email"
              autoComplete="email"
              placeholder="Email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          {message ? (
            <p className="auth-panel__message" role="alert">
              {message}
            </p>
          ) : null}
          <div className="welcome-screen__actions auth-login-actions">
            <Button
              type="submit"
              className="auth-login-submit"
              disabled={busy}
            >
              Send reset note
            </Button>
            <button
              type="button"
              className="auth-text-link"
              onClick={() => setView('login')}
            >
              Sign in
            </button>
          </div>
        </form>
      ) : null}

      {view === 'check-email' ? (
        <>
          <h2 className="welcome-screen__onboard-title">Look at your email</h2>
          <p className="settings-note">
            Confirm your address (or open the reset note) to continue.
          </p>
          <div className="welcome-screen__actions auth-check-actions">
            <Button type="button" disabled={busy} onClick={() => void resend()}>
              Send the note again
            </Button>
            <Button type="button" variant="ghost" onClick={() => setView('login')}>
              Sign in
            </Button>
          </div>
        </>
      ) : null}

      {view === 'reset' ? (
        <>
          <h2 className="welcome-screen__onboard-title">Choose a new password</h2>
          <PasswordField
            label="New password"
            autoComplete="new-password"
            value={password}
            onChange={setPassword}
          />
          <PasswordField
            label="Confirm password"
            autoComplete="new-password"
            value={confirm}
            onChange={setConfirm}
          />
          <div className="welcome-screen__actions">
            <Button
              type="button"
              disabled={busy}
              onClick={() => void saveNewPassword()}
            >
              Save password
            </Button>
          </div>
        </>
      ) : null}

      {view !== 'login' && view !== 'forgot' && message ? (
        <p className="auth-panel__message" role="alert">
          {message}
        </p>
      ) : null}
    </div>
  )
}
