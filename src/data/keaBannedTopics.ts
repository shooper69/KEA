const STORAGE_KEY = 'kea-banned-topics-v1'

export function getBannedTopics(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((item) => String(item ?? '').trim())
      .filter(Boolean)
      .slice(0, 80)
  } catch {
    return []
  }
}

export function saveBannedTopics(topics: string[]) {
  const cleaned = topics
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 80)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned))
}

export function resetBannedTopics() {
  localStorage.removeItem(STORAGE_KEY)
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
