export type LanguageCode = 'es' | 'fr' | 'de'
export type NativeLanguageCode = 'en' | LanguageCode
export type LearnerLevel = 'beginner' | 'intermediate' | 'advanced'

export interface LanguageOption {
  code: LanguageCode
  name: string
  nativeName: string
  speechLocale: string
}

export type VoicePersonalityId =
  | 'wise-male'
  | 'wise-female'
  | 'warm-female'
  | 'calm-male'

export interface VoicePersonality {
  id: VoicePersonalityId
  label: string
  description: string
}

/** Future OpenAI GPT voice session. Cloud motion follows this state. */
export type VoicePresenceState = 'idle' | 'listening' | 'thinking' | 'speaking'

export type TranscriptSpeaker = 'user' | 'kea'

export interface TranscriptMessage {
  id: string
  speaker: TranscriptSpeaker
  text: string
  english?: string
  interim?: boolean
  active?: boolean
}

export interface VocabularyMemoryItem {
  id: string
  english: string
  translation: string
  languageCode: LanguageCode
  successfulUses: number
}

export interface PlaceholderUser {
  id: string
  displayName: string
  languageCode: LanguageCode
  activeVocabularyCount: number
}
