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

export function looksLikeSystemText(text: string) {
  const lower = text.toLowerCase().replace(/\s+/g, ' ').trim()
  if (!lower) return false
  if (SYSTEM_LEAKS.some((marker) => lower.includes(marker))) return true
  return (
    /\bdo not\b/.test(lower) &&
    /\b(translate|rewrite|transcribe|perfect grammar)\b/.test(lower)
  )
}

export function cleanSpokenText(raw: string): string {
  const pieces = raw
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !looksLikeSystemText(part))
  const text = pieces.join(' ').trim()
  if (!text || looksLikeSystemText(text)) return ''
  return text
}
