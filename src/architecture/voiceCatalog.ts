import { subscribeVoices } from '../lib/chosenTts'

export const MAX_USER_VOICES = 5
export const VOICE_SAMPLE =
  'Hello Simon, welcome to Kea. Today we are learning together.'

const STORAGE_KEY = 'kea-voice-catalog-v1'
const USER_VOICE_KEY = 'kea-user-voice-id'

export type VoiceProvider = 'openai' | 'browser'

export interface ManagedVoice {
  id: string
  provider: VoiceProvider
  actualName: string
  lang: string
  openaiVoice?: string
  voiceURI?: string
  userName: string
  userDescription: string
  enabled: boolean
}

export interface VoiceCatalog {
  defaultId: string
  /** Voice used for the welcome/marketing page spoken intro. */
  marketingIntroId: string
  voices: ManagedVoice[]
}

const OPENAI_SEED: Array<{
  openaiVoice: string
  actualName: string
  userName: string
  userDescription: string
  enabled: boolean
}> = [
  {
    openaiVoice: 'nova',
    actualName: 'Nova',
    userName: 'Soft Charm',
    userDescription: 'Warm, close, and a little alluring.',
    enabled: true,
  },
  {
    openaiVoice: 'shimmer',
    actualName: 'Shimmer',
    userName: 'Sweet Glow',
    userDescription: 'Light, soft, and inviting.',
    enabled: true,
  },
  {
    openaiVoice: 'coral',
    actualName: 'Coral',
    userName: 'Friendly Companion',
    userDescription: 'Warm, thoughtful and supportive.',
    enabled: true,
  },
  {
    openaiVoice: 'sage',
    actualName: 'Sage',
    userName: 'Wise Guide',
    userDescription: 'Calm and reflective conversation.',
    enabled: true,
  },
  {
    openaiVoice: 'alloy',
    actualName: 'Alloy',
    userName: 'Quiet Friend',
    userDescription: 'Soft, never in a hurry.',
    enabled: true,
  },
  {
    openaiVoice: 'ash',
    actualName: 'Ash',
    userName: '',
    userDescription: '',
    enabled: false,
  },
  {
    openaiVoice: 'ballad',
    actualName: 'Ballad',
    userName: 'Velvet Tone',
    userDescription: 'Smooth, intimate, and melodic.',
    enabled: false,
  },
  {
    openaiVoice: 'echo',
    actualName: 'Echo',
    userName: '',
    userDescription: '',
    enabled: false,
  },
  {
    openaiVoice: 'fable',
    actualName: 'Fable',
    userName: '',
    userDescription: '',
    enabled: false,
  },
  {
    openaiVoice: 'onyx',
    actualName: 'Onyx',
    userName: '',
    userDescription: '',
    enabled: false,
  },
  {
    openaiVoice: 'verse',
    actualName: 'Verse',
    userName: '',
    userDescription: '',
    enabled: false,
  },
]

function openaiId(voice: string) {
  return `openai:${voice}`
}

function browserId(uri: string) {
  return `browser:${uri}`
}

const SOFT_CHARM_ID = () => openaiId('nova')
const CHARM_DEFAULT_FLAG = 'kea-voice-charm-default-v2'

function seedCatalog(): VoiceCatalog {
  const voices = OPENAI_SEED.map((item) => ({
    id: openaiId(item.openaiVoice),
    provider: 'openai' as const,
    actualName: item.actualName,
    lang: 'en',
    openaiVoice: item.openaiVoice,
    userName: item.userName,
    userDescription: item.userDescription,
    enabled: item.enabled,
  }))
  const softCharm = SOFT_CHARM_ID()
  return {
    defaultId: softCharm,
    marketingIntroId: softCharm,
    voices,
  }
}

function readStored(): VoiceCatalog | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as VoiceCatalog
    if (!parsed || !Array.isArray(parsed.voices)) return null
    return parsed
  } catch {
    return null
  }
}

export function saveVoiceCatalog(catalog: VoiceCatalog) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(catalog))
}

export function mergeBrowserVoices(
  catalog: VoiceCatalog,
  installed: SpeechSynthesisVoice[],
): VoiceCatalog {
  const have = new Set(catalog.voices.map((item) => item.id))
  const extras: ManagedVoice[] = []
  for (const voice of installed) {
    const id = browserId(voice.voiceURI)
    if (have.has(id)) continue
    extras.push({
      id,
      provider: 'browser',
      actualName: voice.name,
      lang: voice.lang,
      voiceURI: voice.voiceURI,
      userName: '',
      userDescription: '',
      enabled: false,
    })
  }
  if (!extras.length) return catalog
  return { ...catalog, voices: [...catalog.voices, ...extras] }
}

/** One-time move from the colder Coral default to Soft Charm (Nova). */
function migrateCharmDefault(catalog: VoiceCatalog): VoiceCatalog {
  try {
    if (localStorage.getItem(CHARM_DEFAULT_FLAG) === '1') return catalog
  } catch {
    return catalog
  }

  const softCharm = SOFT_CHARM_ID()
  const coral = openaiId('coral')
  const next: VoiceCatalog = {
    ...catalog,
    voices: catalog.voices.map((item) => {
      if (item.id === softCharm) {
        return {
          ...item,
          enabled: true,
          userName: 'Soft Charm',
          userDescription: 'Warm, close, and a little alluring.',
        }
      }
      if (item.openaiVoice === 'shimmer') {
        return {
          ...item,
          userName: item.userName.trim() === 'Cheerful Coach' || !item.userName.trim()
            ? 'Sweet Glow'
            : item.userName,
          userDescription:
            item.userDescription.trim() === 'Light, upbeat and encouraging.' ||
            !item.userDescription.trim()
              ? 'Light, soft, and inviting.'
              : item.userDescription,
        }
      }
      return item
    }),
  }

  if (!next.voices.some((item) => item.id === softCharm)) {
    const seeded = seedCatalog().voices.find((item) => item.id === softCharm)
    if (seeded) next.voices.unshift(seeded)
  }

  if (!next.defaultId || next.defaultId === coral) {
    next.defaultId = softCharm
  }
  if (!next.marketingIntroId || next.marketingIntroId === coral) {
    next.marketingIntroId = softCharm
  }

  saveVoiceCatalog(next)
  try {
    localStorage.setItem(CHARM_DEFAULT_FLAG, '1')
  } catch {
    // ignore
  }
  try {
    const chosen = localStorage.getItem(USER_VOICE_KEY)
    if (!chosen || chosen === coral) {
      localStorage.setItem(USER_VOICE_KEY, softCharm)
    }
  } catch {
    // ignore
  }
  return next
}

export function loadVoiceCatalog(): VoiceCatalog {
  const stored = readStored()
  const base = migrateCharmDefault(stored ?? seedCatalog())
  const byId = new Map(base.voices.map((item) => [item.id, item]))
  for (const seed of seedCatalog().voices) {
    if (!byId.has(seed.id)) base.voices.push(seed)
  }
  const softCharm = SOFT_CHARM_ID()
  if (!base.voices.some((item) => item.id === base.defaultId)) {
    base.defaultId =
      base.voices.find((item) => item.enabled)?.id ??
      base.voices[0]?.id ??
      ''
  }
  if (
    !base.marketingIntroId ||
    !base.voices.some((item) => item.id === base.marketingIntroId)
  ) {
    base.marketingIntroId = base.voices.some((item) => item.id === softCharm)
      ? softCharm
      : base.defaultId
  }
  if (!stored) saveVoiceCatalog(base)
  else if (!(stored as VoiceCatalog).marketingIntroId) saveVoiceCatalog(base)
  return base
}

/** Soft Charm (Nova) — warm and a little alluring — or admin override. */
export function getMarketingIntroVoice(
  catalog = loadVoiceCatalog(),
): ManagedVoice | null {
  const softCharm = SOFT_CHARM_ID()
  const chosen =
    catalog.voices.find((item) => item.id === catalog.marketingIntroId) ||
    catalog.voices.find((item) => item.id === softCharm) ||
    catalog.voices.find((item) => item.id === catalog.defaultId) ||
    catalog.voices[0]
  return chosen ?? null
}

export function setMarketingIntroVoiceId(id: string) {
  const catalog = loadVoiceCatalog()
  if (!catalog.voices.some((item) => item.id === id)) return catalog
  const next = { ...catalog, marketingIntroId: id }
  saveVoiceCatalog(next)
  return next
}

export function enabledUserVoices(catalog: VoiceCatalog): ManagedVoice[] {
  return catalog.voices
    .filter((item) => item.enabled)
    .slice(0, MAX_USER_VOICES)
    .map((item) => ({
      ...item,
      userName: item.userName.trim() || item.actualName,
      userDescription: item.userDescription.trim(),
    }))
}

export function countEnabled(catalog: VoiceCatalog) {
  return catalog.voices.filter((item) => item.enabled).length
}

export function readUserVoiceId(): string | null {
  try {
    return localStorage.getItem(USER_VOICE_KEY)
  } catch {
    return null
  }
}

export function saveUserVoiceId(id: string) {
  localStorage.setItem(USER_VOICE_KEY, id)
}

export function getSpeakVoice(catalog = loadVoiceCatalog()): ManagedVoice | null {
  const enabled = enabledUserVoices(catalog)
  if (!enabled.length) return null
  const chosen = readUserVoiceId()
  return enabled.find((item) => item.id === chosen) ??
    enabled.find((item) => item.id === catalog.defaultId) ??
    enabled[0]
}

export function watchBrowserVoices(
  onVoices: (voices: SpeechSynthesisVoice[]) => void,
) {
  return subscribeVoices(onVoices)
}
