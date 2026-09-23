import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { isActiveMemoryItem } from '../architecture/vocabularyMemory'
import {
  closeAdminSession,
  isAdminEmail,
  isAdminSessionOpen,
  openAdminSession,
} from '../architecture/adminAuth'
import { isLanguageCode } from '../config/languages'
import { DEFAULT_VOICE_CHARACTER } from '../config/voices'
import { PLACEHOLDER_VOCABULARY } from '../data/placeholders'
import { requestClearTalkTranscript } from '../architecture/keaTalkMemory'
import { getSupabase, isKeaCloudConfigured } from '../lib/supabase'
import {
  fetchCloudProfile,
  upsertCloudProfile,
  markPasswordRecovery,
} from '../services/keaProfile'
import type {
  ChatKeep,
  LanguageCode,
  LearnerLevel,
  SkyTheme,
  VocabularyMemoryItem,
  VoicePersonalityId,
} from '../types'

const PROFILE_STORAGE_KEY = 'kea-profile'
const VOICE_KEY = 'kea-voice-character'

export interface StoredProfile {
  firstName: string
  email: string
  photoDataUrl: string
  nativeLanguage: LanguageCode | null
  targetLanguage: LanguageCode | null
  preferredVoice: VoicePersonalityId
  notifyMemory: boolean
  notifyTalk: boolean
  saveTranscripts: boolean
  listenIdleSeconds: number
  answerAfterSilenceSeconds: number
  skyTheme: SkyTheme
  chatKeep: ChatKeep
}

const DEFAULT_PROFILE: StoredProfile = {
  firstName: '',
  email: '',
  photoDataUrl: '',
  nativeLanguage: null,
  targetLanguage: null,
  preferredVoice: DEFAULT_VOICE_CHARACTER,
  notifyMemory: true,
  notifyTalk: true,
  saveTranscripts: true,
  listenIdleSeconds: 10,
  answerAfterSilenceSeconds: 3,
  skyTheme: 'clouds',
  chatKeep: 'device',
}

function readProfile(): StoredProfile {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY)
    if (!raw) return { ...DEFAULT_PROFILE }
    const parsed = JSON.parse(raw) as Partial<StoredProfile>
    const nativeLanguage = parsed.nativeLanguage
    const targetLanguage = parsed.targetLanguage
    const listenIdleSeconds = Number(parsed.listenIdleSeconds)
    const answerAfterSilenceSeconds = Number(parsed.answerAfterSilenceSeconds)
    const skyTheme = parsed.skyTheme === 'weather' ? 'weather' : 'clouds'
    const chatKeep = parsed.chatKeep === 'cloud' ? 'cloud' : 'device'
    const preferredVoice = parsed.preferredVoice
    return {
      ...DEFAULT_PROFILE,
      ...parsed,
      nativeLanguage:
        nativeLanguage && isLanguageCode(nativeLanguage) ? nativeLanguage : null,
      targetLanguage:
        targetLanguage && isLanguageCode(targetLanguage) ? targetLanguage : null,
      preferredVoice:
        preferredVoice === 'luna' ||
        preferredVoice === 'mira' ||
        preferredVoice === 'sage' ||
        preferredVoice === 'rowan' ||
        preferredVoice === 'theo'
          ? preferredVoice
          : DEFAULT_VOICE_CHARACTER,
      listenIdleSeconds:
        Number.isFinite(listenIdleSeconds) && listenIdleSeconds >= 3
          ? Math.min(60, Math.round(listenIdleSeconds))
          : 10,
      answerAfterSilenceSeconds:
        Number.isFinite(answerAfterSilenceSeconds) &&
        answerAfterSilenceSeconds >= 1
          ? Math.min(15, Math.round(answerAfterSilenceSeconds))
          : 5,
      skyTheme,
      chatKeep,
    }
  } catch {
    return { ...DEFAULT_PROFILE }
  }
}

function persistProfile(profile: StoredProfile) {
  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile))
    localStorage.setItem(VOICE_KEY, profile.preferredVoice)
  } catch {
    // Ignore quota / private mode.
  }
}

function vocabularyFor(code: LanguageCode | null): VocabularyMemoryItem[] {
  if (!code) return []
  return PLACEHOLDER_VOCABULARY.filter((item) => item.languageCode === code)
}

function profileComplete(profile: StoredProfile) {
  return Boolean(
    profile.firstName.trim() &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email.trim()) &&
      profile.nativeLanguage &&
      profile.targetLanguage &&
      profile.nativeLanguage !== profile.targetLanguage,
  )
}

interface SessionContextValue {
  firstName: string
  email: string
  photoDataUrl: string
  preferredVoice: VoicePersonalityId
  isAdmin: boolean
  isOnboarded: boolean
  authReady: boolean
  isSignedIn: boolean
  cloudAuth: boolean
  adminUnlocked: boolean
  unlockAdmin: () => void
  signOut: () => Promise<void>
  languageCode: LanguageCode | null
  nativeLanguage: LanguageCode | null
  setNativeLanguage: (code: LanguageCode) => void
  setLanguageCode: (code: LanguageCode) => void
  setProfile: (patch: Partial<StoredProfile>) => void
  level: LearnerLevel
  setLevel: (level: LearnerLevel) => void
  vocabulary: VocabularyMemoryItem[]
  activeVocabulary: VocabularyMemoryItem[]
  notifyMemory: boolean
  notifyTalk: boolean
  saveTranscripts: boolean
  listenIdleSeconds: number
  answerAfterSilenceSeconds: number
  skyTheme: SkyTheme
  chatKeep: ChatKeep
}

const SessionContext = createContext<SessionContextValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [profile, setProfileState] = useState<StoredProfile>(readProfile)
  const [adminUnlocked, setAdminUnlocked] = useState(isAdminSessionOpen)
  const [level, setLevel] = useState<LearnerLevel>('intermediate')
  const [vocabulary, setVocabulary] = useState<VocabularyMemoryItem[]>(() =>
    vocabularyFor(readProfile().targetLanguage),
  )
  const [authReady, setAuthReady] = useState(!isKeaCloudConfigured())
  const [userId, setUserId] = useState<string | null>(null)
  const userIdRef = useRef<string | null>(null)
  const saveTimer = useRef<number>(0)

  useEffect(() => {
    if (!userId || !isAdminEmail(profile.email)) return
    openAdminSession()
    setAdminUnlocked(true)
  }, [profile.email, userId])

  const applyCloudUser = useCallback(async (user: {
    id: string
    email?: string
    user_metadata?: Record<string, unknown>
  }) => {
    const id = user.id
    const email = user.email ?? ''
    const meta = user.user_metadata ?? {}
    const metaName = typeof meta.first_name === 'string' ? meta.first_name : ''
    const metaNative =
      typeof meta.native_language === 'string' && isLanguageCode(meta.native_language)
        ? meta.native_language
        : null
    const metaTarget =
      typeof meta.target_language === 'string' && isLanguageCode(meta.target_language)
        ? meta.target_language
        : null
    userIdRef.current = id
    setUserId(id)
    let cloud = null
    try {
      cloud = await fetchCloudProfile(id)
    } catch {
      cloud = null
    }
    setProfileState((current) => {
      const next: StoredProfile = {
        ...current,
        email,
        firstName: cloud?.firstName || metaName || current.firstName,
        photoDataUrl: cloud?.avatarUrl || current.photoDataUrl,
        nativeLanguage:
          cloud?.nativeLanguage || metaNative || current.nativeLanguage,
        targetLanguage:
          cloud?.targetLanguage || metaTarget || current.targetLanguage,
        preferredVoice: cloud?.preferredVoice ?? current.preferredVoice,
        listenIdleSeconds: cloud?.listenIdleSeconds ?? current.listenIdleSeconds,
        skyTheme: cloud?.skyTheme ?? current.skyTheme,
        chatKeep: cloud?.chatKeep ?? current.chatKeep,
        notifyMemory: cloud?.notifyMemory ?? current.notifyMemory,
        notifyTalk: cloud?.notifyTalk ?? current.notifyTalk,
        saveTranscripts: cloud?.saveTranscripts ?? current.saveTranscripts,
      }
      persistProfile(next)
      setVocabulary(vocabularyFor(next.targetLanguage))
      if (
        (!cloud?.nativeLanguage || !cloud?.targetLanguage) &&
        (next.nativeLanguage || next.targetLanguage)
      ) {
        void upsertCloudProfile(id, {
          firstName: next.firstName,
          nativeLanguage: next.nativeLanguage,
          targetLanguage: next.targetLanguage,
        })
      }
      return next
    })
  }, [])

  useEffect(() => {
    const supabase = getSupabase()
    if (!supabase) {
      setAuthReady(true)
      return
    }

    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      const session = data.session
      if (session?.user) {
        void applyCloudUser(session.user)
      }
      setAuthReady(true)
    })

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        markPasswordRecovery()
        window.dispatchEvent(new Event('kea-password-recovery'))
      }
      if (!session?.user) {
        userIdRef.current = null
        setUserId(null)
        return
      }
      void applyCloudUser(session.user)
    })

    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [applyCloudUser])

  function setProfile(patch: Partial<StoredProfile>) {
    setProfileState((current) => {
      const next = { ...current, ...patch }
      persistProfile(next)
      if (patch.targetLanguage) {
        setVocabulary(vocabularyFor(patch.targetLanguage))
      }
      const id = userIdRef.current
      if (id && isKeaCloudConfigured()) {
        window.clearTimeout(saveTimer.current)
        saveTimer.current = window.setTimeout(() => {
          void upsertCloudProfile(id, {
            firstName: next.firstName,
            nativeLanguage: next.nativeLanguage,
            targetLanguage: next.targetLanguage,
            preferredVoice: next.preferredVoice,
            avatarUrl: next.photoDataUrl,
            listenIdleSeconds: next.listenIdleSeconds,
            skyTheme: next.skyTheme,
            chatKeep: next.chatKeep,
            notifyMemory: next.notifyMemory,
            notifyTalk: next.notifyTalk,
            saveTranscripts: next.saveTranscripts,
          })
        }, 400)
      }
      return next
    })
  }

  function setLanguageCode(code: LanguageCode) {
    setProfile({ targetLanguage: code })
  }

  function setNativeLanguage(code: LanguageCode) {
    setProfile({ nativeLanguage: code })
  }

  function unlockAdmin() {
    setAdminUnlocked(true)
  }

  async function signOut() {
    window.clearTimeout(saveTimer.current)
    await getSupabase()?.auth.signOut()
    closeAdminSession()
    setAdminUnlocked(false)
    userIdRef.current = null
    setUserId(null)
    const empty = { ...DEFAULT_PROFILE }
    persistProfile(empty)
    setProfileState(empty)
    setVocabulary([])
    requestClearTalkTranscript()
  }

  const emailIsAdmin = isAdminEmail(profile.email)
  const cloudAuth = isKeaCloudConfigured()
  const isSignedIn = Boolean(userId)
  const isAdmin = isSignedIn && emailIsAdmin
  const isOnboarded = cloudAuth
    ? isSignedIn && profileComplete(profile)
    : profileComplete(profile)

  const activeVocabulary = useMemo(
    () => vocabulary.filter(isActiveMemoryItem),
    [vocabulary],
  )

  const value = useMemo(
    () => ({
      firstName: profile.firstName,
      email: profile.email,
      photoDataUrl: profile.photoDataUrl,
      preferredVoice: profile.preferredVoice,
      isAdmin,
      adminUnlocked,
      unlockAdmin,
      signOut,
      authReady,
      isSignedIn,
      cloudAuth,
      isOnboarded,
      languageCode: profile.targetLanguage,
      nativeLanguage: profile.nativeLanguage,
      setNativeLanguage,
      setLanguageCode,
      setProfile,
      level,
      setLevel,
      vocabulary,
      activeVocabulary,
      notifyMemory: profile.notifyMemory,
      notifyTalk: profile.notifyTalk,
      saveTranscripts: profile.saveTranscripts,
      listenIdleSeconds: profile.listenIdleSeconds,
      answerAfterSilenceSeconds: profile.answerAfterSilenceSeconds,
      skyTheme: profile.skyTheme,
      chatKeep: profile.chatKeep,
    }),
    [
      activeVocabulary,
      adminUnlocked,
      authReady,
      cloudAuth,
      isAdmin,
      isOnboarded,
      isSignedIn,
      level,
      profile,
      vocabulary,
    ],
  )

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  )
}

export function useSession() {
  const context = useContext(SessionContext)
  if (!context) {
    throw new Error('useSession must be used within SessionProvider')
  }
  return context
}
