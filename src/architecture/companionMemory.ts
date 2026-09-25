import { getLearnMasteryUses } from '../data/keaLearnMastery'
import { looksLikeSystemText } from './whisperText'
import type { ChatTopic, LanguageCode, LearnListItem } from '../types'

const LEARN_KEY = 'kea-learn-list'
const MASTERED_KEY = 'kea-learn-mastered'
const TOPICS_KEY = 'kea-chat-topics'
const OPEN_TOPIC_KEY = 'kea-open-topic-id'
const OPEN_TOPIC_LOCAL_KEY = 'kea-open-topic-id-v1'
const CHANGE_EVENT = 'kea-learn-memory'

const LEARN_REQUEST =
  /how (do you|do i|to) say|what does .+ mean|c[oó]mo se dice|wie sagt man|comment dit[- ]on|как сказать|translate|what is the (word|difference)|ser vs estar|subjunctive|grammar|help me (say|express)|why (do|does) (we|you|they) say/i

const LEARN_LIST_QUIZ =
  /\b(test|quiz|practi[sc]e|drill)\s+me\b.*\blearn\s*list\b|\blearn\s*list\b.*\b(test|quiz|practi[sc]e|drill)\s+me\b|\btest me on (my )?(words|vocabulary|vocab)\b|\bexam[ií]name\b.*\blista\b|\bhaz(me)? (un )?examen\b.*\blista\b/i

const ASK_TERM =
  /(?:how (?:do (?:you|i)|to) say|what does|c[oó]mo se dice|wie sagt man|comment dit[- ]on|как сказать)\s+["«“']?([^?"»”']+)/i

const MEMORY_BLOCK =
  /(?:\n|^)\s*<<<KEA_MEMORY\s*([\s\S]*?)\s*(?:>>>|KEA_MEMORY>>>)\s*$/i

/** Short Spanish function / content words — not English intrusions. */
const SPANISH_COMMON = new Set(
  [
    'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'al', 'y', 'o',
    'que', 'qué', 'como', 'cómo', 'en', 'con', 'por', 'para', 'sin', 'sobre', 'entre',
    'es', 'son', 'está', 'estan', 'están', 'ser', 'estar', 'hay', 'fue', 'era',
    'yo', 'tu', 'tú', 'usted', 'nosotros', 'ellos', 'ellas', 'me', 'te', 'se', 'nos',
    'mi', 'mis', 'su', 'sus', 'lo', 'le', 'les', 'esto', 'esta', 'este', 'eso',
    'muy', 'más', 'mas', 'menos', 'ya', 'sí', 'si', 'no', 'también', 'tambien',
    'hoy', 'mañana', 'manana', 'ayer', 'ahora', 'aquí', 'aqui', 'allí', 'alli',
    'bien', 'mal', 'gracias', 'hola', 'adios', 'adiós', 'favor', 'bueno',
    'porque', 'cuando', 'dónde', 'donde', 'quien', 'quién', 'cual', 'cuál',
    'quiero', 'quieres', 'puede', 'puedo', 'hacer', 'decir', 'tener', 'tengo',
    'voy', 'vas', 'vamos', 'ir', 'soy', 'eres', 'somos',
  ].map((w) => w.toLowerCase()),
)

/** English fallbacks learners often drop into Spanish sentences. */
const ENGLISH_FALLBACK = new Set(
  [
    'about', 'after', 'again', 'also', 'always', 'because', 'before', 'better',
    'computer', 'dinner', 'doctor', 'family', 'friend', 'friends', 'great',
    'help', 'house', 'important', 'job', 'kitchen', 'later', 'maybe', 'meeting',
    'money', 'morning', 'never', 'night', 'office', 'people', 'please', 'problem',
    'really', 'restaurant', 'school', 'something', 'sometimes', 'sorry', 'store',
    'supermarket', 'today', 'tomorrow', 'tonight', 'travel', 'understand',
    'weather', 'weekend', 'work', 'yesterday', 'airport', 'appointment',
    'birthday', 'breakfast', 'bus', 'car', 'city', 'clothes', 'coffee', 'cook',
    'dog', 'cat', 'email', 'food', 'garden', 'hotel', 'idea', 'key', 'lunch',
    'message', 'movie', 'music', 'park', 'party', 'phone', 'plan', 'question',
    'rain', 'shop', 'shopping', 'ticket', 'train', 'trip', 'wait', 'walk',
    'water', 'window', 'wrong', 'right', 'need', 'want', 'think', 'know',
  ].map((w) => w.toLowerCase()),
)
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
    term: 'about',
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

/** Learn List stores words/short phrases only — never full sentences. */
export function isLearnWordPhrase(value: string) {
  const text = normalizeTerm(value)
  if (!text || text.length > 42) return false
  if (/[.!?¿¡;:]/.test(text)) return false
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length === 0 || words.length > 4) return false
  return true
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
  if (key.length < 3) return false
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

function hasSpanishContext(text: string) {
  if (/[áéíóúñü¿¡]/i.test(text)) return true
  const tokens = text.toLowerCase().match(/[\p{L}']+/gu) ?? []
  let hits = 0
  for (const token of tokens) {
    if (SPANISH_COMMON.has(token)) hits += 1
  }
  return hits >= 2
}

function looksLikeEnglishToken(token: string) {
  const key = token.toLowerCase()
  if (key.length < 3) return false
  if (SPANISH_COMMON.has(key)) return false
  if (/[áéíóúñü]/i.test(token)) return false
  if (!/^[a-zA-Z']+$/.test(token)) return false
  return ENGLISH_FALLBACK.has(key)
}

/**
 * Native-language (English) words dropped into a target-language sentence.
 * These are highlighted in red and auto-saved onto the Learn List.
 */
export function extractNativeIntrusions(text: string): string[] {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (!cleaned || looksLikeSystemText(cleaned)) return []
  if (!hasSpanishContext(cleaned) && !looksLikeLearnRequest(cleaned)) {
    // Still catch explicitly quoted English: "… 'computer' …"
    const quoted = [
      ...cleaned.matchAll(/["«“']([A-Za-z']{3,})["»”']/g),
    ].map((m) => m[1])
    return [...new Set(quoted.filter(looksLikeEnglishToken).map(normalizeTerm))]
  }
  const tokens = cleaned.match(/[A-Za-zÀ-ÿ']+/g) ?? []
  const found: string[] = []
  const seen = new Set<string>()
  for (const token of tokens) {
    if (!looksLikeEnglishToken(token)) continue
    const key = termKey(token)
    if (seen.has(key)) continue
    seen.add(key)
    found.push(normalizeTerm(token))
  }
  return found
}

export function looksLikeLearnRequest(text: string) {
  if (looksLikeSystemText(text)) return false
  return LEARN_REQUEST.test(text)
}

export function looksLikeLearnListQuizRequest(text: string) {
  if (looksLikeSystemText(text)) return false
  return LEARN_LIST_QUIZ.test(text)
}

function askedTerm(userText: string) {
  const hit = userText.match(ASK_TERM)
  if (hit?.[1]) {
    const term = normalizeTerm(hit[1])
    return isLearnWordPhrase(term) ? term : ''
  }
  return ''
}

/** Wrap matching words in red highlight markers for chat display. */
export function highlightNativeIntrusions(
  text: string,
  highlights: string[],
): Array<{ text: string; highlight: boolean }> {
  if (!text || !highlights.length) return [{ text, highlight: false }]
  const unique = [...new Set(highlights.map(normalizeTerm).filter(Boolean))].sort(
    (a, b) => b.length - a.length,
  )
  if (!unique.length) return [{ text, highlight: false }]
  const pattern = unique.map(escapeRegExp).join('|')
  const re = new RegExp(`(${pattern})`, 'gi')
  const parts: Array<{ text: string; highlight: boolean }> = []
  let last = 0
  for (const match of text.matchAll(re)) {
    const start = match.index ?? 0
    if (start > last) {
      parts.push({ text: text.slice(last, start), highlight: false })
    }
    parts.push({ text: match[0], highlight: true })
    last = start + match[0].length
  }
  if (last < text.length) parts.push({ text: text.slice(last), highlight: false })
  return parts.length ? parts : [{ text, highlight: false }]
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
      !looksLikeSystemText(item.translation) &&
      isLearnWordPhrase(item.term) &&
      (!item.translation || isLearnWordPhrase(item.translation)),
  )
  const changed = graduated.changed || items.length !== graduated.items.length
  if (changed) persistLearn(items, graduated.mastered)
  return items
}

export function getMasteredLearnCount(languageCode?: LanguageCode | null): number {
  getLearnList()
  const mastered = readMastered()
  if (!languageCode) return mastered.length
  return mastered.filter((item) => item.languageCode === languageCode).length
}

export function getLearnListStats(languageCode?: LanguageCode | null) {
  const onList = languageCode
    ? getLearnList().filter((item) => item.languageCode === languageCode)
    : getLearnList()
  const removed = getMasteredLearnCount(languageCode)
  return {
    onList: onList.length,
    removed,
    ever: onList.length + removed,
  }
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
  if (!isLearnWordPhrase(term)) return null
  const gloss = isLearnWordPhrase(translation) ? translation : ''
  const key = termKey(term)
  const existing = items.find(
    (item) =>
      item.languageCode === languageCode &&
      (termKey(item.term) === key ||
        termKey(item.translation) === key ||
        (gloss && termKey(item.translation) === termKey(gloss))),
  )
  const now = new Date().toISOString()
  if (existing) {
    if (gloss) existing.translation = gloss.slice(0, 80)
    existing.term = normalizeTerm(term)
    existing.lastReviewedAt = now
    return existing
  }
  const created: LearnListItem = {
    id: crypto.randomUUID(),
    term: normalizeTerm(term),
    translation: gloss.slice(0, 80),
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
    // Prefer a short target-language gloss from Kea's memory signal later;
    // never dump the whole reply sentence onto the Learn List.
    const signalMatch = additions.find(
      (item) => termKey(item.term) === termKey(asked) || termKey(item.translation) === termKey(asked),
    )
    additions.push({
      term: asked,
      translation: signalMatch?.translation || '',
    })
  }

  for (const intrusion of extractNativeIntrusions(options.userText)) {
    additions.push({ term: intrusion, translation: '' })
  }

  for (const addition of additions) {
    // term = native language, translation = target language
    let native = normalizeTerm(addition.term)
    let target = normalizeTerm(addition.translation)
    // If model swapped orientation (target first), flip when clearly Spanish→English.
    if (
      target &&
      looksLikeEnglishToken(native) === false &&
      looksLikeEnglishToken(target)
    ) {
      const swap = native
      native = target
      target = swap
    }
    if (!native || seenAdd.has(termKey(native))) continue
    if (!isLearnWordPhrase(native)) continue
    seenAdd.add(termKey(native))
    const row = upsertLearnItem(
      items,
      options.languageCode,
      native,
      target,
    )
    if (row) addedIds.add(row.id)
  }

  const usedTokens = new Set(
    (options.signals?.used ?? []).map(termKey).filter(Boolean),
  )
  if (
    !looksLikeLearnRequest(options.userText) &&
    !looksLikeLearnListQuizRequest(options.userText)
  ) {
    for (const item of items) {
      if (item.languageCode !== options.languageCode) continue
      if (addedIds.has(item.id)) continue
      // Natural use = saying the target-language word in a real chat turn.
      if (
        (item.translation && hasWord(options.userText, item.translation)) ||
        hasWord(options.userText, item.term)
      ) {
        usedTokens.add(termKey(item.translation || item.term))
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
  const openId = readOpenTopicId()
  let topic = topics.find((item) => item.id === openId && !item.id.startsWith('sample-'))
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
    openChatTopic(topic.id)
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
      openChatTopic(topic.id)
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
  try {
    sessionStorage.setItem(OPEN_TOPIC_KEY, id)
  } catch {
    // ignore
  }
  try {
    localStorage.setItem(OPEN_TOPIC_LOCAL_KEY, id)
  } catch {
    // ignore
  }
}

function readOpenTopicId(): string | null {
  try {
    const sessionId = sessionStorage.getItem(OPEN_TOPIC_KEY)
    if (sessionId) return sessionId
  } catch {
    // ignore
  }
  try {
    return localStorage.getItem(OPEN_TOPIC_LOCAL_KEY)
  } catch {
    return null
  }
}

export function getOpenChatTopic(): ChatTopic | null {
  const id = readOpenTopicId()
  if (!id || id.startsWith('sample-')) return null
  return getChatTopics().find((item) => item.id === id) ?? null
}

export function memoryPromptBlock(userText = '') {
  const need = getLearnMasteryUses()
  const list = getLearnList()
  const learn = list
    .slice(0, 16)
    .map(
      (item) =>
        `- native "${item.term}" → target "${item.translation || '(needed)'}" (used well ${item.practiceCount}/${need})`,
    )
    .join('\n')
  const allTopics = getChatTopics()
  const realTopics = allTopics.filter((item) => !item.id.startsWith('sample-'))
  const topicSource = realTopics.length > 0 ? realTopics : allTopics
  const topics = topicSource
    .slice(0, 12)
    .map((item) => `- ${item.title} / ${item.nativeTitle || item.summary}`)
    .join('\n')
  const open = getOpenChatTopic()
  const openBlock = open
    ? `OPEN TOPIC (continue this chat; do not start a new subject unless the learner changes it):
- ${open.title} / ${open.nativeTitle || open.summary}

`
    : realTopics[0]
      ? `RECENT CHAT (continue from this; do not restart as a first meeting):
- ${realTopics[0].title} / ${realTopics[0].nativeTitle || realTopics[0].summary}

`
      : ''
  const quiz = looksLikeLearnListQuizRequest(userText)
  const quizBlock = quiz
    ? `LEARN LIST QUIZ (user asked to be tested — do this now):
- Work through the Learn List words one at a time.
- For each word, ask one short question that uses the TARGET-language word in a natural sentence (or ask them to say a sentence that must include that word).
- Wait for their answer before moving to the next word.
- Stay friendly, not like a school exam. Keep replies short.
- After each successful natural use, include that target word in the hidden memory "used" array.
- Current words to test:
${learn || '(empty — say the list is empty and invite a normal chat)'}

`
    : ''
  return `${openBlock}${quizBlock}LEARN LIST (single words / short phrases only; never sentences; never mix with topics).
Native language first, target language second. A word leaves after ${need} correct natural uses in the target language:
${learn || '(empty)'}

After your spoken reply, write this hidden block on its own (never speak it, never mention it):
<<<KEA_MEMORY
{"add":[{"term":"native-language word","translation":"target-language word"}],"used":["target-language word already on the list"]}
>>>
Use add when they drop a native-language word into a target-language sentence, or ask how to say a word. Only single words or very short phrases. Use used when they say a Learn List target word correctly in a real sentence. Use empty arrays if nothing happened.

CURRENT CHAT TOPICS (conversation continuity only; never mix with Learn List):
${topics || '(empty)'}`
}
