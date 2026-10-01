import { getLearnMasteryUses } from './keaLearnMastery'
import { clearFirstMeetGreetingDone } from '../architecture/keaStartSpeech'

const STORAGE_KEY = 'kea-onboarding-steps-v1'
const DONE_KEY = 'kea-spoken-onboarding-done-v1'
export const ONBOARDING_CHANGED = 'kea-onboarding-changed'

export interface OnboardingStep {
  id: string
  /** Short admin label */
  title: string
  /** What Kea says for this feature. */
  spoken: string
}

export const DEFAULT_ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'conversation',
    title: 'Conversational tool',
    spoken:
      'Kea is just a conversational tool. We talk like friends — there is no lesson plan and no homework.',
  },
  {
    id: 'mix-languages',
    title: 'Mix your languages',
    spoken:
      'You can speak a sentence half in your own language and half with words you already know. I will help you say it naturally.',
  },
  {
    id: 'all-levels',
    title: 'All levels',
    spoken:
      'I can talk and teach with friends at every level — from absolute beginners to advanced speakers.',
  },
  {
    id: 'learn-list-save',
    title: 'Save to Learn List',
    spoken:
      'You can tell me to save a word or a short sentence on your Learn List, and I will bring it up again in conversation.',
  },
  {
    id: 'learn-list-mastery',
    title: 'Learn List mastery',
    spoken:
      'When you have used a Learn List word well about {masteryUses} times in real chat, it disappears from the list.',
  },
  {
    id: 'performance',
    title: 'Engagement time',
    spoken:
      'I record how long we talk. In the menu you will see a percentage for whether your time went up or down over the last seven days.',
  },
  {
    id: 'voice',
    title: 'Choose your voice',
    spoken:
      'You can choose your own voice for me in Settings whenever you like.',
  },
  {
    id: 'reports',
    title: 'Reports',
    spoken:
      'In the account menu you will find reports. Performance shows whether your talk time went up or down over the last seven days. Usage shows how much you have been talking. Your Learn List tracks the words and phrases you are practising.',
  },
  {
    id: 'companion',
    title: 'Companion',
    spoken:
      "I'm a companion, and as you learn we will get to know each other better. I hope this will be the beginning of a beautiful relationship. Shall we get started?",
  },
]

function isStep(value: unknown): value is OnboardingStep {
  if (!value || typeof value !== 'object') return false
  const item = value as OnboardingStep
  return (
    typeof item.id === 'string' &&
    typeof item.title === 'string' &&
    typeof item.spoken === 'string'
  )
}

export function fillOnboardingPlaceholders(spoken: string) {
  return spoken.replace(/\{masteryUses\}/g, String(getLearnMasteryUses()))
}

/** Spoken line for a tour step (no “OK?” / voice-yes prompt). */
export function spokenOnboardingLine(spoken: string) {
  return fillOnboardingPlaceholders(spoken).replace(/\s+/g, ' ').trim()
}

export function loadOnboardingSteps(): OnboardingStep[] {
  const defaults = structuredClone(DEFAULT_ONBOARDING_STEPS)
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaults
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return defaults
    const steps = parsed.filter(isStep).map((item) => ({
      id: item.id.trim() || crypto.randomUUID(),
      title: item.title.trim() || 'Step',
      spoken: item.spoken.trim(),
    }))
    if (steps.length === 0) return defaults
    const known = new Set(steps.map((item) => item.id))
    const missing = defaults.filter((item) => !known.has(item.id))
    return [...steps, ...missing]
  } catch {
    return defaults
  }
}

export function saveOnboardingSteps(steps: OnboardingStep[]) {
  const cleaned = steps
    .map((item) => ({
      id: item.id.trim() || crypto.randomUUID(),
      title: item.title.trim() || 'Step',
      spoken: item.spoken.trim(),
    }))
    .filter((item) => item.spoken)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned))
  window.dispatchEvent(new Event(ONBOARDING_CHANGED))
}

export function resetOnboardingSteps() {
  localStorage.removeItem(STORAGE_KEY)
  window.dispatchEvent(new Event(ONBOARDING_CHANGED))
}

const PENDING_KEY = 'kea-spoken-tour-pending'
const ARMED_KEY = 'kea-spoken-tour-armed'
const QUIZ_DISMISSED_KEY = 'kea-learner-quiz-dismissed'

function doneStorageKey(userKey = '') {
  return userKey ? `${DONE_KEY}:${userKey}` : DONE_KEY
}

function pendingStorageKey(userKey = '') {
  return userKey ? `${PENDING_KEY}:${userKey}` : PENDING_KEY
}

function armSpokenTourSession() {
  try {
    sessionStorage.setItem(ARMED_KEY, '1')
  } catch {
    // ignore
  }
}

function clearSpokenTourArm() {
  try {
    sessionStorage.removeItem(ARMED_KEY)
  } catch {
    // ignore
  }
}

export function isSpokenTourArmed() {
  try {
    return sessionStorage.getItem(ARMED_KEY) === '1'
  } catch {
    return false
  }
}

/** Stage 2 is due after the get-to-know-you answers are saved. */
export function markSpokenTourPending(userKey = '') {
  try {
    localStorage.setItem(pendingStorageKey(userKey), '1')
    // Re-running get-to-know-you (e.g. Account → Onboarding) must replay the tour.
    localStorage.removeItem(doneStorageKey(userKey))
    localStorage.removeItem(DONE_KEY)
  } catch {
    // ignore
  }
  armSpokenTourSession()
  window.dispatchEvent(new Event(ONBOARDING_CHANGED))
}

export function isSpokenTourPending(userKey = '') {
  try {
    return localStorage.getItem(pendingStorageKey(userKey)) === '1'
  } catch {
    return false
  }
}

export function clearSpokenTourPending(userKey = '') {
  try {
    localStorage.removeItem(pendingStorageKey(userKey))
    localStorage.removeItem(PENDING_KEY)
  } catch {
    // ignore
  }
  clearSpokenTourArm()
  window.dispatchEvent(new Event(ONBOARDING_CHANGED))
}

/**
 * Drop leftover stage-2 flags so a later login / reload goes to chat,
 * not an abandoned How to use Kea screen.
 * Keeps the tour only while this visit is still armed after stage 1.
 */
export function clearStaleSpokenTourPending(
  userKey: string,
  _options?: { hasTalked: boolean; completed: boolean },
) {
  if (!isSpokenTourPending(userKey)) return false
  if (isSpokenTourArmed()) return false
  clearSpokenTourPending(userKey)
  return true
}

function quizDismissedStorageKey(userKey = '') {
  return userKey ? `${QUIZ_DISMISSED_KEY}:${userKey}` : QUIZ_DISMISSED_KEY
}

export function hasDismissedLearnerQuiz(userKey = '') {
  try {
    return localStorage.getItem(quizDismissedStorageKey(userKey)) === '1'
  } catch {
    return false
  }
}

/** Skip get-to-know-you on this device (exit X). */
export function dismissLearnerQuiz(userKey = '') {
  try {
    localStorage.setItem(quizDismissedStorageKey(userKey), '1')
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event(ONBOARDING_CHANGED))
}

/**
 * Exit X on any onboarding step: leave Stage 1 / Stage 2 and open chat.
 */
export function exitOnboardingToChat(userKey = '') {
  dismissLearnerQuiz(userKey)
  markSpokenOnboardingComplete(userKey)
}

/** Skip or abandon How to use Kea and treat it as done on this device. */
export function dismissSpokenTour(userKey = '') {
  markSpokenOnboardingComplete(userKey)
}

/**
 * Wipe every pending stage-2 flag on this device (Reset / language restart).
 * Marks the tour complete so chat opens instead of How to use Kea.
 */
export function abandonSpokenTourEverywhere() {
  clearSpokenTourArm()
  try {
    const remove: string[] = []
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i)
      if (!key) continue
      if (key === PENDING_KEY || key.startsWith(`${PENDING_KEY}:`)) {
        remove.push(key)
      }
    }
    for (const key of remove) localStorage.removeItem(key)
    localStorage.setItem(DONE_KEY, '1')
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event(ONBOARDING_CHANGED))
}

export function hasCompletedSpokenOnboarding(userKey = '') {
  try {
    return localStorage.getItem(doneStorageKey(userKey)) === '1'
  } catch {
    return false
  }
}

export function markSpokenOnboardingComplete(userKey = '') {
  try {
    localStorage.setItem(doneStorageKey(userKey), '1')
    localStorage.removeItem(pendingStorageKey(userKey))
    localStorage.removeItem(PENDING_KEY)
  } catch {
    // ignore
  }
  clearSpokenTourArm()
  window.dispatchEvent(new Event(ONBOARDING_CHANGED))
}

/** Admin testing: run onboarding again on this device. */
export function clearSpokenOnboardingComplete(userKey = '') {
  try {
    localStorage.removeItem(doneStorageKey(userKey))
    localStorage.removeItem(DONE_KEY)
    localStorage.removeItem(pendingStorageKey(userKey))
    localStorage.removeItem(PENDING_KEY)
    localStorage.removeItem(quizDismissedStorageKey(userKey))
    localStorage.removeItem(QUIZ_DISMISSED_KEY)
  } catch {
    // ignore
  }
  clearSpokenTourArm()
  clearFirstMeetGreetingDone(userKey)
  window.dispatchEvent(new Event(ONBOARDING_CHANGED))
}

export function withOkPrompt(spoken: string) {
  // Kept for older callers; tour no longer appends “OK?”.
  return spokenOnboardingLine(spoken) || 'OK?'
}
