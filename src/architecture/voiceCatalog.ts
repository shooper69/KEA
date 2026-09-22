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
    openaiVoice: 'coral',
    actualName: 'Coral',
    userName: 'Friendly Companion',
    userDescription: 'Warm, thoughtful and supportive.',
    enabled: true,
  },
  {
    openaiVoice: 'shimmer',
    actualName: 'Shimmer',
    userName: 'Cheerful Coach',
    userDescription: 'Light, upbeat and encouraging.',
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
    openaiVoice: 'nova',
    actualName: 'Nova',
    userName: 'Gentle Teacher',
    userDescription: 'Patient guidance while learning.',
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
    userName: '',
    userDescription: '',
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
  return { defaultId: openaiId('coral'), voices }
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

export function loadVoiceCatalog(): VoiceCatalog {
  const stored = readStored()
  const base = stored ?? seedCatalog()
  const byId = new Map(base.voices.map((item) => [item.id, item]))
  for (const seed of seedCatalog().voices) {
    if (!byId.has(seed.id)) base.voices.push(seed)
  }
  if (!base.voices.some((item) => item.id === base.defaultId)) {
    base.defaultId = base.voices.find((item) => item.enabled)?.id ?? base.voices[0]?.id ?? ''
  }
  if (!stored) saveVoiceCatalog(base)
  return base
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
