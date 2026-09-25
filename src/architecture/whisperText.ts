const SYSTEM_LEAKS = [
  'do not translate',
  'do not rewrite',
  'do not rewrite into perfect grammar',
  'keep mixed-language speech',
  'transcribe faithfully',
  'language learner speaking casually',
  'casual mixed english and spanish',
  '<<<kea_memory',
  'kea_memory',
]

/** Common Whisper inventions for silence / keyboard / room noise. */
const HALLUCINATIONS = [
  /^thank you for watching\.?$/i,
  /^thanks for watching\.?$/i,
  /^thank you so much for watching\.?$/i,
  /^thanks so much for watching\.?$/i,
  /^thank you for listening\.?$/i,
  /^thanks for listening\.?$/i,
  /^thanks for tuning in\.?$/i,
  /^please subscribe\.?$/i,
  /^like and subscribe\.?$/i,
  /^subscribe to (my|the) channel\.?$/i,
  /^see you (next time|later)\.?$/i,
  /^thanks for watching and .*subscribe/i,
  /^subtitles by\b/i,
  /^amara\.org/i,
  /^www\./i,
  /^mbc\b/i,
  /^you\.?$/i,
  /^done\.?$/i,
  /^thank you\.?$/i,
  /^thanks\.?$/i,
  /^thank you so much\.?$/i,
  /^the end\.?$/i,
  /^goodbye\.?$/i,
  /^bye\.?$/i,
  /^okay\.?$/i,
  /^ok\.?$/i,
  /^yes\.?$/i,
  /^no\.?$/i,
  /^please like and subscribe\.?$/i,
  /^don't forget to subscribe\.?$/i,
  /^i'?ll see you in the next (video|one)\.?$/i,
  // Room-noise / empty-room fillers Whisper invents
  /^(silence|quiet|blank|music|applause|laughter|coughing|breathing)([,\s]+\1){1,}\.?$/i,
  /^(silence[\s,.]+){2,}silence\.?$/i,
  /^(uh+|um+|hmm+|ah+|oh+)([,\s]+\1){2,}\.?$/i,
  /^\[?(silence|inaudible|music|blank)\]?\.?$/i,
]

const MIN_TRANSCRIPT_CONFIDENCE = 0.32

export function looksLikeSystemText(text: string) {
  const lower = text.toLowerCase().replace(/\s+/g, ' ').trim()
  if (!lower) return false
  if (SYSTEM_LEAKS.some((marker) => lower.includes(marker))) return true
  return (
    /\bdo not\b/.test(lower) &&
    /\b(translate|rewrite|transcribe|perfect grammar)\b/.test(lower)
  )
}

export function looksLikeWhisperHallucination(text: string) {
  const trimmed = text.replace(/\s+/g, ' ').trim()
  if (!trimmed) return true
  if (HALLUCINATIONS.some((pattern) => pattern.test(trimmed))) return true
  // Same word repeated many times (e.g. "silence silence silence…")
  const tokens = trimmed
    .toLowerCase()
    .split(/[\s,.;:!?]+/)
    .filter(Boolean)
  if (tokens.length >= 4) {
    const first = tokens[0]
    if (tokens.every((token) => token === first)) return true
  }
  // Single letter only (keep short real words like "Si", "no", "ok")
  const bare = trimmed.replace(/[^\p{L}\p{N}]+/gu, '')
  if (bare.length <= 1) return true
  return false
}

/** Drop silence hallucinations and low-confidence noise transcripts. */
export function isUsableSpeechTranscript(
  text: string,
  confidence = 1,
): boolean {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (!cleaned) return false
  if (looksLikeSystemText(cleaned)) return false
  if (looksLikeWhisperHallucination(cleaned)) return false
  const conf = Number.isFinite(confidence)
    ? Math.min(1, Math.max(0, confidence))
    : 1
  // Confidence above 1 from a bad metric is treated as unknown → allow text.
  if (confidence > 0 && confidence <= 1 && conf < MIN_TRANSCRIPT_CONFIDENCE) {
    return false
  }
  return true
}

export function cleanSpokenText(raw: string): string {
  const pieces = raw
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !looksLikeSystemText(part))
    .filter((part) => !looksLikeWhisperHallucination(part))
  const text = pieces.join(' ').trim()
  if (!text || looksLikeSystemText(text) || looksLikeWhisperHallucination(text)) {
    return ''
  }
  return text
}
