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
import { KeaOptionSheet } from '../components/companion/KeaOptionSheet'
import { ProfileFace } from '../components/companion/ProfileFace'
import { RussianScriptPopup } from '../components/companion/RussianScriptPopup'
import {
  holdTalkForLanguageChange,
  requestClearTalkAndSoftReset,
} from '../architecture/keaTalkMemory'
import {
  pairIncludesRussian,
  saveRussianScript,
  type RussianScript,
} from '../architecture/russianScript'
import {
  DEFAULT_ANSWER_SILENCE_SECONDS,
  getAnswerSilenceSeconds,
  saveAnswerSilenceSeconds,
} from '../data/keaAnswerSilence'
import {
  DEFAULT_LISTEN_IDLE_SECONDS,
  LISTEN_IDLE_MINUTE_OPTIONS,
  listenIdleLabel,
  normalizeListenIdleSeconds,
} from '../data/keaListenIdle'
import {
  SESSION_TIMEOUT_MINUTE_OPTIONS,
  defaultSessionTimeoutMinutes,
  sessionTimeoutLabel,
} from '../data/keaSessionTimeout'
import {
  applyAudioRouteMic,
  listAudioInputs,
  savePreferredMicId,
} from '../architecture/keaMicrophone'
import {
  audioRouteLabel,
  probeAudioEnvironment,
  readAudioRoute,
  type KeaAudioEnvironment,
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
    lastName,
    email,
    photoDataUrl,
    isAdmin,
    isSignedIn,
    nativeLanguage,
    languageCode,
    setProfile,
    flushCloudProfile,
    notifyMemory,
    notifyTalk,
    saveTranscripts,
    listenIdleSeconds,
    sessionTimeoutMinutes,
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
  const [languageScriptOpen, setLanguageScriptOpen] = useState(false)
  const [draftNotifyTalk, setDraftNotifyTalk] = useState(notifyTalk)
  const [draftNotifyMemory, setDraftNotifyMemory] = useState(notifyMemory)
  const [notificationsSaved, setNotificationsSaved] = useState('')
  const [micSheetOpen, setMicSheetOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const cameraVideoRef = useRef<HTMLVideoElement>(null)
  const cameraStreamRef = useRef<MediaStream | null>(null)
  const [currentPassword, setCurrentPassword] = useState('')
  const [nextPassword, setNextPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordMessage, setPasswordMessage] = useState('')
  const [profileSaved, setProfileSaved] = useState('')
  const [draftName, setDraftName] = useState(firstName)
  const [draftLastName, setDraftLastName] = useState(lastName)
  const [draftEmail, setDraftEmail] = useState(email)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [tab, setTab] = useState<
    | 'choices'
    | 'languages'
    | 'listening'
    | 'notifications'
    | 'profile'
    | 'security'
  >('choices')
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  useEffect(() => {
    const next = searchParams.get('tab')
    if (next === 'subscription') {
      navigate('/subscription', { replace: true })
      return
    }
    if (next === 'performance') {
      navigate('/performance', { replace: true })
      return
    }
    if (next === 'usage') {
      navigate('/usage', { replace: true })
    }
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
  const [audioEnvironment, setAudioEnvironment] =
    useState<KeaAudioEnvironment | null>(null)
  const [audioRoute, setAudioRoute] = useState<KeaAudioRoute | null>(() =>
    readAudioRoute(),
  )
  const [audioRefreshBusy, setAudioRefreshBusy] = useState(false)

  async function refreshAudioEnvironment() {
    setAudioRefreshBusy(true)
    try {
      const next = await probeAudioEnvironment()
      setAudioEnvironment(next)
      setAudioRoute(readAudioRoute() ?? next.route)
    } catch {
      setAudioEnvironment(null)
    } finally {
      setAudioRefreshBusy(false)
    }
  }

  async function chooseAudioRoute(route: KeaAudioRoute) {
    setAudioRefreshBusy(true)
    try {
      await applyAudioRouteMic(route)
      setAudioRoute(route)
      try {
        setPreferredMicId(localStorage.getItem('kea-preferred-mic-id') || '')
      } catch {
        // ignore
      }
      const next = await probeAudioEnvironment()
      setAudioEnvironment(next)
      setListeningSaved(
        route === 'bluetooth'
          ? 'Connected to Bluetooth when available.'
          : 'Audio preference saved.',
      )
    } catch {
      setListeningSaved('Could not apply that audio choice.')
    } finally {
      setAudioRefreshBusy(false)
    }
  }

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
    const storedFirst = firstName.trim()
    const storedLast = lastName.trim()
    if (storedLast) {
      setDraftName(storedFirst)
      setDraftLastName(storedLast)
    } else {
      const space = storedFirst.indexOf(' ')
      if (space > 0) {
        setDraftName(storedFirst.slice(0, space))
        setDraftLastName(storedFirst.slice(space + 1).trim())
      } else {
        setDraftName(storedFirst)
        setDraftLastName('')
      }
    }
    setDraftEmail(email)
  }, [email, firstName, lastName])

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
      if (!cancelled) void refreshAudioEnvironment()
    })()

    function onDeviceChange() {
      if (!cancelled) void refreshAudioEnvironment()
    }
    navigator.mediaDevices?.addEventListener?.('devicechange', onDeviceChange)

    return () => {
      cancelled = true
      navigator.mediaDevices?.removeEventListener?.(
        'devicechange',
        onDeviceChange,
      )
    }
    // refreshAudioEnvironment is stable enough for this tab open probe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  function stopCamera() {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop())
    cameraStreamRef.current = null
    if (cameraVideoRef.current) cameraVideoRef.current.srcObject = null
    setCameraOpen(false)
  }

  async function onPhoto(file: File | undefined) {
    if (!file) return
    try {
      const nextPhoto = await readPhoto(file)
      setProfile({ photoDataUrl: nextPhoto })
      setProfileSaved('Photo saved.')
    } catch {
      setProfileSaved('Could not use that photo.')
    }
  }

  async function openCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      cameraInputRef.current?.click()
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } },
      })
      cameraStreamRef.current = stream
      setCameraOpen(true)
    } catch {
      cameraInputRef.current?.click()
    }
  }

  function useCameraPhoto() {
    const video = cameraVideoRef.current
    if (!video || video.videoWidth < 2) return
    const canvas = document.createElement('canvas')
    const size = 256
    canvas.width = size
    canvas.height = size
    const context = canvas.getContext('2d')
    if (!context) return
    const scale = Math.max(size / video.videoWidth, size / video.videoHeight)
    const width = video.videoWidth * scale
    const height = video.videoHeight * scale
    context.drawImage(video, (size - width) / 2, (size - height) / 2, width, height)
    setProfile({ photoDataUrl: canvas.toDataURL('image/jpeg', 0.82) })
    setProfileSaved('Photo saved.')
    stopCamera()
  }

  useEffect(() => {
    return () => {
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop())
      cameraStreamRef.current = null
    }
  }, [])

  useEffect(() => {
    const video = cameraVideoRef.current
    const stream = cameraStreamRef.current
    if (!cameraOpen || !video || !stream) return
    video.srcObject = stream
    void video.play().catch(() => {})
  }, [cameraOpen])

  async function saveProfile() {
    const nextFirst = draftName.trim()
    const nextLast = draftLastName.trim()
    setProfile({
      firstName: nextFirst,
      lastName: nextLast,
      ...(isSignedIn ? {} : { email: draftEmail.trim() }),
    })
    if (isSignedIn) {
      const supabase = getSupabase()
      const { error } = supabase
        ? await supabase.auth.updateUser({
            data: { first_name: nextFirst, last_name: nextLast },
          })
        : { error: null }
      if (error) {
        setProfileSaved(authMessage(error, 'Could not save your name.'))
        return
      }
    }
    setProfileSaved('Saved.')
  }

  return (
    <main
      className={`companion-screen settings-screen${
        isAdmin && skyTheme === 'night' ? ' settings-screen--night' : ''
      }`}
    >
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
              ['listening', 'Sound'],
              ['notifications', 'Notifications'],
              ['profile', 'Profile'],
              ['security', 'Security'],
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
          <h2>Themes</h2>
          <p className="settings-note">
            Admin only while we test night viewing. Everyone else stays in the
            clouds.
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
              Soft daytime colour through the sky.
            </span>
          </label>
          <label className="settings-choice">
            <input
              type="radio"
              name="sky"
              checked={skyTheme === 'night'}
              onChange={() => setProfile({ skyTheme: 'night' as SkyTheme })}
            />
            <span>
              <strong>Night bird</strong>
              Warm, dim dark for the phone after lights out. Less blue light,
              easier on tired eyes.
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
              No voices are enabled yet. An admin can turn some on in Manage Kea.
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
                if (
                  draftNative === nativeLanguage &&
                  draftTarget === languageCode
                ) {
                  setLanguagesSaved('Saved.')
                  return
                }
                if (pairIncludesRussian(draftNative, draftTarget)) {
                  setLanguageScriptOpen(true)
                  return
                }
                void (async () => {
                  holdTalkForLanguageChange()
                  setProfile({
                    nativeLanguage: draftNative,
                    targetLanguage: draftTarget,
                  })
                  try {
                    await flushCloudProfile()
                  } catch {
                    // Local profile is already saved.
                  }
                  requestClearTalkAndSoftReset()
                })()
              }}
            >
              Save
            </button>
            {languageScriptOpen ? (
              <RussianScriptPopup
                onChoose={(script: RussianScript) => {
                  saveRussianScript(script)
                  setLanguageScriptOpen(false)
                  void (async () => {
                    holdTalkForLanguageChange()
                    setProfile({
                      nativeLanguage: draftNative,
                      targetLanguage: draftTarget,
                    })
                    try {
                      await flushCloudProfile()
                    } catch {
                      // Local profile is already saved.
                    }
                    requestClearTalkAndSoftReset()
                  })()
                }}
              />
            ) : null}
          </section>
        ) : null}
        {tab === 'listening' ? (
        <section className="settings-card settings-card--listening">
          <h2>Sound</h2>
          <h3 className="settings-sound__heading">Input</h3>
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
            <span>Stay live on chat for</span>
            <select
              value={normalizeListenIdleSeconds(draftListenIdle)}
              onChange={(event) => {
                setDraftListenIdle(Number(event.target.value))
                setListeningSaved('')
              }}
            >
              {LISTEN_IDLE_MINUTE_OPTIONS.map((minutes) => {
                const seconds = minutes * 60
                return (
                  <option key={seconds} value={seconds}>
                    {listenIdleLabel(seconds)}
                    {seconds === DEFAULT_LISTEN_IDLE_SECONDS ? ' (default)' : ''}
                  </option>
                )
              })}
            </select>
          </label>
          <p className="settings-note">
            Starts when you open the chat page and refreshes whenever you talk
            (or Kea answers). Menus pause the mic until you close them.
          </p>
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
                  {seconds === DEFAULT_ANSWER_SILENCE_SECONDS ? ' (default)' : ''}
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
                listenIdleSeconds: normalizeListenIdleSeconds(draftListenIdle),
                answerAfterSilenceSeconds: draftAnswerSilence,
              })
              setDraftListenIdle(normalizeListenIdleSeconds(draftListenIdle))
              setListeningSaved('Saved.')
            }}
          >
            Save
          </button>
          <h3 className="settings-sound__heading">Output</h3>
          <div className="welcome-field">
            <span>Where Kea should talk and listen</span>
            <div className="audio-route-settings">
              <button
                type="button"
                className={`kea-button${
                  audioRoute === 'speaker' ? '' : ' kea-button--ghost'
                }`}
                disabled={audioRefreshBusy}
                onClick={() => void chooseAudioRoute('speaker')}
              >
                Phone speaker
              </button>
              <button
                type="button"
                className={`kea-button${
                  audioRoute === 'headphones' ? '' : ' kea-button--ghost'
                }`}
                disabled={audioRefreshBusy}
                onClick={() => void chooseAudioRoute('headphones')}
              >
                Headphones
              </button>
              <button
                type="button"
                className={`kea-button${
                  audioRoute === 'bluetooth' ? '' : ' kea-button--ghost'
                }`}
                disabled={audioRefreshBusy}
                onClick={() => void chooseAudioRoute('bluetooth')}
              >
                {audioEnvironment?.bluetoothConnected
                  ? 'Connect Bluetooth / car'
                  : 'Connect Bluetooth'}
              </button>
            </div>
            <p className="audio-route-status__summary">
              {audioRoute
                ? audioRouteLabel(audioRoute)
                : audioEnvironment
                  ? audioEnvironment.summary
                  : audioRouteLabel(null)}
            </p>
            {audioEnvironment ? (
              <p className="settings-note">{audioEnvironment.detail}</p>
            ) : (
              <p className="settings-note">
                Pick speaker, headphones, or Bluetooth/car. Kea uses the matching
                microphone when the phone lists one.
              </p>
            )}
            {audioEnvironment?.bluetoothConnected ? (
              <p className="settings-note">
                Bluetooth audio is listed on this phone
                {audioEnvironment.devices.find((d) => d.role === 'bluetooth' && d.label)
                  ? ` · ${
                      audioEnvironment.devices.find(
                        (d) => d.role === 'bluetooth' && d.label,
                      )?.label
                    }`
                  : ''}
                . Tap Connect Bluetooth / car above to use it.
              </p>
            ) : null}
            <button
              type="button"
              className="kea-button kea-button--ghost"
              disabled={audioRefreshBusy}
              onClick={() => void refreshAudioEnvironment()}
            >
              {audioRefreshBusy ? 'Reading…' : 'Refresh devices'}
            </button>
          </div>
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
        {tab === 'profile' ? (
        <section className="settings-card">
          <h2>Profile</h2>
          <button
            type="button"
            className="user-menu__avatar user-menu__avatar--large"
            onClick={() => void openCamera()}
            aria-label="Take a profile photo"
          >
            <ProfileFace
              photoDataUrl={photoDataUrl}
              firstName={draftName}
              lastName={draftLastName}
            />
          </button>
          <div className="settings-photo-actions">
            <button type="button" className="kea-button" onClick={() => void openCamera()}>
              Take photo
            </button>
            <button
              type="button"
              className="kea-button"
              onClick={() => fileRef.current?.click()}
            >
              Choose photo
            </button>
          </div>
          {cameraOpen ? (
            <div className="settings-camera">
              <video ref={cameraVideoRef} autoPlay playsInline muted />
              <div className="settings-photo-actions">
                <button type="button" className="kea-button" onClick={useCameraPhoto}>
                  Use this photo
                </button>
                <button type="button" className="kea-button" onClick={stopCamera}>
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
          <input
            ref={fileRef}
            className="visually-hidden"
            type="file"
            accept="image/*"
            onChange={(event) => {
              void onPhoto(event.target.files?.[0])
              event.target.value = ''
            }}
          />
          <input
            ref={cameraInputRef}
            className="visually-hidden"
            type="file"
            accept="image/*"
            capture="user"
            onChange={(event) => {
              void onPhoto(event.target.files?.[0])
              event.target.value = ''
            }}
          />
          <label className="welcome-field">
            <span>First name</span>
            <input
              type="text"
              autoComplete="given-name"
              value={draftName}
              onChange={(event) => {
                setDraftName(event.target.value)
                setProfileSaved('')
              }}
            />
          </label>
          <label className="welcome-field">
            <span>Last name</span>
            <input
              type="text"
              autoComplete="family-name"
              value={draftLastName}
              onChange={(event) => {
                setDraftLastName(event.target.value)
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
            onClick={() => void saveProfile()}
          >
            Save
          </button>
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
          <label className="welcome-field">
            <span>Stay signed in for</span>
            <select
              value={sessionTimeoutMinutes}
              onChange={(event) => {
                setProfile({ sessionTimeoutMinutes: Number(event.target.value) })
              }}
            >
              {SESSION_TIMEOUT_MINUTE_OPTIONS.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {sessionTimeoutLabel(minutes)}
                  {minutes === defaultSessionTimeoutMinutes(isAdmin)
                    ? ' (default)'
                    : ''}
                </option>
              ))}
            </select>
          </label>
          <p className="settings-note">
            After this long with no taps, speech, or scrolling, Kea signs out.
            Choose Never to stay signed in until you sign out yourself. A live
            conversation keeps you signed in. Default is{' '}
            {sessionTimeoutLabel(defaultSessionTimeoutMinutes(isAdmin))}.
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
