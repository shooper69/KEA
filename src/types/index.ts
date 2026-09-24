export type LanguageCode =
  | 'en'
  | 'es'
  | 'fr'
  | 'de'
  | 'ru'
  | 'pt'
  | 'nl'
  | 'it'
  | 'pl'
  | 'bg'
  | 'sv'
  | 'da'
  | 'no'
  | 'fi'
  | 'cs'
  | 'ro'
  | 'hu'
  | 'el'
  | 'tr'
  | 'uk'
  | 'ja'
  | 'zh'
  | 'ko'
  | 'ar'
  | 'hi'
  | 'ca'
  | 'sk'
  | 'hr'
  | 'sr'
  | 'he'
  | 'th'
  | 'vi'
  | 'id'
export type NativeLanguageCode = LanguageCode
export type LearnerLevel = 'beginner' | 'intermediate' | 'advanced'

export interface LanguageOption {
  code: LanguageCode
  name: string
  nativeName: string
  speechLocale: string
}

export type VoicePersonalityId =
  | 'luna'
  | 'mira'
  | 'sage'
  | 'rowan'
  | 'theo'

export interface VoicePersonality {
  id: VoicePersonalityId
  name: string
  style: string
  gender: 'female' | 'male'
  rate: number
  samples: Partial<Record<LanguageCode, string>>
}

/** Future OpenAI GPT voice session. Cloud motion follows this state. */
export type VoicePresenceState =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'speaking'
export type SkyTheme = 'clouds' | 'weather'
export type ChatKeep = 'device' | 'cloud'


export type TranscriptSpeaker = 'user' | 'kea'

export interface TranscriptMessage {
  id: string
  speaker: TranscriptSpeaker
  text: string
  english?: string
  interim?: boolean
  active?: boolean
  confidence?: number
  pending?: boolean
}

export interface VocabularyMemoryItem {
  id: string
  english: string
  translation: string
  languageCode: LanguageCode
  successfulUses: number
}

export interface LearnListItem {
  id: string
  term: string
  translation: string
  languageCode: LanguageCode
  createdAt: string
  lastReviewedAt: string
  practiceCount: number
  status: 'learning' | 'reinforced'
}

export interface ChatTopic {
  id: string
  title: string
  nativeTitle: string
  summary: string
  firstDiscussedAt: string
  lastDiscussedAt: string
  discussionCount: number
}

export interface PlaceholderUser {
  id: string
  displayName: string
  languageCode: LanguageCode
  activeVocabularyCount: number
}
