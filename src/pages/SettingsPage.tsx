import { useRef, useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
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
import { UsagePanel } from '../components/companion/UsagePanel'
import { KeaOptionSheet } from '../components/companion/KeaOptionSheet'
import {
  getAnswerSilenceSeconds,
  saveAnswerSilenceSeconds,
} from '../data/keaAnswerSilence'
import {
  applyAudioRouteMic,
  listAudioInputs,
  savePreferredMicId,
} from '../architecture/keaMicrophone'
import {
  isKeaMobileDevice,
  readAudioRoute,
  type KeaAudioRoute,
} from '../architecture/keaAudioRoute'
import type { ChatKeep, LanguageCode, SkyTheme } from '../types'

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
  const [draftListenIdle, setDraftListenIdle] = useState(listenIdleSeconds)
  const [draftAnswerSilence, setDraftAnswerSilence] = useState(answerSilence)
  const [listeningSaved, setListeningSaved] = useState('')
  const [draftNative, setDraftNative] = useState(nativeLanguage)
  const [draftTarget, setDraftTarget] = useState(languageCode)
  const [languagesSaved, setLanguagesSaved] = useState('')
  const [draftNotifyTalk, setDraftNotifyTalk] = useState(notifyTalk)
  const [draftNotifyMemory, setDraftNotifyMemory] = useState(notifyMemory)
  const [notificationsSaved, setNotificationsSaved] = useState('')
  const [micSheetOpen, setMicSheetOpen] = useState(false)
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
    | 'usage'
  >('choices')
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  useEffect(() => {
    const next = searchParams.get('tab')
    if (next === 'subscription') {
      navigate('/subscription', { replace: true })
      return
    }
    if (next === 'usage') setTab('usage')
  }, [searchParams, navigate])

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
  const [audioRoute, setAudioRoute] = useState<KeaAudioRoute | null>(() =>
    readAudioRoute(),
  )
  const showMobileAudioRoute = isKeaMobileDevice()

  useEffect(() => {
    setDraftListenIdle(listenIdleSeconds)
  }, [listenIdleSeconds])

  useEffect(() => {
    setDraftAnswerSilence(answerSilence)
  }, [answerSilence])

  useEffect(() => {
    setDraftNative(nativeLanguage)
    setDraftTarget(languageCode)
  }, [nativeLanguage, languageCode])

  useEffect(() => {
    setDraftNotifyTalk(notifyTalk)
    setDraftNotifyMemory(notifyMemory)
  }, [notifyTalk, notifyMemory])

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

  const micOptions = [
    { value: '', label: 'Automatic (prefer real mic)' },
    ...micDevices.map((device) => ({
      value: device.deviceId,
      label: device.label,
    })),
  ]
  const micLabel =
    micOptions.find((item) => item.value === preferredMicId)?.label ||
    'Automatic (prefer real mic)'

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
            <Link to="/admin" className="settings-tabs__admin">
              Admin
            </Link>
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
                value={draftNative ?? ''}
                onChange={(event) => {
                  const next = event.target.value as LanguageCode
                  if (!next) return
                  setDraftNative(next)
                  setLanguagesSaved('')
                  if (draftTarget === next) {
                    setDraftTarget(
                      SUPPORTED_LANGUAGES.find((item) => item.code !== next)
                        ?.code ?? null,
                    )
                  }
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
                value={draftTarget ?? ''}
                onChange={(event) => {
                  const next = event.target.value as LanguageCode
                  if (!next) return
                  setDraftTarget(next)
                  setLanguagesSaved('')
                  if (draftNative === next) {
                    setDraftNative(
                      SUPPORTED_LANGUAGES.find((item) => item.code !== next)
                        ?.code ?? null,
                    )
                  }
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
            {languagesSaved ? <p className="settings-note">{languagesSaved}</p> : null}
            <button
              type="button"
              className="kea-button settings-save"
              onClick={() => {
                if (!draftNative || !draftTarget || draftNative === draftTarget) {
                  setLanguagesSaved('Pick two different languages.')
                  return
                }
                setProfile({
                  nativeLanguage: draftNative,
                  targetLanguage: draftTarget,
                })
                setLanguagesSaved('Saved.')
              }}
            >
              Save
            </button>
          </section>
        ) : null}
        {tab === 'listening' ? (
        <section className="settings-card settings-card--listening">
          <h2>Listening</h2>
          {showMobileAudioRoute ? (
            <div className="welcome-field">
              <span>Phone speaker or headphones</span>
              <div className="audio-route-settings">
                <button
                  type="button"
                  className={`kea-button${
                    audioRoute === 'speaker' ? '' : ' kea-button--ghost'
                  }`}
                  onClick={() => {
                    void applyAudioRouteMic('speaker').then(() => {
                      setAudioRoute('speaker')
                      try {
                        setPreferredMicId(
                          localStorage.getItem('kea-preferred-mic-id') || '',
                        )
                      } catch {
                        // ignore
                      }
                    })
                  }}
                >
                  Phone speaker
                </button>
                <button
                  type="button"
                  className={`kea-button${
                    audioRoute === 'headphones' ? '' : ' kea-button--ghost'
                  }`}
                  onClick={() => {
                    void applyAudioRouteMic('headphones').then(() => {
                      setAudioRoute('headphones')
                      try {
                        setPreferredMicId(
                          localStorage.getItem('kea-preferred-mic-id') || '',
                        )
                      } catch {
                        // ignore
                      }
                    })
                  }}
                >
                  Headphones
                </button>
              </div>
              <p className="settings-note">
                Shown each time you sign in on a phone. Change it here anytime.
              </p>
            </div>
          ) : null}
          <div className="welcome-field">
            <span>Microphone for Kea</span>
            <button
              type="button"
              className="settings-picker"
              onClick={() => setMicSheetOpen(true)}
            >
              {micLabel}
            </button>
          </div>
          <label className="welcome-field">
            <span>Turn the microphone off after</span>
            <select
              value={draftListenIdle}
              onChange={(event) => {
                setDraftListenIdle(Number(event.target.value))
                setListeningSaved('')
              }}
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
              value={draftAnswerSilence}
              onChange={(event) => {
                setDraftAnswerSilence(Number(event.target.value))
                setListeningSaved('')
              }}
            >
              {[1, 2, 3, 4, 5, 6, 8, 10].map((seconds) => (
                <option key={seconds} value={seconds}>
                  {seconds} seconds of silence
                </option>
              ))}
            </select>
          </label>
          {listeningSaved ? <p className="settings-note">{listeningSaved}</p> : null}
          <button
            type="button"
            className="kea-button settings-save"
            onClick={() => {
              savePreferredMicId(preferredMicId)
              saveAnswerSilenceSeconds(draftAnswerSilence)
              setAnswerSilence(draftAnswerSilence)
              setProfile({
                listenIdleSeconds: draftListenIdle,
                answerAfterSilenceSeconds: draftAnswerSilence,
              })
              setListeningSaved('Saved.')
            }}
          >
            Save
          </button>
        </section>
        ) : null}
        {micSheetOpen ? (
          <KeaOptionSheet
            title="Microphone for Kea"
            options={micOptions}
            value={preferredMicId}
            onChange={(next) => {
              setPreferredMicId(next)
              setListeningSaved('')
            }}
            onClose={() => setMicSheetOpen(false)}
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
              checked={draftNotifyTalk}
              onChange={(event) => {
                setDraftNotifyTalk(event.target.checked)
                setNotificationsSaved('')
              }}
            />
            Remind me to talk
          </label>
          <label className="settings-toggle">
            <input
              type="checkbox"
              checked={draftNotifyMemory}
              onChange={(event) => {
                setDraftNotifyMemory(event.target.checked)
                setNotificationsSaved('')
              }}
            />
            Remind me of Learn List items
          </label>
          {notificationsSaved ? (
            <p className="settings-note">{notificationsSaved}</p>
          ) : null}
          <button
            type="button"
            className="kea-button settings-save"
            onClick={() => {
              setProfile({
                notifyTalk: draftNotifyTalk,
                notifyMemory: draftNotifyMemory,
              })
              setNotificationsSaved('Saved.')
            }}
          >
            Save
          </button>
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
