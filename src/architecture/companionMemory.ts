import { getLearnMasteryUses } from '../data/keaLearnMastery'
import {
  lastChatRecallPromptBlock,
  preferTopicLabel,
  subjectPhrase,
} from './keaChatRecall'
import { loadTalkScreen, loadTalkTranscript } from './keaTalkMemory'
import { looksLikeSystemText } from './whisperText'
import {
  localDayKey,
  recordWordsAdded,
  recordWordsRemoved,
} from './keaTalkPerformance'
import type {
  ChatTopic,
  LanguageCode,
  LearnListItem,
  TranscriptMessage,
} from '../types'

const LEARN_KEY = 'kea-learn-list'
const MASTERED_KEY = 'kea-learn-mastered'
const TOPICS_KEY = 'kea-chat-topics'
const OPEN_TOPIC_KEY = 'kea-open-topic-id'
const OPEN_TOPIC_LOCAL_KEY = 'kea-open-topic-id-v1'
const CHANGE_EVENT = 'kea-learn-memory'

const LEARN_REQUEST =
  /how (do you|do i|to) say|what does .+ mean|c[oó]mo se dice|wie sagt man|comment dit[- ]on|как сказать|translate|what is the (word|difference)|ser vs estar|subjunctive|grammar|help me (say|express)|why (do|does) (we|you|they) say|\b(add|put|save|stick)\b.+\b(learn\s*list|my list|the list)\b|\bremember (the )?(word|phrase)\b|\badd .+ to (my )?list\b|\b(save|add|put|stick)\s+(this|that|it)\b|\b(save|add|remember)\s+(this|that|the)\s+(word|phrase)\b/i

const LEARN_LIST_QUIZ =
  /\b(test|quiz|practi[sc]e|drill|examine)\s+me\b|\b(test|quiz|practi[sc]e)\s+(my\s+)?(words|vocabulary|vocab|list)\b|\blearn\s*list\b.*\b(test|quiz|practi[sc]e|drill|review)\b|\b(test|quiz|practi[sc]e|drill|review)\b.*\blearn\s*list\b|\bgo through (my )?(words|list)\b|\bhelp me (review|practi[sc]e)\b|\bexam[ií]name\b|\bponme a prueba\b|\brepasemos\b/i

/** End an active Learn List quiz without killing the whole talk session. */
const LEARN_LIST_QUIZ_STOP =
  /\b(stop|end|cancel|quit)\s+(the\s+)?(test|quiz|practi[sc]e|drill|exam)\b|\b(stop|enough|basta)\b.*\b(test|quiz|practi[sc]e|testing|quizzing)\b|\b(that('|’)s|thats)\s+enough\b|\bno\s+more\s+(words|questions|testing|quiz)\b|\blet('|’)s\s+stop\b|\bfinish(ed)?\s+(the\s+)?(test|quiz|list)\b/i

/** Leave quiz mode when the learner clearly pivots back to normal chat. */
const LEARN_LIST_QUIZ_ABANDON =
  /\b(let('|’)s talk|talk about|change (the )?subject|something else|different topic)\b/i

/** Keep quiz mode when they pass / admit they do not know — reveal, then continue. */
const LEARN_LIST_QUIZ_DONT_KNOW =
  /\b(i\s+don('|’)t\s+know|don('|’)t\s+know|no\s+lo\s+s[eé]|no\s+s[eé]|no\s+idea|pass|skip(?:\s+it)?|not\s+sure)\b/i

const LEARN_QUIZ_ACTIVE_KEY = 'kea-learn-quiz-active-v1'

const ASK_TERM =
  /(?:how (?:do (?:you|i)|to) say|what does|c[oó]mo se dice|wie sagt man|comment dit[- ]on|как сказать)\s+["«“']?([^?"»”']+)/i

/** “Add rain to my Learn List” / “save the word sky on the list”. */
const ADD_TO_LEARN_LIST =
  /\b(?:add|put|save|stick)\s+(?:the\s+(?:word|phrase)\s+)?["«“']?(.+?)["»”']?\s+(?:to|on|onto|in)\s+(?:my\s+)?(?:the\s+)?(?:learn\s*)?list\b/i

const ADD_WORD_REMEMBER =
  /\b(?:remember|save|add)\s+(?:the\s+|this\s+|that\s+)?(?:word|phrase)(?:\s+["«“']?([^?"»”'.!,;:]+)["»”']?)?/i

/** “Save this word”, “add that to the list”, “put it on my learn list”. */
const SAVE_DEMONSTRATIVE =
  /\b(?:save|add|put|stick|remember)\s+(?:this|that|it)(?:\s+(?:word|phrase))?(?:\s+(?:to|on|onto|in)\s+(?:my\s+)?(?:the\s+)?(?:learn\s*)?list)?\b|\b(?:save|add|remember)\s+(?:the\s+)?(?:word|phrase)\s*$/i

const QUOTED_TERM =
  /["«“']([^\s"»”']{2,42})["»”']/g

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
    'estoy', 'estas', 'estás', 'estamos', 'gusta', 'gustan', 'comprar', 'comer',
    'beber', 'vivir', 'casa', 'perro', 'amigo', 'amiga', 'trabajo', 'comida',
    'tiempo', 'gente', 'siempre', 'nunca', 'pero', 'algo', 'nada', 'todo',
    'todos', 'estas', 'estos', 'desde', 'hasta', 'despues', 'después', 'antes',
    'entonces', 'claro', 'vale', 'verdad', 'tarde', 'agua', 'cafe', 'café',
    'calle', 'ciudad', 'viaje', 'dinero', 'problema', 'pregunta', 'hablando',
    'comiendo', 'tienes', 'tiene', 'tenemos', 'podemos', 'puedes', 'quiero',
    'haciendo', 'diciendo', 'viendo', 'yendo', 'estaba', 'estaban', 'mucho',
    'poco', 'bien', 'tambien', 'también', 'porque', 'cuando', 'donde', 'dónde',
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
    'the', 'and', 'but', 'with', 'from', 'this', 'that', 'what', 'when',
    'where', 'your', 'have', 'just', 'like', 'time', 'good', 'very', 'much',
    'some', 'they', 'was', 'were', 'will', 'would', 'could', 'should', 'said',
    'say', 'get', 'got', 'make', 'made', 'going', 'come', 'came', 'look',
    'see', 'saw', 'tell', 'told', 'thing', 'things', 'way', 'day', 'year',
    'week', 'home', 'back', 'only', 'even', 'still', 'well', 'here', 'there',
    'then', 'than', 'into', 'over', 'other', 'another', 'first', 'new', 'old',
    'big', 'little', 'long', 'same', 'different', 'own', 'off', 'out', 'down',
    'how', 'why', 'who', 'yes', 'football', 'soccer', 'fish',
    'book', 'books', 'table', 'chair', 'name', 'milk', 'apple', 'pen', 'bag',
    'umbrella', 'sandwich', 'orange', 'banana', 'chicken', 'apartment',
    'hospital', 'keyboard', 'laptop', 'bottle',
    'red', 'blue', 'green', 'black', 'white', 'outside', 'inside', 'using',
    'buying', 'writing', 'drinking', 'talking', 'walking', 'running', 'working',
    'living', 'sitting', 'standing', 'playing', 'looking', 'reading', 'eating',
    'speaking', 'actually', 'nothing', 'everything', 'someone', 'together',
    'already', 'usually', 'often', 'almost', 'enough', 'around', 'without',
    'during', 'while', 'until', 'street', 'bread', 'shirt', 'shoes', 'room',
    'door', 'bed', 'car', 'bus', 'train',
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

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Match a Learn List target form in speech — allows short words like "sé" / "tú". */
function hasLearnTarget(haystack: string, needle: string) {
  const n = normalizeTerm(needle)
  if (n.length < 2) return false
  return hasExactPhrase(haystack, n)
}

function hasExactPhrase(haystack: string, needle: string) {
  const re = new RegExp(
    `(?:^|[^\\p{L}\\p{N}])${escapeRegExp(needle)}(?:$|[^\\p{L}\\p{N}])`,
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
  return hits >= 1
}

/** Consonant patterns Spanish words almost never use. */
const ENGLISH_SHAPE = /(?:th|sh|wh|ck|gh|ph|wr|kn|oo|ee|ea|ou|ow|ay|igh)/i

function looksLikeEnglishToken(token: string) {
  const key = token.toLowerCase()
  if (key.length < 3) return false
  if (SPANISH_COMMON.has(key)) return false
  if (/[áéíóúñü]/i.test(token)) return false
  if (!/^[a-zA-Z']+$/.test(token)) return false
  if (ENGLISH_FALLBACK.has(key)) return true
  if (ENGLISH_SHAPE.test(key)) return true
  // w/k are rare in Spanish spelling; a tap-free content word with them is English.
  if (key.length >= 3 && /[wk]/i.test(key)) return true
  // Spanish words almost never end in these consonants.
  if (key.length >= 4 && /[bcdfgkmptvw]$/i.test(key)) return true
  // Spanish does not use the English -ing / -tion ending.
  return key.length >= 5 && /(ing|tion|sion|ness)$/i.test(key)
}

/** Spanish words long enough that they are not also everyday English. */
function strongSpanishCount(text: string): number {
  if (/[¿¡]/i.test(text)) return 1
  const tokens = text.toLowerCase().match(/[\p{L}']+/gu) ?? []
  let hits = 0
  for (const token of tokens) {
    if (/[áéíóúñü]/i.test(token)) {
      hits += 1
      continue
    }
    if (token.length >= 4 && SPANISH_COMMON.has(token)) hits += 1
  }
  return hits
}

export type NativeIntrusionAnalysis = {
  /** Every native-language slip to paint red in the chat line. */
  highlights: string[]
  /** One key word per contiguous slip group — saved on the Learn List. */
  keyTerms: string[]
}

type SlipHit = { token: string; start: number; end: number }

function pickKeyTermFromGroup(group: string[]): string {
  const content = group.filter((token) => {
    const key = token.toLowerCase()
    return key.length >= 3 && !ENGLISH_SHORT.has(key)
  })
  const pool = content.length ? content : group
  return [...pool].sort((a, b) => b.length - a.length || a.localeCompare(b))[0] || ''
}

/**
 * Native-language (English) words dropped into a learn-language sentence.
 * Every native slip is painted red in place. Content words are saved on the
 * Learn List. A whole native-language sentence returns nothing.
 */
export function analyzeNativeIntrusions(text: string): NativeIntrusionAnalysis {
  const empty: NativeIntrusionAnalysis = { highlights: [], keyTerms: [] }
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (!cleaned || looksLikeSystemText(cleaned)) return empty
  // A whole native sentence stays unpainted. A learn-language sentence keeps
  // its native slips even when several English words sit in the middle.
  if (isPrimarilyNativeEnglish(cleaned)) return empty
  if (!hasSpanishContext(cleaned) && strongSpanishCount(cleaned) < 1) {
    return empty
  }

  const hits: SlipHit[] = []
  for (const match of cleaned.matchAll(/[A-Za-zÀ-ÿ']+/g)) {
    const token = match[0]
    if (!looksLikeEnglishToken(token)) continue
    const start = match.index ?? 0
    hits.push({ token, start, end: start + token.length })
  }
  for (const match of cleaned.matchAll(/["«“']([A-Za-z']{3,})["»”']/g)) {
    const token = match[1]
    if (!token || !looksLikeEnglishToken(token)) continue
    const start = (match.index ?? 0) + 1
    hits.push({ token, start, end: start + token.length })
  }
  hits.sort((a, b) => a.start - b.start || b.end - a.end)

  const uniqueHits: SlipHit[] = []
  const seenSpan = new Set<string>()
  for (const hit of hits) {
    const span = `${hit.start}:${hit.end}`
    if (seenSpan.has(span)) continue
    seenSpan.add(span)
    uniqueHits.push(hit)
  }
  if (!uniqueHits.length) return empty

  const groups: SlipHit[][] = []
  for (const hit of uniqueHits) {
    const prev = groups[groups.length - 1]
    const last = prev?.[prev.length - 1]
    // Same group when only spaces sit between native slips.
    const joinsPrior =
      Boolean(last) &&
      (hit.start <= last!.end + 1 ||
        /^\s+$/.test(cleaned.slice(last!.end, hit.start)))
    if (joinsPrior && prev) {
      prev.push(hit)
    } else {
      groups.push([hit])
    }
  }

  const highlights: string[] = []
  const keyTerms: string[] = []
  const seenHighlight = new Set<string>()
  const seenKey = new Set<string>()
  for (const group of groups) {
    for (const hit of group) {
      const term = normalizeTerm(hit.token)
      const key = termKey(term)
      if (!key || seenHighlight.has(key)) continue
      seenHighlight.add(key)
      highlights.push(term)
    }
    const keyTerm = normalizeTerm(
      pickKeyTermFromGroup(group.map((hit) => hit.token)),
    )
    const key = termKey(keyTerm)
    if (!key || seenKey.has(key) || !isLearnWordPhrase(keyTerm)) continue
    seenKey.add(key)
    keyTerms.push(keyTerm)
  }
  return { highlights, keyTerms }
}

/** All native slips in a learn-language line (for red highlighting). */
export function extractNativeIntrusions(text: string): string[] {
  return analyzeNativeIntrusions(text).highlights
}

/** Key word from each contiguous slip group (for the Learn List). */
export function keyNativeIntrusions(text: string): string[] {
  return analyzeNativeIntrusions(text).keyTerms
}

const ENGLISH_SHORT = new Set(
  [
    'i', 'a', 'to', 'we', 'me', 'my', 'am', 'is', 'be', 'or', 'of', 'in', 'on',
    'at', 'it', 'do', 'an', 'as', 'so', 'if', 'ok', 'for', 'you', 'the', 'and',
    'but', 'not', 'can', 'was', 'are', 'our', 'all', 'too', 'yes', 'hi', 'hey',
    'okay', 'im', "i'm", 'ive', "i've", 'ill', "i'll", 'id', "i'd", 'dont',
    "don't", 'did', 'had', 'has', 'have', 'its', "it's", 'lets', "let's",
  ].map((w) => w.toLowerCase()),
)

/**
 * True when the line is mostly English / native, not a Spanish sentence with
 * a few borrowed words. Used to flip display: translate into the learn language
 * first, keep the original as the yellow caption.
 */
export function isPrimarilyNativeEnglish(text: string): boolean {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (!cleaned) return false
  // One clear Spanish word means this is a learn-language line with slips,
  // not a native sentence — even when several English words sit in it.
  if (strongSpanishCount(cleaned) >= 1) return false
  const tokens = cleaned.toLowerCase().match(/[a-z']+/g) ?? []
  if (tokens.length < 2) return false
  let spanish = 0
  let english = 0
  for (const token of tokens) {
    if (SPANISH_COMMON.has(token)) {
      spanish += 1
      continue
    }
    if (
      looksLikeEnglishToken(token) ||
      ENGLISH_FALLBACK.has(token) ||
      ENGLISH_SHORT.has(token)
    ) {
      english += 1
    }
  }
  if (spanish >= 2) return false
  if (spanish >= 1 && english <= spanish + 1) return false
  return english >= Math.max(2, Math.ceil(tokens.length * 0.55))
}

export function looksLikeLearnRequest(text: string) {
  if (looksLikeSystemText(text)) return false
  return LEARN_REQUEST.test(text)
}

export function looksLikeLearnListQuizRequest(text: string) {
  if (looksLikeSystemText(text)) return false
  return LEARN_LIST_QUIZ.test(text)
}

export function looksLikeLearnListQuizStop(text: string) {
  if (looksLikeSystemText(text)) return false
  return LEARN_LIST_QUIZ_STOP.test(text)
}

export function isLearnListQuizActive() {
  try {
    return sessionStorage.getItem(LEARN_QUIZ_ACTIVE_KEY) === '1'
  } catch {
    return false
  }
}

export function startLearnListQuiz() {
  try {
    sessionStorage.setItem(LEARN_QUIZ_ACTIVE_KEY, '1')
  } catch {
    // ignore
  }
}

export function endLearnListQuiz() {
  try {
    sessionStorage.removeItem(LEARN_QUIZ_ACTIVE_KEY)
  } catch {
    // ignore
  }
}

/**
 * Keep quiz mode on for every answer turn after “test me”, until stop / empty list.
 * Without this, only the first request turn got the quiz prompt and Kea dropped out.
 */
export function syncLearnListQuizSession(userText: string, listLength: number) {
  if (looksLikeLearnListQuizStop(userText)) {
    endLearnListQuiz()
    return false
  }
  if (looksLikeLearnListQuizRequest(userText)) {
    if (listLength <= 0) {
      endLearnListQuiz()
      return false
    }
    startLearnListQuiz()
    return true
  }
  if (!isLearnListQuizActive()) return false
  if (listLength <= 0) {
    endLearnListQuiz()
    return false
  }
  // "I don't know" is a valid quiz answer — stay in quiz and let Kea reveal, then continue.
  if (LEARN_LIST_QUIZ_DONT_KNOW.test(userText)) return true
  const words = userText.trim().split(/\s+/).filter(Boolean)
  if (LEARN_LIST_QUIZ_ABANDON.test(userText) || words.length >= 18) {
    endLearnListQuiz()
    return false
  }
  return true
}

function askedTerm(userText: string) {
  const hit = userText.match(ASK_TERM)
  if (hit?.[1]) {
    const term = normalizeTerm(hit[1])
    return isLearnWordPhrase(term) ? term : ''
  }
  return ''
}

/** Pull a concrete word from Kea's reply when the learner says “save this”. */
function resolveDemonstrativeTerm(keaReply: string, userText: string): string {
  const fromReply: string[] = []
  for (const match of keaReply.matchAll(QUOTED_TERM)) {
    if (match[1]) fromReply.push(match[1])
  }
  // Prefer the last quoted term in Kea's line ("… means «lluvia»").
  for (let i = fromReply.length - 1; i >= 0; i--) {
    const term = normalizeTerm(fromReply[i])
    if (isLearnWordPhrase(term)) return term
  }
  // Bold/italic style markers some models emit: *word* or _word_
  const marked = keaReply.match(/[*_]{1,2}([^\s*_.,;:?!]{2,42})[*_]{1,2}/)
  if (marked?.[1] && isLearnWordPhrase(marked[1])) {
    return normalizeTerm(marked[1])
  }
  // “the word X” / “la palabra X” in Kea's reply
  const labeled = keaReply.match(
    /\b(?:word|phrase|palabra|mot|wort|слово)\s+["«“']?([^\s"»”'.,;:?!]{2,42})/i,
  )
  if (labeled?.[1] && isLearnWordPhrase(labeled[1])) {
    return normalizeTerm(labeled[1])
  }
  // Last highlighted native intrusion from the learner's prior phrasing in this turn.
  const slips = extractNativeIntrusions(userText)
  if (slips.length) return slips[slips.length - 1]
  return ''
}

function requestedLearnListTerms(userText: string, keaReply = ''): string[] {
  const found: string[] = []
  const seen = new Set<string>()
  const push = (raw: string) => {
    const term = normalizeTerm(raw.replace(/^["«“']+|["»”']+$/g, ''))
    if (!isLearnWordPhrase(term)) return
    // Skip bare demonstratives — resolve those from Kea's reply instead.
    if (/^(this|that|it)(\s+(word|phrase))?$/i.test(term)) return
    const key = termKey(term)
    if (seen.has(key)) return
    seen.add(key)
    found.push(term)
  }
  const asked = askedTerm(userText)
  if (asked) push(asked)
  const addHit = userText.match(ADD_TO_LEARN_LIST)
  if (addHit?.[1]) push(addHit[1])
  const rememberHit = userText.match(ADD_WORD_REMEMBER)
  if (rememberHit?.[1]) push(rememberHit[1])
  if (SAVE_DEMONSTRATIVE.test(userText) || /\b(this|that|it)\b/i.test(addHit?.[1] ?? '')) {
    const resolved = resolveDemonstrativeTerm(keaReply, userText) || recentLearnTerm()
    if (resolved) push(resolved)
  }
  return found
}

/** Word the learner means by “save this” when this turn does not name it. */
function recentLearnTerm() {
  const screen = loadTalkScreen()
  for (let index = screen.length - 1; index >= 0 && index >= screen.length - 8; index -= 1) {
    const text = screen[index]?.text ?? ''
    const slips = keyNativeIntrusions(text)
    if (slips.length) return slips[slips.length - 1]
    const quoted = [...text.matchAll(QUOTED_TERM)]
    const last = quoted.length ? normalizeTerm(quoted[quoted.length - 1]?.[1] ?? '') : ''
    if (last && isLearnWordPhrase(last)) return last
  }
  return ''
}

function foldKey(value: string) {
  return normalizeTerm(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

const OPEN_QUOTE = /["“‘'«]$/
const CLOSE_QUOTE = /^["”’'»]/

/** Drop the quotes Kea puts on either side of a highlighted word. */
function stripQuotesAroundHighlights(
  parts: Array<{ text: string; highlight: boolean }>,
) {
  const next = parts.map((part) => ({ ...part }))
  for (let index = 0; index < next.length; index += 1) {
    if (!next[index].highlight) continue
    const before = next[index - 1]
    const after = next[index + 1]
    if (!before || !after || before.highlight || after.highlight) continue
    if (!OPEN_QUOTE.test(before.text) || !CLOSE_QUOTE.test(after.text)) continue
    before.text = before.text.slice(0, -1)
    after.text = after.text.slice(1)
  }
  return next.filter((part) => part.text.length > 0)
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
  const re = new RegExp(`(?<![\\p{L}\\p{N}])(?:${pattern})(?![\\p{L}\\p{N}])`, 'giu')
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
  const marked = parts.length ? parts : [{ text, highlight: false }]
  return stripQuotesAroundHighlights(marked)
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

/**
 * Safety net: if quiz mode is on and Kea asks a word then gives that word's
 * answer in the same reply, drop everything after the last question.
 * Corrections for a previous word (text before that question) stay intact.
 */
export function sanitizeLearnListQuizReply(
  reply: string,
  list: Array<{ term: string; translation: string }> = getLearnList(),
): string {
  if (!isLearnListQuizActive() || !reply.trim() || list.length === 0) return reply
  const questionMatches = [...reply.matchAll(/[¿¡]?[^.!?\n]*[?？]/g)]
  if (questionMatches.length === 0) return reply
  const lastQ = questionMatches[questionMatches.length - 1]
  const lastQEnd = (lastQ.index ?? 0) + lastQ[0].length
  const afterQ = reply.slice(lastQEnd)
  if (!afterQ.trim()) return reply
  return reply.slice(0, lastQEnd).trim()
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
  const finish = (text: string) =>
    spaceFinalQuestion(sanitizeLearnListQuizReply(text.trim()))
  if (!match) return { reply: finish(raw), signals: empty }
  const reply = finish(raw.replace(MEMORY_BLOCK, ''))
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
  // Demo rows used to be merged back in after every read, so a mastered
  // sample word could never leave the list.
  const real = stored.filter((item) => item && !String(item.id).startsWith('sample-'))
  if (real.length !== stored.length) writeJson(LEARN_KEY, real)
  return real
}

function readMastered(): MasteredLearnItem[] {
  return readJson<MasteredLearnItem[]>(MASTERED_KEY, [])
}

let learnCloudPush: ((items: LearnListItem[]) => void) | null = null
let applyingCloudLearn = false

/** Session layer pushes the Learn List to Supabase after each local save. */
export function setLearnCloudPush(push: ((items: LearnListItem[]) => void) | null) {
  learnCloudPush = push
}

function persistLearn(items: LearnListItem[], mastered = readMastered()) {
  writeJson(LEARN_KEY, items)
  writeJson(MASTERED_KEY, mastered)
  notifyLearnMemory()
  if (!applyingCloudLearn) learnCloudPush?.(items)
}

/** Fold cloud rows into the device list. Cloud practice and glosses win ties. */
export function mergeCloudLearnItems(incoming: LearnListItem[]) {
  const local = readLearnList().filter((item) => !item.id.startsWith('sample-'))
  const byKey = new Map<string, LearnListItem>()
  for (const item of local) {
    byKey.set(`${item.languageCode}:${termKey(item.term)}`, item)
  }
  for (const item of incoming) {
    if (!item.term.trim() || item.id.startsWith('sample-')) continue
    const key = `${item.languageCode}:${termKey(item.term)}`
    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, item)
      continue
    }
    existing.practiceCount = Math.max(existing.practiceCount, item.practiceCount)
    if (!existing.translation.trim() && item.translation.trim()) {
      existing.translation = item.translation
    }
    if (item.lastReviewedAt > existing.lastReviewedAt) {
      existing.lastReviewedAt = item.lastReviewedAt
    }
    existing.status =
      existing.practiceCount >= getLearnMasteryUses() - 1 ? 'reinforced' : 'learning'
  }
  applyingCloudLearn = true
  try {
    const graduated = graduateReady([...byKey.values()], readMastered())
    persistLearn(graduated.items, graduated.mastered)
  } finally {
    applyingCloudLearn = false
  }
}

function graduateReady(items: LearnListItem[], mastered: MasteredLearnItem[]) {
  const need = getLearnMasteryUses()
  const keep: LearnListItem[] = []
  let changed = false
  const now = new Date().toISOString()
  let removed = 0
  for (const item of items) {
    if (item.practiceCount >= need) {
      changed = true
      removed += 1
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
  if (removed > 0 && !applyingCloudLearn) {
    recordWordsRemoved(removed, localDayKey(new Date(now)))
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

export function getMasteredLearnItems(): MasteredLearnItem[] {
  getLearnList()
  return readMastered()
}

export function getMasteredLearnCount(languageCode?: LanguageCode | null): number {
  const mastered = getMasteredLearnItems()
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

/** Drop chosen rows. Supabase removes the same rows on the next cloud push. */
export function removeLearnItems(ids: string[]) {
  const drop = new Set(ids)
  if (drop.size === 0) return
  const items = readLearnList().filter((item) => !drop.has(item.id))
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
  if (!applyingCloudLearn) {
    recordWordsAdded(1, localDayKey(new Date(now)))
  }
  return created
}

function markUsed(
  items: LearnListItem[],
  languageCode: LanguageCode,
  token: string,
  skipIds: Set<string>,
  options?: { quizCorrect?: boolean },
) {
  const key = termKey(token)
  if (!key) return
  const item = items.find((entry) => {
    if (entry.languageCode !== languageCode || skipIds.has(entry.id)) return false
    const target = termKey(entry.translation)
    const native = termKey(entry.term)
    // Prefer the target-language form; also accept the native term if the model
    // put that in "used" (same row still means one good use of that word).
    return (target && target === key) || native === key
  })
  if (!item) return
  if (options?.quizCorrect) {
    // One correct quiz answer is enough — graduateReady drops it this turn.
    item.practiceCount = Math.max(item.practiceCount, getLearnMasteryUses())
    item.status = 'reinforced'
  } else {
    item.practiceCount += 1
    item.status =
      item.practiceCount >= getLearnMasteryUses() - 1 ? 'reinforced' : 'learning'
  }
  item.lastReviewedAt = new Date().toISOString()
}

/** Short quiz reply that is the native or target form of a Learn List row. */
function quizAnswerItem(
  userText: string,
  items: LearnListItem[],
  languageCode: LanguageCode,
): LearnListItem | null {
  const answer = userText
    .replace(/[.!?¿¡,;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(
      /^(it is|it's|its|that is|that's|the word is|i think|se dice|es|means|significa)\s+/i,
      '',
    )
    .trim()
  if (!answer) return null
  const words = answer.split(/\s+/).filter(Boolean)
  if (words.length > 8) return null
  const key = foldKey(answer)
  const hits = items.filter((item) => {
    if (item.languageCode !== languageCode) return false
    const native = foldKey(item.term)
    const target = foldKey(item.translation)
    if (key && (key === native || (target && key === target))) return true
    if (hasExactPhrase(answer, item.term)) return true
    return Boolean(item.translation && hasExactPhrase(answer, item.translation))
  })
  return hits.length === 1 ? hits[0] : null
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
  for (const term of requestedLearnListTerms(
    options.userText,
    options.keaReply,
  )) {
    const signalMatch = additions.find(
      (item) =>
        termKey(item.term) === termKey(term) ||
        termKey(item.translation) === termKey(term),
    )
    // Pair a bare term with a translation gleaned from Kea's reply when needed.
    let translation = signalMatch?.translation || ''
    if (!translation && options.keaReply) {
      const quoted = [...options.keaReply.matchAll(QUOTED_TERM)]
        .map((m) => normalizeTerm(m[1] ?? ''))
        .filter((t) => t && termKey(t) !== termKey(term) && isLearnWordPhrase(t))
      if (quoted.length) translation = quoted[quoted.length - 1]
    }
    additions.push({
      term,
      translation,
    })
  }

  // Every red native word in a learn-language sentence, except short
  // function words such as "the" and "and".
  for (const intrusion of extractNativeIntrusions(options.userText)) {
    if (ENGLISH_SHORT.has(termKey(intrusion))) continue
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
    !looksLikeLearnListQuizRequest(options.userText) &&
    !isLearnListQuizActive()
  ) {
    for (const item of items) {
      if (item.languageCode !== options.languageCode) continue
      if (addedIds.has(item.id)) continue
      // Natural use = saying the learn-language (+LL) form in a real chat turn.
      const ll =
        item.translation && !looksLikeEnglishToken(item.translation)
          ? item.translation
          : looksLikeEnglishToken(item.term)
            ? ''
            : item.term
      if (ll && hasLearnTarget(options.userText, ll)) {
        usedTokens.add(termKey(ll))
      }
    }
  }

  const quizTurn =
    isLearnListQuizActive() &&
    !looksLikeLearnListQuizRequest(options.userText) &&
    !LEARN_LIST_QUIZ_DONT_KNOW.test(options.userText) &&
    !looksLikeLearnListQuizStop(options.userText)
  const quizMatch = quizTurn
    ? quizAnswerItem(options.userText, items, options.languageCode)
    : null
  if (quizMatch) {
    // One correct quiz answer removes that row now. Other words stay.
    const token = quizMatch.translation || quizMatch.term
    if (token) {
      markUsed(items, options.languageCode, token, addedIds, {
        quizCorrect: true,
      })
    }
  }

  if (!quizTurn) {
    for (const token of usedTokens) {
      markUsed(items, options.languageCode, token, addedIds)
    }
  }

  const graduated = graduateReady(items, readMastered())
  persistLearn(graduated.items, graduated.mastered)
}

export function rememberLearnGloss(id: string, translation: string) {
  const gloss = normalizeTerm(translation)
  if (!isLearnWordPhrase(gloss)) return
  const items = readLearnList()
  const item = items.find((entry) => entry.id === id)
  if (!item || item.translation.trim()) return
  item.translation = gloss.slice(0, 80)
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
  const userSubject = subjectPhrase(userText) || topicLine(userText)
  const keaSubject = subjectPhrase(keaReply) || topicLine(keaReply)
  const learnt = keaSubject || userSubject
  const native = userSubject || keaSubject
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
      // Keep a stable subject; only upgrade labels when the new phrase is clearer.
      topic.title = preferTopicLabel(topic.title, learnt)
      topic.nativeTitle = preferTopicLabel(topic.nativeTitle, native)
      topic.summary = preferTopicLabel(topic.summary, native)
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

export function memoryPromptBlock(
  userText = '',
  recentMessages?: TranscriptMessage[],
) {
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
  const recallMessages =
    recentMessages && recentMessages.length > 0
      ? recentMessages
      : loadTalkTranscript()
  const recallBlock = lastChatRecallPromptBlock(recallMessages, {
    openTopic: open,
    recentTopics: topicSource,
  })
  const quiz = syncLearnListQuizSession(userText, list.length)
  const quizBlock = quiz
    ? `LEARN LIST QUIZ — HIGHEST PRIORITY (ignore casual chat / open topics until the quiz ends):
You are running a vocabulary test. Stay in quiz mode until they say stop, or every word below has been asked.

Rules for EVERY quiz reply:
1. Ask at most ONE new question per reply.
2. NEVER reveal the answer to a question in the same reply that asks it. No translations, no "it is…", no hints that give the word away, until they have tried.
3. Mix the direction at random, about half and half, and do not stick to one direction:
   - Sometimes ask how to say the native-language word in the learning language.
   - Sometimes ask how to say the learning-language word in their native language.
4. If this turn is only starting the quiz or asking the next word: speak ONLY the question (plus a tiny warm lead-in if needed). Then stop and wait.
5. If they just answered:
   - Correct: brief praise, then ask the NEXT question (question only — do not give that next answer). That word leaves the Learn List.
   - Wrong: briefly give the correct word for the one they missed, then ask the NEXT question (question only). Leave that word on the list.
   - They say they do not know / no sé / no idea / pass: tell them the correct word briefly, then ask the NEXT question (question only). Leave that word on the list.
6. Do not end after one question. Continue through the list below.
7. End only if they say stop / enough / no more, or the list is finished.
8. Keep replies short. Friendly, not teacherly.

Words to test (native → target):
${learn || '(empty — say the list is empty, end the quiz, invite a normal chat)'}

`
    : ''
  // During quiz, do not inject open-topic / recall — they pull Kea off the test.
  const contextPrefix = quiz ? '' : `${openBlock}${recallBlock}`
  return `${contextPrefix}${quizBlock}LEARN LIST (single words / short phrases only; never sentences; never mix with topics).
Native language first, target language second. A word leaves after ${need} correct natural uses in the target language:
${learn || '(empty)'}

After your spoken reply, write this hidden block on its own (never speak it, never mention it):
<<<KEA_MEMORY
{"add":[{"term":"native-language word","translation":"target-language word"}],"used":["target-language word already on the list"]}
>>>
Use add when they drop a native-language word into a target-language sentence, ask how to say a word, or clearly ask to add/save/put a word on the Learn List. Only single words or very short phrases. Use used every time they say a Learn List target word correctly in a real sentence (put the target-language form, or the native form if you are unsure). This is how words leave the list after ${need} good uses — do not skip used when they got it right. Use empty arrays if nothing happened.
${
  quiz
    ? `
During LEARN LIST QUIZ: put the target-language form (or the native form) in "used" only when they answered that quiz item correctly. A correct answer removes that word from the Learn List immediately. A wrong answer or "I don't know" must NOT go in "used". Do not add new words during the quiz unless they clearly ask to save one.
`
    : ''
}
CURRENT CHAT TOPICS (conversation continuity only; never mix with Learn List):
${quiz ? '(paused — quiz in progress)' : topics || '(empty)'}`
}
