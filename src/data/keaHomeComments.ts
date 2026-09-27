/** Admin-managed home page user comments (device-stored). */

const STORAGE_KEY = 'kea-home-comments-v1'

export interface KeaHomeComment {
  id: string
  /** Main quote text (without surrounding quotation marks). */
  quote: string
  /** e.g. "SH with Spanish" */
  attribution: string
  enabled: boolean
}

export const DEFAULT_HOME_COMMENTS: KeaHomeComment[] = [
  {
    id: 'c1',
    quote:
      'I used normal teaching apps for over a year and was still scared to speak to people - after 2 weeks with Kea now I talk confidently.',
    attribution: 'SH with Spanish',
    enabled: true,
  },
  {
    id: 'c2',
    quote:
      'Getting sent back to the beginning and forever being taught about greetings was driving me crazy. Now i can discuss golf with Kea.',
    attribution: 'DH with French',
    enabled: true,
  },
  {
    id: 'c3',
    quote: "Streak and emogii's, no thanks. The joy of a good chat's far better.",
    attribution: 'IH with Russian',
    enabled: true,
  },
  {
    id: 'c4',
    quote: "I'm at last having fun learning a language!",
    attribution: 'CH with Spanish',
    enabled: true,
  },
]

function newId() {
  return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

function normalize(list: unknown): KeaHomeComment[] {
  if (!Array.isArray(list)) return structuredClone(DEFAULT_HOME_COMMENTS)
  const cleaned = list
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null
      const row = item as Partial<KeaHomeComment>
      const quote = typeof row.quote === 'string' ? row.quote.trim() : ''
      const attribution =
        typeof row.attribution === 'string' ? row.attribution.trim() : ''
      if (!quote && !attribution) return null
      return {
        id:
          typeof row.id === 'string' && row.id.trim()
            ? row.id.trim()
            : `legacy-${index}`,
        quote,
        attribution,
        enabled: row.enabled !== false,
      } satisfies KeaHomeComment
    })
    .filter((item): item is KeaHomeComment => item != null)
  return cleaned.length > 0 ? cleaned : structuredClone(DEFAULT_HOME_COMMENTS)
}

export function loadHomeComments(): KeaHomeComment[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return structuredClone(DEFAULT_HOME_COMMENTS)
    return normalize(JSON.parse(raw) as unknown)
  } catch {
    return structuredClone(DEFAULT_HOME_COMMENTS)
  }
}

export function saveHomeComments(comments: KeaHomeComment[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(comments))
}

export function resetHomeComments() {
  localStorage.removeItem(STORAGE_KEY)
  return structuredClone(DEFAULT_HOME_COMMENTS)
}

export function getEnabledHomeComments(): KeaHomeComment[] {
  return loadHomeComments().filter(
    (item) => item.enabled && item.quote.trim().length > 0,
  )
}

export function createHomeComment(
  partial?: Partial<KeaHomeComment>,
): KeaHomeComment {
  return {
    id: newId(),
    quote: partial?.quote?.trim() ?? '',
    attribution: partial?.attribution?.trim() ?? '',
    enabled: partial?.enabled ?? true,
  }
}
