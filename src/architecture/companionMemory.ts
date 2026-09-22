import type { ChatTopic, LanguageCode, LearnListItem } from '../types'

const LEARN_KEY = 'kea-learn-list'
const TOPICS_KEY = 'kea-chat-topics'
const OPEN_TOPIC_KEY = 'kea-open-topic-id'

const LEARN_REQUEST =
  /how (do you|do i|to) say|what does .+ mean|c[oó]mo se dice|wie sagt man|comment dit[- ]on|как сказать|translate|what is the (word|difference)|ser vs estar|subjunctive|grammar|help me (say|express)|why (do|does) (we|you|they) say/i

const SAMPLE_TOPICS: ChatTopic[] = [
  {
    id: 'sample-dog',
    title: 'Simon hablar about se perro',
    nativeTitle: 'Simon spoke about his dog',
    summary: 'Simon spoke about his dog',
    firstDiscussedAt: '2026-09-20T10:00:00.000Z',
    lastDiscussedAt: '2026-09-22T18:00:00.000Z',
    discussionCount: 4,
  },
  {
    id: 'sample-cooking',
    title: 'muchas charlas sobre cocina',
    nativeTitle: 'many chats about cooking',
    summary: 'many chats about cooking',
    firstDiscussedAt: '2026-09-18T10:00:00.000Z',
    lastDiscussedAt: '2026-09-21T16:00:00.000Z',
    discussionCount: 6,
  },
  {
    id: 'sample-valencia',
    title: 'el viaje a Valencia el verano pasado',
    nativeTitle: 'the trip to Valencia last summer',
    summary: 'the trip to Valencia last summer',
    firstDiscussedAt: '2026-09-12T10:00:00.000Z',
    lastDiscussedAt: '2026-09-19T12:00:00.000Z',
    discussionCount: 3,
  },
  {
    id: 'sample-neighbours',
    title: 'los vecinos y el ruido por la noche',
    nativeTitle: 'the neighbours and the noise at night',
    summary: 'the neighbours and the noise at night',
    firstDiscussedAt: '2026-09-10T10:00:00.000Z',
    lastDiscussedAt: '2026-09-17T09:00:00.000Z',
    discussionCount: 2,
  },
]

const SAMPLE_LEARN: LearnListItem[] = [
  {
    id: 'sample-about',
    term: 'About',
    translation: 'acerca de',
    languageCode: 'es',
    createdAt: '2026-09-22T18:00:00.000Z',
    lastReviewedAt: '2026-09-22T18:00:00.000Z',
    practiceCount: 0,
    status: 'learning',
  },
]

function mergeById<T extends { id: string }>(stored: T[], samples: T[]) {
  const have = new Set(stored.map((item) => item.id))
  const missing = samples.filter((item) => !have.has(item.id))
  return missing.length ? [...missing, ...stored] : stored
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value))
}

export function getLearnList(): LearnListItem[] {
  const stored = readJson<LearnListItem[]>(LEARN_KEY, [])
  const merged = mergeById(stored, SAMPLE_LEARN)
  if (merged !== stored && merged.length !== stored.length) saveLearnList(merged)
  return merged
}

export function getChatTopics(): ChatTopic[] {
  const stored = readJson<ChatTopic[]>(TOPICS_KEY, []).map((item) => ({
    ...item,
    nativeTitle: item.nativeTitle || item.summary || '',
  }))
  const merged = mergeById(stored, SAMPLE_TOPICS)
  if (merged.length !== stored.length) saveChatTopics(merged)
  return merged.sort((a, b) => b.lastDiscussedAt.localeCompare(a.lastDiscussedAt))
}

export function saveLearnList(items: LearnListItem[]) {
  writeJson(LEARN_KEY, items)
}

export function saveChatTopics(items: ChatTopic[]) {
  writeJson(TOPICS_KEY, items)
}

export function looksLikeLearnRequest(text: string) {
  return LEARN_REQUEST.test(text)
}

export function captureLearnRequest(
  userText: string,
  languageCode: LanguageCode,
  keaReply: string,
) {
  if (!looksLikeLearnRequest(userText)) return
  const term = userText.replace(/\s+/g, ' ').trim().slice(0, 80)
  if (!term) return
  const items = getLearnList()
  const existing = items.find(
    (item) =>
      item.languageCode === languageCode &&
      item.term.toLowerCase() === term.toLowerCase(),
  )
  const now = new Date().toISOString()
  if (existing) {
    existing.translation = keaReply.slice(0, 180)
    existing.lastReviewedAt = now
    existing.practiceCount += 1
    existing.status = existing.practiceCount >= 10 ? 'reinforced' : 'learning'
  } else {
    items.unshift({
      id: crypto.randomUUID(),
      term,
      translation: keaReply.slice(0, 180),
      languageCode,
      createdAt: now,
      lastReviewedAt: now,
      practiceCount: 0,
      status: 'learning',
    })
  }
  saveLearnList(items)
}

export function touchChatTopic(userText: string, keaReply: string) {
  const now = new Date().toISOString()
  const topics = getChatTopics()
  const openId = sessionStorage.getItem(OPEN_TOPIC_KEY)
  let topic = topics.find((item) => item.id === openId)
  const learnt = topicLine(keaReply) || topicLine(userText)
  const native = topicLine(userText)
  if (!topic) {
    topic = {
      id: crypto.randomUUID(),
      title: learnt,
      nativeTitle: native,
      summary: native,
      firstDiscussedAt: now,
      lastDiscussedAt: now,
      discussionCount: 1,
    }
    topics.unshift(topic)
    sessionStorage.setItem(OPEN_TOPIC_KEY, topic.id)
  } else {
    const quietMs =
      Date.now() - new Date(topic.lastDiscussedAt).getTime()
    if (quietMs > 30 * 60 * 1000) {
      topic = {
        id: crypto.randomUUID(),
        title: learnt,
        nativeTitle: native,
        summary: native,
        firstDiscussedAt: now,
        lastDiscussedAt: now,
        discussionCount: 1,
      }
      topics.unshift(topic)
      sessionStorage.setItem(OPEN_TOPIC_KEY, topic.id)
    } else {
      topic.title = learnt
      topic.nativeTitle = native
      topic.summary = native
      topic.lastDiscussedAt = now
      topic.discussionCount += 1
    }
  }
  saveChatTopics(topics)
}

function topicLine(text: string, max = 110) {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (!cleaned) return ''
  const sentence = cleaned.split(/(?<=[.!?¿¡])\s+/)[0] || cleaned
  if (sentence.length <= max) return sentence
  return `${sentence.slice(0, max).trim()}…`
}

export function openChatTopic(id: string) {
  sessionStorage.setItem(OPEN_TOPIC_KEY, id)
}

export function getOpenChatTopic(): ChatTopic | null {
  const id = sessionStorage.getItem(OPEN_TOPIC_KEY)
  if (!id) return null
  return getChatTopics().find((item) => item.id === id) ?? null
}

export function memoryPromptBlock() {
  const learn = getLearnList()
    .slice(0, 12)
    .map((item) => `- ${item.term} → ${item.translation} (${item.status})`)
    .join('\n')
  const topics = getChatTopics()
    .slice(0, 12)
    .map((item) => `- ${item.title} / ${item.nativeTitle || item.summary}`)
    .join('\n')
  const open = getOpenChatTopic()
  const openBlock = open
    ? `OPEN TOPIC (continue this chat; do not start a new subject unless the learner changes it):
- ${open.title} / ${open.nativeTitle || open.summary}

`
    : ''
  return `${openBlock}LEARN LIST (language gaps only; never mix with topics):
${learn || '(empty)'}

CURRENT CHAT TOPICS (conversation continuity only; never mix with Learn List):
${topics || '(empty)'}`
}
