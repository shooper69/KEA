import { getLearnMasteryUses } from './keaLearnMastery'

const STORAGE_KEY = 'kea-onboarding-steps-v1'
const DONE_KEY = 'kea-spoken-onboarding-done-v1'
export const ONBOARDING_CHANGED = 'kea-onboarding-changed'

export interface OnboardingStep {
  id: string
  /** Short admin label */
  title: string
  /** What Kea says for this feature (OK? is added when speaking). */
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

export function loadOnboardingSteps(): OnboardingStep[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return structuredClone(DEFAULT_ONBOARDING_STEPS)
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return structuredClone(DEFAULT_ONBOARDING_STEPS)
    const steps = parsed.filter(isStep).map((item) => ({
      id: item.id.trim() || crypto.randomUUID(),
      title: item.title.trim() || 'Step',
      spoken: item.spoken.trim(),
    }))
    return steps.length > 0 ? steps : structuredClone(DEFAULT_ONBOARDING_STEPS)
  } catch {
    return structuredClone(DEFAULT_ONBOARDING_STEPS)
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

function doneStorageKey(userKey = '') {
  return userKey ? `${DONE_KEY}:${userKey}` : DONE_KEY
}

function pendingStorageKey(userKey = '') {
  return userKey ? `${PENDING_KEY}:${userKey}` : PENDING_KEY
}

/** Stage 2 is due after the get-to-know-you answers are saved. */
export function markSpokenTourPending(userKey = '') {
  try {
    localStorage.setItem(pendingStorageKey(userKey), '1')
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event(ONBOARDING_CHANGED))
}

export function isSpokenTourPending(userKey = '') {
  try {
    return localStorage.getItem(pendingStorageKey(userKey)) === '1'
  } catch {
    return false
  }
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
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event(ONBOARDING_CHANGED))
}

/** Admin testing: run onboarding again on this device. */
export function clearSpokenOnboardingComplete(userKey = '') {
  try {
    localStorage.removeItem(doneStorageKey(userKey))
    localStorage.removeItem(DONE_KEY)
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event(ONBOARDING_CHANGED))
}

export function withOkPrompt(spoken: string) {
  const text = fillOnboardingPlaceholders(spoken).replace(/\s+/g, ' ').trim()
  if (!text) return 'OK?'
  if (/\bok\?\s*$/i.test(text)) return text
  return `${text.replace(/[.!?]*$/, '')}. OK?`
}
