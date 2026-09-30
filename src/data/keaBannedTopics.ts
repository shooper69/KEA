const STORAGE_KEY = 'kea-banned-topics-v1'

/** Seed list — editable in Admin → Manage Kea → Banned topics. */
export const DEFAULT_BANNED_TOPICS = ['rape', 'bomb building'] as const

export function getBannedTopics(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return [...DEFAULT_BANNED_TOPICS]
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return [...DEFAULT_BANNED_TOPICS]
    return parsed
      .map((item) => String(item ?? '').trim())
      .filter(Boolean)
      .slice(0, 80)
  } catch {
    return [...DEFAULT_BANNED_TOPICS]
  }
}

export function saveBannedTopics(topics: string[]) {
  const cleaned = topics
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 80)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned))
}

/** Restore the default banned list (still editable after save). */
export function resetBannedTopics() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify([...DEFAULT_BANNED_TOPICS]),
  )
}

/** One topic per line for the admin textarea. */
export function bannedTopicsToText(topics: string[]) {
  return topics.join('\n')
}

export function parseBannedTopicsText(text: string) {
  return text
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 80)
}

export function bannedTopicsPromptBlock(topics = getBannedTopics()) {
  if (!topics.length) return ''
  return `BANNED TOPICS (hard rule):
Never discuss, joke about, teach, translate in detail, or roleplay these subjects. If the learner brings one up, decline in one short friendly line and change the subject.
${topics.map((item) => `- ${item}`).join('\n')}

`
}
