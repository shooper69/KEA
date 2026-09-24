import { useRef, useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CloudAtmosphere } from '../components/companion/CloudAtmosphere'
import { CompanionNav } from '../components/companion/CompanionNav'
import { PasswordField } from '../components/companion/PasswordField'
import { changeAdminPassword, isAdminEmail } from '../architecture/adminAuth'
import { SUPPORTED_LANGUAGES } from '../config/languages'
import { useSession } from '../context/SessionContext'
import { authMessage } from '../services/keaProfile'
import {
  enabledUserVoices,
  loadVoiceCatalog,
  readUserVoiceId,
  saveUserVoiceId,
} from '../architecture/voiceCatalog'
import { speakManagedVoice } from '../services/keaSpeak'
import { getSupabase } from '../lib/supabase'
import { SubscriptionPanel } from '../components/companion/SubscriptionPanel'
import { UsagePanel } from '../components/companion/UsagePanel'
import {
  getAnswerSilenceSeconds,
  saveAnswerSilenceSeconds,
} from '../data/keaAnswerSilence'
import {
  listAudioInputs,
  savePreferredMicId,
} from '../architecture/keaMicrophone'
import type { ChatKeep, SkyTheme } from '../types'

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle
        cx="12"
        cy="12"
        r="9.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path fill="currentColor" d="M10 8.6v6.8l6-3.4z" />
    </svg>
  )
}

function readPhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    const url = URL.createObjectURL(file)
    image.onload = () => {
      const canvas = document.createElement('canvas')
      const size = 256
      canvas.width = size
      canvas.height = size
      const context = canvas.getContext('2d')
      if (!context) {
        reject(new Error('Could not read photo'))
        return
      }
      const scale = Math.max(size / image.width, size / image.height)
      const width = image.width * scale
      const height = image.height * scale
      context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.82))
    }
    image.onerror = () => reject(new Error('Could not read photo'))
    image.src = url
  })
}

export function SettingsPage() {
  const {
    firstName,
    email,
    photoDataUrl,
    isAdmin,
    isSignedIn,
    nativeLanguage,
    languageCode,
    setProfile,
    notifyMemory,
    notifyTalk,
    saveTranscripts,
    listenIdleSeconds,
    skyTheme,
    chatKeep,
  } = useSession()
  const [answerSilence, setAnswerSilence] = useState(getAnswerSilenceSeconds)
  const fileRef = useRef<HTMLInputElement>(null)
  const [currentPassword, setCurrentPassword] = useState('')
  const [nextPassword, setNextPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordMessage, setPasswordMessage] = useState('')
  const [profileSaved, setProfileSaved] = useState('')
  const [draftName, setDraftName] = useState(firstName)
  const [draftEmail, setDraftEmail] = useState(email)
  const [tab, setTab] = useState<
    | 'choices'
    | 'languages'
    | 'listening'
    | 'memory'
    | 'notifications'
    | 'profile'
    | 'security'
    | 'subscription'
    | 'usage'
  >('choices')
  const [searchParams] = useSearchParams()
  useEffect(() => {
    const next = searchParams.get('tab')
    if (next === 'subscription' || next === 'usage') setTab(next)
  }, [searchParams])
  const catalog = loadVoiceCatalog()
  const userVoices = enabledUserVoices(catalog)
  const [userVoiceId, setUserVoiceId] = useState(
    () => readUserVoiceId() ?? catalog.defaultId,
  )
  const [micDevices, setMicDevices] = useState<
    Array<{ deviceId: string; label: string }>
  >([])
  const [preferredMicId, setPreferredMicId] = useState(() => {
    try {
      return localStorage.getItem('kea-preferred-mic-id') || ''
    } catch {
      return ''
    }
  })

  useEffect(() => {
    if (tab !== 'listening') return
    let cancelled = false
    void (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        stream.getTracks().forEach((track) => track.stop())
        const inputs = await listAudioInputs()
        if (cancelled) return
        setMicDevices(
          inputs.map((item) => ({
            deviceId: item.deviceId,
            label: item.label || `Microphone ${item.deviceId.slice(0, 6)}`,
          })),
        )
      } catch {
        if (!cancelled) setMicDevices([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [tab])

  async function onPhoto(file: File | undefined) {
    if (!file) return
    const photoDataUrl = await readPhoto(file)
    setProfile({ photoDataUrl })
  }

  return (
    <main className="companion-screen settings-screen">
      <CloudAtmosphere presence="idle" />
      <header className="settings-screen__header">
        <CompanionNav />
      </header>
      <div className="settings-screen__content">
        <div className="settings-title-row">
          <h1>Settings</h1>
          <Link to="/conversation" className="settings-close" aria-label="Close settings">
            ×
          </Link>
        </div>
        <div className="settings-tabs" role="tablist" aria-label="Settings">
          {isAdmin ? (
            <Link to="/admin">Admin</Link>
          ) : null}
          {(
            [
              ['choices', 'Choices'],
              ['languages', 'Languages'],
              ['listening', 'Listening'],
              ['memory', 'Memory'],
              ['notifications', 'Notifications'],
              ['profile', 'Profile'],
              ['security', 'Security'],
              ['subscription', 'Subscriptions'],
              ['usage', 'Usage'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={tab === id ? 'is-active' : undefined}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>
        {tab === 'choices' ? (
          <>
        {isAdmin ? (
        <section className="settings-card">
          <h2>Background theme</h2>
          <p className="settings-note">
            Admin only. Users always see Kea in the clouds.
          </p>
          <label className="settings-choice">
            <input
              type="radio"
              name="sky"
              checked={skyTheme === 'clouds'}
              onChange={() => setProfile({ skyTheme: 'clouds' as SkyTheme })}
            />
            <span>
              <strong>Kea in the clouds</strong>
              Colour washing quickly through the sky.
            </span>
          </label>
          <label className="settings-choice">
            <input
              type="radio"
              name="sky"
              checked={skyTheme === 'weather'}
              onChange={() => setProfile({ skyTheme: 'weather' as SkyTheme })}
            />
            <span>
              <strong>Today the weather will be …</strong>
              Sun bursting through, then rain, then a rainbow, at random.
              <span className="settings-wip-note">
                Work in progress.
              </span>
            </span>
          </label>
        </section>
        ) : null}
        <section className="settings-card">
          <h2>Voice</h2>
          <p className="settings-note">
            Choose how Kea sounds. Names and descriptions come from Voice
            Management.
          </p>
          {userVoices.length ? (
            <div className="voice-cast__list" role="listbox" aria-label="Voices">
              {userVoices.map((voice) => {
                const selected = voice.id === userVoiceId
                return (
                  <div
                    key={voice.id}
                    className={`voice-cast__choice${selected ? ' is-chosen' : ''}`}
                  >
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className="voice-cast__pick"
                      onClick={() => {
                        saveUserVoiceId(voice.id)
                        setUserVoiceId(voice.id)
                      }}
                    >
                      <span className="voice-cast__name">{voice.userName}</span>
                      <span className="voice-cast__style">
                        {voice.userDescription}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="voice-cast__play"
                      aria-label={`Hear ${voice.userName}`}
                      onClick={() =>
                        void speakManagedVoice(voice, undefined, {
                          lang: voice.lang,
                        })
                      }
                    >
                      <PlayIcon />
                    </button>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="settings-note">
              No voices are enabled yet. An admin can turn some on in Voice
              Management.
            </p>
          )}
        </section>
          </>
        ) : null}
        {tab === 'languages' ? (
          <section className="settings-card">
            <h2>Languages</h2>
            <p className="settings-note">
              Choose the language you use, and the language Kea replies in.
              They should be different.
            </p>
            <label className="welcome-field">
              <span>Your language</span>
              <select
                value={nativeLanguage ?? ''}
                onChange={(event) => {
                  const next = event.target.value as NonNullable<
                    typeof nativeLanguage
                  >
                  if (!next) return
                  setProfile({
                    nativeLanguage: next,
                    ...(languageCode === next
                      ? {
                          targetLanguage:
                            SUPPORTED_LANGUAGES.find((item) => item.code !== next)
                              ?.code ?? null,
                        }
                      : {}),
                  })
                }}
              >
                <option value="" disabled>
                  Choose your language
                </option>
                {SUPPORTED_LANGUAGES.map((language) => (
                  <option key={language.code} value={language.code}>
                    {language.name} · {language.nativeName}
                  </option>
                ))}
              </select>
            </label>
            <label className="welcome-field">
              <span>Kea&apos;s reply language</span>
              <select
                value={languageCode ?? ''}
                onChange={(event) => {
                  const next = event.target.value as NonNullable<
                    typeof languageCode
                  >
                  if (!next) return
                  setProfile({
                    targetLanguage: next,
                    ...(nativeLanguage === next
                      ? {
                          nativeLanguage:
                            SUPPORTED_LANGUAGES.find((item) => item.code !== next)
                              ?.code ?? null,
                        }
                      : {}),
                  })
                }}
              >
                <option value="" disabled>
                  Choose Kea&apos;s reply language
                </option>
                {SUPPORTED_LANGUAGES.map((language) => (
                  <option key={`reply-${language.code}`} value={language.code}>
                    {language.name} · {language.nativeName}
                  </option>
                ))}
              </select>
            </label>
          </section>
        ) : null}
        {tab === 'listening' ? (
        <section className="settings-card settings-card--listening">
          <h2>Listening</h2>
          <label className="welcome-field">
            <span>Microphone for Kea</span>
            <select
              value={preferredMicId}
              onChange={(event) => {
                const next = event.target.value
                setPreferredMicId(next)
                savePreferredMicId(next)
              }}
            >
              <option value="">Automatic (prefer real mic)</option>
              {micDevices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label}
                </option>
              ))}
            </select>
          </label>
          <label className="welcome-field">
            <span>Turn the microphone off after</span>
            <select
              value={listenIdleSeconds}
              onChange={(event) =>
                setProfile({ listenIdleSeconds: Number(event.target.value) })
              }
            >
              {[5, 8, 10, 15, 20, 30, 45, 60].map((seconds) => (
                <option key={seconds} value={seconds}>
                  {seconds} seconds
                </option>
              ))}
            </select>
          </label>
          <label className="welcome-field">
            <span>Kea starts to answer after</span>
            <select
              value={answerSilence}
              onChange={(event) => {
                const next = Number(event.target.value)
                setAnswerSilence(next)
                saveAnswerSilenceSeconds(next)
                setProfile({ answerAfterSilenceSeconds: next })
              }}
            >
              {[1, 2, 3, 4, 5, 6, 8, 10].map((seconds) => (
                <option key={seconds} value={seconds}>
                  {seconds} seconds of silence
                </option>
              ))}
            </select>
          </label>
        </section>
        ) : null}
        {tab === 'subscription' ? (
          <SubscriptionPanel
            email={email}
            isAdmin={isAdmin}
            onViewUsage={() => setTab('usage')}
          />
        ) : null}
        {tab === 'usage' ? <UsagePanel isAdmin={isAdmin} /> : null}
        {tab === 'profile' ? (
        <section className="settings-card">
          <h2>Profile</h2>
          <button
            type="button"
            className="user-menu__avatar user-menu__avatar--large"
            onClick={() => fileRef.current?.click()}
          >
            {photoDataUrl ? <img src={photoDataUrl} alt="" /> : <span>+</span>}
          </button>
          <input
            ref={fileRef}
            className="visually-hidden"
            type="file"
            accept="image/*"
            onChange={(event) => void onPhoto(event.target.files?.[0])}
          />
          <label className="welcome-field">
            <span>First name</span>
            <input
              type="text"
              value={draftName}
              onChange={(event) => {
                setDraftName(event.target.value)
                setProfileSaved('')
              }}
            />
          </label>
          <label className="welcome-field">
            <span>Email</span>
            <input
              type="email"
              value={draftEmail}
              readOnly={isSignedIn}
              onChange={(event) => {
                if (isSignedIn) return
                setDraftEmail(event.target.value)
                setProfileSaved('')
              }}
            />
          </label>
          {profileSaved ? <p className="settings-note">{profileSaved}</p> : null}
          <button
            type="button"
            className="kea-button settings-save"
            onClick={() => {
              setProfile({
                firstName: draftName.trim(),
                ...(isSignedIn ? {} : { email: draftEmail.trim() }),
              })
              setProfileSaved('Saved.')
            }}
          >
            Save
          </button>
        </section>
        ) : null}
        {tab === 'memory' ? (
        <section className="settings-card">
          <h2>Memory</h2>
          <p className="settings-note">
            Two separate lists. Learn List is language gaps. Current Chat Topics
            is conversation continuity.
          </p>
          <Link className="memory-button" to="/learn">
            Learn List
          </Link>
          <Link className="memory-button" to="/topics">
            Current Chat Topics
          </Link>
        </section>
        ) : null}
        {tab === 'notifications' ? (
        <section className="settings-card">
          <h2>Notifications</h2>
          <label className="settings-toggle">
            <input
              type="checkbox"
              checked={notifyTalk}
              onChange={(event) => setProfile({ notifyTalk: event.target.checked })}
            />
            Remind me to talk
          </label>
          <label className="settings-toggle">
            <input
              type="checkbox"
              checked={notifyMemory}
              onChange={(event) => setProfile({ notifyMemory: event.target.checked })}
            />
            Remind me of Learn List items
          </label>
        </section>
        ) : null}
        {tab === 'security' ? (
          <>
        <section className="settings-card">
          <h2>Security</h2>
          <p className="settings-note">
            Kea is meant to feel private: a conversation with a friend, not a
            product watching you. Nothing here is sold. Your account lives in
            Kea Production only.
          </p>
          <label className="settings-choice">
            <input
              type="radio"
              name="chatkeep"
              checked={chatKeep === 'device'}
              onChange={() => {
                setProfile({ chatKeep: 'device' as ChatKeep, saveTranscripts: true })
              }}
            />
            <span>
              <strong>This device</strong>
              Conversation text stays on this phone or computer.
            </span>
          </label>
          <label className="settings-choice">
            <input
              type="radio"
              name="chatkeep"
              checked={chatKeep === 'cloud'}
              onChange={() => setProfile({ chatKeep: 'cloud' as ChatKeep })}
            />
            <span>
              <strong>Kea cloud</strong>
              Profile is stored in Kea Production. Conversation text still
              follows this choice.
            </span>
          </label>
          <label className="settings-toggle">
            <input
              type="checkbox"
              checked={saveTranscripts}
              onChange={(event) =>
                setProfile({ saveTranscripts: event.target.checked })
              }
            />
            Keep conversation text on this device
          </label>
        </section>
        <section className="settings-card">
          <h2>Password</h2>
          {isSignedIn || isAdminEmail(email) ? (
            <>
              <p className="settings-note">
                {isSignedIn
                  ? 'This changes the password on your Kea account.'
                  : 'Change the admin password for this device. The first password is Tester until you replace it.'}
              </p>
              <PasswordField
                label="Current password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={setCurrentPassword}
              />
              <PasswordField
                label="New password"
                autoComplete="new-password"
                value={nextPassword}
                onChange={setNextPassword}
              />
              <PasswordField
                label="Confirm new password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={setConfirmPassword}
              />
              {passwordMessage ? (
                <p className="settings-note">{passwordMessage}</p>
              ) : null}
              <button
                type="button"
                className="kea-button settings-save"
                onClick={() => {
                  void (async () => {
                    if (nextPassword.trim().length < 6) {
                      setPasswordMessage('Use at least six characters.')
                      return
                    }
                    if (nextPassword !== confirmPassword) {
                      setPasswordMessage('The new passwords do not match.')
                      return
                    }
                    if (isSignedIn) {
                      const supabase = getSupabase()
                      if (!supabase) {
                        setPasswordMessage('Kea cloud is not configured.')
                        return
                      }
                      const { error: check } = await supabase.auth.signInWithPassword({
                        email,
                        password: currentPassword,
                      })
                      if (check) {
                        setPasswordMessage('Current password is not right.')
                        return
                      }
                      const { error } = await supabase.auth.updateUser({
                        password: nextPassword,
                      })
                      setPasswordMessage(
                        error
                          ? authMessage(error, 'Could not save the password.')
                          : 'Password saved on your Kea account.',
                      )
                    } else {
                      const ok = await changeAdminPassword(
                        currentPassword,
                        nextPassword,
                      )
                      setPasswordMessage(
                        ok
                          ? 'Password saved on this device.'
                          : 'Current password is not right.',
                      )
                      if (!ok) return
                    }
                    setCurrentPassword('')
                    setNextPassword('')
                    setConfirmPassword('')
                  })()
                }}
              >
                Save password
              </button>
            </>
          ) : (
            <p className="settings-note">
              Sign in to change the password on your Kea account.
            </p>
          )}
        </section>
          </>
        ) : null}
      </div>
    </main>
  )
}
