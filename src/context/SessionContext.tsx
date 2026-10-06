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
import {
  DEFAULT_LISTEN_IDLE_SECONDS,
  normalizeListenIdleSeconds,
} from '../data/keaListenIdle'
import {
  DEFAULT_ANSWER_SILENCE_SECONDS,
  getAnswerSilenceSeconds,
} from '../data/keaAnswerSilence'
import {
  DEFAULT_ADMIN_SESSION_TIMEOUT_MINUTES,
  DEFAULT_SESSION_TIMEOUT_MINUTES,
  defaultSessionTimeoutMinutes,
  isSessionTimeoutNever,
  normalizeSessionTimeoutMinutes,
  SESSION_TIMEOUT_NEVER,
} from '../data/keaSessionTimeout'
import {
  clearSpokenTourPending,
} from '../data/keaOnboarding'
import { getSupabase, isKeaCloudConfigured } from '../lib/supabase'
import {
  fetchCloudProfile,
  upsertCloudProfile,
  markPasswordRecovery,
} from '../services/keaProfile'
import {
  getLearnList,
  mergeCloudLearnItems,
  setLearnCloudPush,
} from '../architecture/companionMemory'
import { pullCloudLearnList, pushCloudLearnList } from '../services/keaLearnCloud'
import {
  pullCloudDailyStats,
  pushCloudDailyStats,
  upsertCloudDailyStat,
} from '../services/keaPerformanceCloud'
import {
  ensureAdminDemoPerformance,
  exportAllDayStats,
  mergeCloudDayStats,
  setDailyStatsCloudPush,
} from '../architecture/keaTalkPerformance'
import { applyCloudSubscription } from '../architecture/keaBilling'
import {
  learnerLevelToSession,
  loadLegacyLearnerAnswers,
  setActiveLearnerAnswers,
  type LearnerAnswers,
} from '../data/keaLearnerProfile'
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
  lastName: string
  email: string
  photoDataUrl: string
  nativeLanguage: LanguageCode | null
  targetLanguage: LanguageCode | null
  preferredVoice: VoicePersonalityId
  notifyMemory: boolean
  notifyTalk: boolean
  saveTranscripts: boolean
  listenIdleSeconds: number
  sessionTimeoutMinutes: number
  answerAfterSilenceSeconds: number
  skyTheme: SkyTheme
  chatKeep: ChatKeep
}

const DEFAULT_PROFILE: StoredProfile = {
  firstName: '',
  lastName: '',
  email: '',
  photoDataUrl: '',
  nativeLanguage: null,
  targetLanguage: null,
  preferredVoice: DEFAULT_VOICE_CHARACTER,
  notifyMemory: true,
  notifyTalk: true,
  saveTranscripts: true,
  listenIdleSeconds: DEFAULT_LISTEN_IDLE_SECONDS,
  sessionTimeoutMinutes: DEFAULT_SESSION_TIMEOUT_MINUTES,
  answerAfterSilenceSeconds: DEFAULT_ANSWER_SILENCE_SECONDS,
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
    const sessionTimeoutMinutes = Number(parsed.sessionTimeoutMinutes)
    const answerAfterSilenceSeconds = Number(parsed.answerAfterSilenceSeconds)
    const skyTheme =
      parsed.skyTheme === 'weather' || parsed.skyTheme === 'night'
        ? parsed.skyTheme
        : 'clouds'
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
      listenIdleSeconds: normalizeListenIdleSeconds(listenIdleSeconds),
      sessionTimeoutMinutes: normalizeSessionTimeoutMinutes(
        sessionTimeoutMinutes,
        defaultSessionTimeoutMinutes(isAdminEmail(String(parsed.email ?? ''))),
      ),
      answerAfterSilenceSeconds: (() => {
        const migrated = getAnswerSilenceSeconds()
        if (
          Number.isFinite(answerAfterSilenceSeconds) &&
          answerAfterSilenceSeconds >= 0.5
        ) {
          const n = Math.min(15, Math.round(answerAfterSilenceSeconds * 2) / 2)
          // One-time bump: waits under 6s were cutting in mid-thought.
          // After that, a settings choice (faster or slower) is kept.
          if (n < DEFAULT_ANSWER_SILENCE_SECONDS && migrated === DEFAULT_ANSWER_SILENCE_SECONDS) {
            return DEFAULT_ANSWER_SILENCE_SECONDS
          }
          return n
        }
        return migrated
      })(),
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
  lastName: string
  email: string
  photoDataUrl: string
  preferredVoice: VoicePersonalityId
  userId: string | null
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
  flushCloudProfile: () => Promise<void>
  level: LearnerLevel
  setLevel: (level: LearnerLevel) => void
  vocabulary: VocabularyMemoryItem[]
  activeVocabulary: VocabularyMemoryItem[]
  notifyMemory: boolean
  notifyTalk: boolean
  saveTranscripts: boolean
  listenIdleSeconds: number
  sessionTimeoutMinutes: number
  answerAfterSilenceSeconds: number
  skyTheme: SkyTheme
  chatKeep: ChatKeep
  learnerAnswers: LearnerAnswers | null | undefined
  saveLearnerProfile: (answers: LearnerAnswers) => Promise<void>
}

const SessionContext = createContext<SessionContextValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [profile, setProfileState] = useState<StoredProfile>(readProfile)
  const [adminUnlocked, setAdminUnlocked] = useState(isAdminSessionOpen)
  const [level, setLevel] = useState<LearnerLevel>('intermediate')
  const [learnerAnswers, setLearnerAnswers] = useState<
    LearnerAnswers | null | undefined
  >(isKeaCloudConfigured() ? undefined : null)
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

  useEffect(() => {
    if (!userId || !isAdminEmail(profile.email)) return
    // One-time: admin idle logout default is Never (was 30 minutes).
    try {
      const flag = 'kea-admin-logout-never-default-v1'
      if (localStorage.getItem(flag) === '1') return
      localStorage.setItem(flag, '1')
      setProfileState((current) => {
        if (current.sessionTimeoutMinutes === SESSION_TIMEOUT_NEVER) return current
        const next = {
          ...current,
          sessionTimeoutMinutes: DEFAULT_ADMIN_SESSION_TIMEOUT_MINUTES,
        }
        persistProfile(next)
        return next
      })
    } catch {
      // ignore
    }
  }, [profile.email, userId])

  useEffect(() => {
    if (!userId || !isKeaCloudConfigured()) {
      setLearnCloudPush(null)
      setDailyStatsCloudPush(null)
      return
    }
    let cancelled = false
    let timer = 0
    let statsTimer = 0
    void pullCloudLearnList(userId).then((rows) => {
      if (cancelled) return
      if (rows.length) mergeCloudLearnItems(rows)
      void pushCloudLearnList(userId, getLearnList())
      setLearnCloudPush((items) => {
        window.clearTimeout(timer)
        timer = window.setTimeout(() => {
          void pushCloudLearnList(userId, items)
        }, 500)
      })
    })
    void pullCloudDailyStats(userId).then((rows) => {
      if (cancelled) return
      if (rows.length) mergeCloudDayStats(rows)
      if (isAdminEmail(profile.email)) ensureAdminDemoPerformance()
      void pushCloudDailyStats(userId, exportAllDayStats())
      setDailyStatsCloudPush((row) => {
        window.clearTimeout(statsTimer)
        statsTimer = window.setTimeout(() => {
          void upsertCloudDailyStat(userId, {
            day: row.day,
            talkSeconds: row.talkSeconds,
            wordsAdded: row.wordsAdded,
            wordsRemoved: row.wordsRemoved,
          })
        }, 400)
      })
    })
    return () => {
      cancelled = true
      window.clearTimeout(timer)
      window.clearTimeout(statsTimer)
      setLearnCloudPush(null)
      setDailyStatsCloudPush(null)
    }
  }, [userId, profile.email])

  useEffect(() => {
    if (!isAdminEmail(profile.email)) return
    ensureAdminDemoPerformance()
  }, [profile.email])

  const applyCloudUser = useCallback(async (user: {
    id: string
    email?: string
    user_metadata?: Record<string, unknown>
  }) => {
    const id = user.id
    const email = user.email ?? ''
    const meta = user.user_metadata ?? {}
    const metaName = typeof meta.first_name === 'string' ? meta.first_name : ''
    const metaLast = typeof meta.last_name === 'string' ? meta.last_name : ''
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
    if (cloud) {
      applyCloudSubscription({
        planId: cloud.subscriptionPlanId,
        status: cloud.subscriptionStatus,
        customerId: cloud.stripeCustomerId,
        subscriptionId: cloud.stripeSubscriptionId,
        currentPeriodEnd: cloud.subscriptionCurrentPeriodEnd,
      })
    }
    setProfileState((current) => {
      const next: StoredProfile = {
        ...current,
        email,
        firstName: cloud?.firstName || metaName || current.firstName,
        lastName: metaLast || current.lastName,
        photoDataUrl: cloud?.avatarUrl || current.photoDataUrl,
        nativeLanguage:
          cloud?.nativeLanguage || metaNative || current.nativeLanguage,
        targetLanguage:
          cloud?.targetLanguage || metaTarget || current.targetLanguage,
        preferredVoice: cloud?.preferredVoice ?? current.preferredVoice,
        listenIdleSeconds: normalizeListenIdleSeconds(
          cloud?.listenIdleSeconds ?? current.listenIdleSeconds,
        ),
        skyTheme: cloud?.skyTheme ?? current.skyTheme,
        chatKeep: cloud?.chatKeep ?? current.chatKeep,
        notifyMemory: cloud?.notifyMemory ?? current.notifyMemory,
        notifyTalk: cloud?.notifyTalk ?? current.notifyTalk,
        saveTranscripts: cloud?.saveTranscripts ?? current.saveTranscripts,
      }
      persistProfile(next)
      const fromCloud = cloud?.learnerProfile ?? null
      const legacy = fromCloud ? null : loadLegacyLearnerAnswers(email)
      const answers = fromCloud ?? legacy
      setLearnerAnswers(answers)
      setActiveLearnerAnswers(answers)
      if (answers) setLevel(learnerLevelToSession(answers.level))
      if (!fromCloud && legacy) {
        void upsertCloudProfile(id, { learnerProfile: legacy })
      }
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
      setLearnerAnswers(null)
      setActiveLearnerAnswers(null)
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
      // Do not clear chat or audio check here — SIGNED_IN also fires on session
      // restore / token refresh. AuthPanel marks a fresh screen on explicit login
      // (a new browser visit already starts blank via sessionStorage).
      if (!session?.user) {
        userIdRef.current = null
        setUserId(null)
        setLearnerAnswers(null)
        setActiveLearnerAnswers(null)
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
      if (patch.listenIdleSeconds !== undefined) {
        next.listenIdleSeconds = normalizeListenIdleSeconds(patch.listenIdleSeconds)
      }
      if (patch.answerAfterSilenceSeconds !== undefined) {
        const n = Number(patch.answerAfterSilenceSeconds)
        next.answerAfterSilenceSeconds =
          Number.isFinite(n) && n >= 0.5
            ? Math.min(15, Math.round(n * 2) / 2)
            : DEFAULT_ANSWER_SILENCE_SECONDS
      }
      if (patch.sessionTimeoutMinutes !== undefined) {
        next.sessionTimeoutMinutes = normalizeSessionTimeoutMinutes(
          patch.sessionTimeoutMinutes,
          defaultSessionTimeoutMinutes(isAdminEmail(next.email)),
        )
      }
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

  const flushCloudProfile = useCallback(async () => {
    window.clearTimeout(saveTimer.current)
    const id = userIdRef.current
    if (!id || !isKeaCloudConfigured()) return
    const next = readProfile()
    await upsertCloudProfile(id, {
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
  }, [])

  async function saveLearnerProfile(answers: LearnerAnswers) {
    const id = userIdRef.current
    if (!id || !isKeaCloudConfigured()) {
      throw new Error('Sign in again so Kea can save your answers.')
    }
    await upsertCloudProfile(id, { learnerProfile: answers })
    setLearnerAnswers(answers)
    setActiveLearnerAnswers(answers)
    setLevel(learnerLevelToSession(answers.level))
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
    const leavingKey =
      (profile.email || '').trim().toLowerCase() ||
      (profile.firstName || '').trim().toLowerCase()
    clearSpokenTourPending(leavingKey)
    await getSupabase()?.auth.signOut()
    closeAdminSession()
    setAdminUnlocked(false)
    userIdRef.current = null
    setUserId(null)
    const empty = { ...DEFAULT_PROFILE }
    persistProfile(empty)
    setProfileState(empty)
    setVocabulary([])
    setLearnerAnswers(null)
    setActiveLearnerAnswers(null)
    // Keep talk transcript so the chat is still there after they sign back in.
  }

  useEffect(() => {
    if (!userId) return
    const minutes = normalizeSessionTimeoutMinutes(profile.sessionTimeoutMinutes)
    if (isSessionTimeoutNever(minutes)) return

    const idleMs = minutes * 60 * 1000
    let timer = window.setTimeout(() => {
      void signOut()
    }, idleMs)

    const bump = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        void signOut()
      }, idleMs)
    }

    const onActivity = () => bump()
    const onVisible = () => {
      if (document.visibilityState === 'visible') bump()
    }
    const events: Array<keyof WindowEventMap> = [
      'pointerdown',
      'keydown',
      'touchstart',
      'mousemove',
      'scroll',
      'wheel',
    ]
    for (const name of events) {
      window.addEventListener(name, onActivity, { passive: true })
    }
    window.addEventListener('kea-user-activity', onActivity)
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      window.clearTimeout(timer)
      for (const name of events) {
        window.removeEventListener(name, onActivity)
      }
      window.removeEventListener('kea-user-activity', onActivity)
      document.removeEventListener('visibilitychange', onVisible)
    }
    // signOut is stable enough for idle logout; re-bind when user signs in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, profile.sessionTimeoutMinutes])

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
      lastName: profile.lastName,
      email: profile.email,
      photoDataUrl: profile.photoDataUrl,
      preferredVoice: profile.preferredVoice,
      userId,
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
      flushCloudProfile,
      level,
      setLevel,
      vocabulary,
      activeVocabulary,
      notifyMemory: profile.notifyMemory,
      notifyTalk: profile.notifyTalk,
      saveTranscripts: profile.saveTranscripts,
      listenIdleSeconds: profile.listenIdleSeconds,
      sessionTimeoutMinutes: profile.sessionTimeoutMinutes,
      answerAfterSilenceSeconds: profile.answerAfterSilenceSeconds,
      skyTheme: profile.skyTheme,
      chatKeep: profile.chatKeep,
      learnerAnswers,
      saveLearnerProfile,
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
      learnerAnswers,
      userId,
      vocabulary,
      flushCloudProfile,
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
