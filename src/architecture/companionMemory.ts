import { getLearnMasteryUses } from '../data/keaLearnMastery'
import { looksLikeSystemText } from './whisperText'
import type { ChatTopic, LanguageCode, LearnListItem } from '../types'

const LEARN_KEY = 'kea-learn-list'
const MASTERED_KEY = 'kea-learn-mastered'
const TOPICS_KEY = 'kea-chat-topics'
const OPEN_TOPIC_KEY = 'kea-open-topic-id'
const CHANGE_EVENT = 'kea-learn-memory'

const LEARN_REQUEST =
  /how (do you|do i|to) say|what does .+ mean|c[oó]mo se dice|wie sagt man|comment dit[- ]on|как сказать|translate|what is the (word|difference)|ser vs estar|subjunctive|grammar|help me (say|express)|why (do|does) (we|you|they) say/i

const ASK_TERM =
  /(?:how (?:do (?:you|i)|to) say|what does|c[oó]mo se dice|wie sagt man|comment dit[- ]on|как сказать)\s+["«“']?([^?"»”']+)/i

const MEMORY_BLOCK =
  /(?:\n|^)\s*<<<KEA_MEMORY\s*([\s\S]*?)\s*(?:>>>|KEA_MEMORY>>>)\s*$/i

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

export interface MasteredLearnItem {
  id: string
  term: string
  translation: string
  languageCode: LanguageCode
  masteredAt: string
}

export interface LearnMemorySignals {
  add: Array<{ term: string; translation: string }>
  used: string[]
}

const listeners = new Set<() => void>()

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

function notifyLearnMemory() {
  listeners.forEach((listen) => listen())
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

export function subscribeLearnMemory(listen: () => void) {
  listeners.add(listen)
  return () => {
    listeners.delete(listen)
  }
}

function normalizeTerm(value: string) {
  return value.replace(/\s+/g, ' ').trim().slice(0, 80)
}

function termKey(value: string) {
  return normalizeTerm(value).toLowerCase()
}

const STOP_WORDS = new Set([
  'about',
  'this',
  'that',
  'with',
  'from',
  'have',
  'what',
  'when',
  'como',
  'qué',
  'que',
])

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function isCountableToken(value: string) {
  const key = termKey(value)
  if (key.length < 4) return false
  return !STOP_WORDS.has(key)
}

function hasWord(haystack: string, needle: string) {
  const n = normalizeTerm(needle)
  if (!isCountableToken(n)) return false
  const re = new RegExp(
    `(?:^|[^\\p{L}\\p{N}])${escapeRegExp(n)}(?:$|[^\\p{L}\\p{N}])`,
    'iu',
  )
  return re.test(haystack)
}

export function looksLikeLearnRequest(text: string) {
  if (looksLikeSystemText(text)) return false
  return LEARN_REQUEST.test(text)
}

function askedTerm(userText: string) {
  const hit = userText.match(ASK_TERM)
  if (hit?.[1]) return normalizeTerm(hit[1])
  if (!looksLikeLearnRequest(userText)) return ''
  return normalizeTerm(userText.replace(/[?¿¡!.,]/g, '')).slice(0, 48)
}

export function splitTalkParagraphs(text: string): string[] {
  return text
    .trim()
    .replace(/\r\n/g, '\n')
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean)
}

export function spaceFinalQuestion(text: string): string {
  const trimmed = text.trim().replace(/\r\n/g, '\n')
  if (!trimmed) return trimmed
  if (/\n\s*\n\s*(?:¿|¡)?[^\n]+\?\s*$/.test(trimmed)) return trimmed
  const chunks = trimmed.split(/(?<=[.!?…]["»”']?)(?:\s+|\n+)/)
  if (chunks.length < 2) return trimmed
  const last = chunks[chunks.length - 1]?.trim() ?? ''
  if (!/[?？]\s*$/.test(last)) return trimmed
  const body = chunks.slice(0, -1).join(' ').trim()
  if (!body) return trimmed
  return `${body}\n${last}`
}

export function alignCaptionParagraphs(spoken: string, caption: string): string[] {
  const spokenParts = splitTalkParagraphs(spoken)
  const raw = splitTalkParagraphs(caption)
  if (!spokenParts.length) return raw
  if (raw.length === spokenParts.length) return raw
  const spaced = splitTalkParagraphs(spaceFinalQuestion(raw.join(' ')))
  if (spaced.length === spokenParts.length) return spaced
  if (spaced.length > spokenParts.length && spokenParts.length > 0) {
    return [
      ...spaced.slice(0, spokenParts.length - 1),
      spaced.slice(spokenParts.length - 1).join(' '),
    ]
  }
  return spaced
}

export function splitKeaReply(raw: string): {
  reply: string
  signals: LearnMemorySignals
} {
  const match = raw.match(MEMORY_BLOCK)
  const empty: LearnMemorySignals = { add: [], used: [] }
  if (!match) return { reply: spaceFinalQuestion(raw.trim()), signals: empty }
  const reply = spaceFinalQuestion(raw.replace(MEMORY_BLOCK, '').trim())
  try {
    const parsed = JSON.parse(match[1] || '{}') as {
      add?: Array<{ term?: string; translation?: string }>
      used?: unknown[]
    }
    const add = (parsed.add ?? [])
      .map((item) => ({
        term: normalizeTerm(item.term ?? ''),
        translation: normalizeTerm(item.translation ?? ''),
      }))
      .filter((item) => item.term)
    const used = (parsed.used ?? [])
      .map((item) => normalizeTerm(String(item)))
      .filter(Boolean)
    return { reply, signals: { add, used } }
  } catch {
    return { reply, signals: empty }
  }
}

function readLearnList(): LearnListItem[] {
  const stored = readJson<LearnListItem[]>(LEARN_KEY, [])
  const merged = mergeById(stored, SAMPLE_LEARN)
  if (merged !== stored && merged.length !== stored.length) {
    writeJson(LEARN_KEY, merged)
  }
  return merged
}

function readMastered(): MasteredLearnItem[] {
  return readJson<MasteredLearnItem[]>(MASTERED_KEY, [])
}

function persistLearn(items: LearnListItem[], mastered = readMastered()) {
  writeJson(LEARN_KEY, items)
  writeJson(MASTERED_KEY, mastered)
  notifyLearnMemory()
}

function graduateReady(items: LearnListItem[], mastered: MasteredLearnItem[]) {
  const need = getLearnMasteryUses()
  const keep: LearnListItem[] = []
  let changed = false
  const now = new Date().toISOString()
  for (const item of items) {
    if (item.practiceCount >= need) {
      changed = true
      mastered.push({
        id: item.id,
        term: item.term,
        translation: item.translation,
        languageCode: item.languageCode,
        masteredAt: now,
      })
    } else {
      keep.push(item)
    }
  }
  return { items: keep, mastered, changed }
}

export function getLearnList(): LearnListItem[] {
  const graduated = graduateReady(readLearnList(), readMastered())
  const items = graduated.items.filter(
    (item) =>
      !looksLikeSystemText(item.term) &&
      !looksLikeSystemText(item.translation),
  )
  const changed = graduated.changed || items.length !== graduated.items.length
  if (changed) persistLearn(items, graduated.mastered)
  return items
}

export function getMasteredLearnCount(): number {
  getLearnList()
  return readMastered().length
}

function isSystemTopic(item: ChatTopic) {
  return [item.title, item.nativeTitle, item.summary].some(
    (value) => Boolean(value) && looksLikeSystemText(value),
  )
}

export function getChatTopics(): ChatTopic[] {
  const raw = readJson<ChatTopic[]>(TOPICS_KEY, [])
  const stored = raw
    .map((item) => ({
      ...item,
      nativeTitle: item.nativeTitle || item.summary || '',
    }))
    .filter((item) => !isSystemTopic(item))
  const merged = mergeById(stored, SAMPLE_TOPICS)
  if (merged.length !== raw.length || stored.length !== raw.length) {
    saveChatTopics(merged)
  }
  return merged.sort((a, b) => b.lastDiscussedAt.localeCompare(a.lastDiscussedAt))
}

export function saveLearnList(items: LearnListItem[]) {
  persistLearn(items)
}

export function saveChatTopics(items: ChatTopic[]) {
  writeJson(TOPICS_KEY, items)
}

function upsertLearnItem(
  items: LearnListItem[],
  languageCode: LanguageCode,
  term: string,
  translation: string,
) {
  const key = termKey(term)
  const existing = items.find(
    (item) =>
      item.languageCode === languageCode &&
      (termKey(item.term) === key || termKey(item.translation) === key),
  )
  const now = new Date().toISOString()
  if (existing) {
    if (translation) existing.translation = translation.slice(0, 180)
    existing.lastReviewedAt = now
    return existing
  }
  const created: LearnListItem = {
    id: crypto.randomUUID(),
    term,
    translation: translation.slice(0, 180),
    languageCode,
    createdAt: now,
    lastReviewedAt: now,
    practiceCount: 0,
    status: 'learning',
  }
  items.unshift(created)
  return created
}

function markUsed(
  items: LearnListItem[],
  languageCode: LanguageCode,
  token: string,
  skipIds: Set<string>,
) {
  const key = termKey(token)
  const item = items.find(
    (entry) =>
      entry.languageCode === languageCode &&
      !skipIds.has(entry.id) &&
      (termKey(entry.term) === key || termKey(entry.translation) === key),
  )
  if (!item) return
  item.practiceCount += 1
  item.lastReviewedAt = new Date().toISOString()
  item.status = item.practiceCount >= getLearnMasteryUses() - 1 ? 'reinforced' : 'learning'
}

export function applyLearnTurn(options: {
  languageCode: LanguageCode
  userText: string
  keaReply: string
  signals?: LearnMemorySignals
}) {
  if (
    looksLikeSystemText(options.userText) ||
    looksLikeSystemText(options.keaReply)
  ) {
    return
  }
  const items = getLearnList()
  const addedIds = new Set<string>()
  const seenAdd = new Set<string>()

  const additions = [...(options.signals?.add ?? [])]
  const asked = askedTerm(options.userText)
  if (asked) {
    additions.push({
      term: asked,
      translation: options.keaReply.replace(/\s+/g, ' ').trim().slice(0, 180),
    })
  }

  for (const addition of additions) {
    const term = normalizeTerm(addition.term)
    if (!term || seenAdd.has(termKey(term))) continue
    seenAdd.add(termKey(term))
    const row = upsertLearnItem(
      items,
      options.languageCode,
      term,
      addition.translation,
    )
    addedIds.add(row.id)
  }

  const usedTokens = new Set(
    (options.signals?.used ?? []).map(termKey).filter(Boolean),
  )
  if (!looksLikeLearnRequest(options.userText)) {
    for (const item of items) {
      if (item.languageCode !== options.languageCode) continue
      if (addedIds.has(item.id)) continue
      if (hasWord(options.userText, item.term) || hasWord(options.userText, item.translation)) {
        usedTokens.add(termKey(item.term))
      }
    }
  }

  for (const token of usedTokens) {
    markUsed(items, options.languageCode, token, addedIds)
  }

  const graduated = graduateReady(items, readMastered())
  persistLearn(graduated.items, graduated.mastered)
}

export function captureLearnRequest(
  userText: string,
  languageCode: LanguageCode,
  keaReply: string,
) {
  applyLearnTurn({ languageCode, userText, keaReply })
}

export function touchChatTopic(userText: string, keaReply: string) {
  const learnt = topicLine(keaReply) || topicLine(userText)
  const native = topicLine(userText)
  if (!learnt && !native) return
  const now = new Date().toISOString()
  const topics = getChatTopics()
  const openId = sessionStorage.getItem(OPEN_TOPIC_KEY)
  let topic = topics.find((item) => item.id === openId)
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
  if (!cleaned || looksLikeSystemText(cleaned)) return ''
  const sentence =
    cleaned
      .split(/(?<=[.!?¿¡])\s+/)
      .map((part) => part.trim())
      .find((part) => part && !looksLikeSystemText(part)) || ''
  if (!sentence) return ''
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
  const need = getLearnMasteryUses()
  const learn = getLearnList()
    .slice(0, 12)
    .map(
      (item) =>
        `- ${item.term} → ${item.translation} (used well ${item.practiceCount}/${need})`,
    )
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
  return `${openBlock}LEARN LIST (language gaps only; never mix with topics). A word leaves after ${need} correct uses in the target language:
${learn || '(empty)'}

After your spoken reply, write this hidden block on its own (never speak it, never mention it):
<<<KEA_MEMORY
{"add":[{"term":"short target-language word","translation":"native gloss"}],"used":["target-language word already on the list"]}
>>>
Use add when they drop a native-language word into a target-language sentence, or ask about a word or phrase. Use used when they say a Learn List word correctly in the target language in a real sentence. Use empty arrays if nothing happened.

CURRENT CHAT TOPICS (conversation continuity only; never mix with Learn List):
${topics || '(empty)'}`
}
