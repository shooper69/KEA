import { loadTalkTranscript } from '../architecture/keaTalkMemory'
import type { LearnerLevel } from '../types'

export type LearnerLevelId =
  | 'beginner'
  | 'basics'
  | 'chatting'
  | 'practice'
  | 'fluent'
  | 'finetune'

export type LearnReasonId = 'fun' | 'family' | 'work' | 'time'

export type WeeklyTimeId = '5' | '10' | '20' | 'more'

export type LearnerAgeId =
  | 'under18'
  | '18-24'
  | '25-34'
  | '35-44'
  | '45-54'
  | '55-64'
  | '65plus'
  | 'undisclosed'

export interface LearnerAnswers {
  level: LearnerLevelId
  reason: LearnReasonId
  weeklyTime: WeeklyTimeId
  age: LearnerAgeId
  interests: string
}

const LEGACY_STORAGE_KEY = 'kea-learner-profile-v1'

const LEVELS = new Set<LearnerLevelId>([
  'beginner',
  'basics',
  'chatting',
  'practice',
  'fluent',
  'finetune',
])
const REASONS = new Set<LearnReasonId>(['fun', 'family', 'work', 'time'])
const TIMES = new Set<WeeklyTimeId>(['5', '10', '20', 'more'])
const AGES = new Set<LearnerAgeId>([
  'under18',
  '18-24',
  '25-34',
  '35-44',
  '45-54',
  '55-64',
  '65plus',
  'undisclosed',
])

export const LEVEL_OPTIONS: { id: LearnerLevelId; label: string }[] = [
  { id: 'beginner', label: 'Beginner, cannot say a word' },
  { id: 'basics', label: 'Learnt some basics, but not really chatting' },
  { id: 'chatting', label: 'Chatting, but not enough' },
  { id: 'practice', label: 'Getting better, need more practice' },
  { id: 'fluent', label: 'Pretty good now, want to get fluent' },
  { id: 'finetune', label: 'I want to fine-tune and show off' },
]

export const REASON_OPTIONS: { id: LearnReasonId; label: string }[] = [
  { id: 'fun', label: 'Fun, holidays' },
  { id: 'family', label: 'Family reasons' },
  { id: 'work', label: 'Work' },
  { id: 'time', label: "It's just time to learn a language" },
]

export const TIME_OPTIONS: { id: WeeklyTimeId; label: string }[] = [
  { id: '5', label: 'Average of 5 minutes a day' },
  { id: '10', label: 'Average of 10 minutes a day' },
  { id: '20', label: 'Average of 20 minutes a day' },
  { id: 'more', label: 'Average of well more' },
]

export const AGE_OPTIONS: { id: LearnerAgeId; label: string }[] = [
  { id: 'under18', label: 'Under 18' },
  { id: '18-24', label: '18–24' },
  { id: '25-34', label: '25–34' },
  { id: '35-44', label: '35–44' },
  { id: '45-54', label: '45–54' },
  { id: '55-64', label: '55–64' },
  { id: '65plus', label: '65 or over' },
  { id: 'undisclosed', label: "I'd rather not say" },
]

export function parseLearnerAnswers(value: unknown): LearnerAnswers | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  const level = row.level
  const reason = row.reason
  const weeklyTime = row.weeklyTime
  const age = row.age
  const interests = typeof row.interests === 'string' ? row.interests : ''
  if (
    typeof level !== 'string' ||
    typeof reason !== 'string' ||
    typeof weeklyTime !== 'string' ||
    typeof age !== 'string' ||
    !LEVELS.has(level as LearnerLevelId) ||
    !REASONS.has(reason as LearnReasonId) ||
    !TIMES.has(weeklyTime as WeeklyTimeId) ||
    !AGES.has(age as LearnerAgeId)
  ) {
    return null
  }
  return {
    level: level as LearnerLevelId,
    reason: reason as LearnReasonId,
    weeklyTime: weeklyTime as WeeklyTimeId,
    age: age as LearnerAgeId,
    interests: interests.trim(),
  }
}

/** Answers saved in the browser before they were stored on the account. */
export function loadLegacyLearnerAnswers(userKey: string): LearnerAnswers | null {
  const key = userKey.trim().toLowerCase()
  if (!key) return null
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Record<string, unknown>
    return parseLearnerAnswers(parsed[key])
  } catch {
    return null
  }
}

let activeAnswers: LearnerAnswers | null = null

export function setActiveLearnerAnswers(answers: LearnerAnswers | null) {
  activeAnswers = answers
}

export function hasUserTalked() {
  return loadTalkTranscript().some(
    (message) => message.speaker === 'user' && message.text.trim(),
  )
}

export function learnerLevelToSession(level: LearnerLevelId): LearnerLevel {
  if (level === 'beginner' || level === 'basics') return 'beginner'
  if (level === 'fluent' || level === 'finetune') return 'advanced'
  return 'intermediate'
}

function labelOf<T extends string>(
  options: { id: T; label: string }[],
  id: T,
) {
  return options.find((option) => option.id === id)?.label ?? id
}

export function formatLearnerProfile(answers: LearnerAnswers) {
  const interests = answers.interests.trim()
  return `LEARNER PROFILE
They told you this when you met. Use it naturally while you talk. Do not read it back as a questionnaire. Match how new they are, why they are learning, and how much time they have. Bring their interests in when a topic fits.
- Level: ${labelOf(LEVEL_OPTIONS, answers.level)}
- Why they are learning: ${labelOf(REASON_OPTIONS, answers.reason)}
- Time: ${labelOf(TIME_OPTIONS, answers.weeklyTime)}
- Age: ${
    answers.age === 'undisclosed'
      ? 'they would rather not say. Do not guess or mention their age.'
      : labelOf(AGE_OPTIONS, answers.age)
  }
- Interests they want to talk about: ${interests || 'not given yet'}`
}

/** Profile loaded from the signed-in account. */
export function learnerProfilePrompt() {
  if (!activeAnswers) return ''
  return formatLearnerProfile(activeAnswers)
}
