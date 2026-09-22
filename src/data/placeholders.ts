import { VOCABULARY_MASTERY_THRESHOLD } from '../architecture/vocabularyMemory'
import type {
  LanguageCode,
  PlaceholderUser,
  TranscriptMessage,
  VocabularyMemoryItem,
} from '../types'

export const PLACEHOLDER_TRANSCRIPTS: Partial<
  Record<LanguageCode, TranscriptMessage[]>
> = {
    es: [
      {
        id: 'es-1',
        speaker: 'user',
        text: 'Hoy fue un día largo. No sé la palabra for supermarket.',
        english: 'Today was a long day. I don’t know the word for supermarket.',
      },
      {
        id: 'es-2',
        speaker: 'kea',
        text: 'Supermarket en español es supermercado. Cuéntame, ¿fuiste después del trabajo?',
        english:
          'Supermarket in Spanish is supermercado. Tell me, did you go after work?',
      },
      {
        id: 'es-3',
        speaker: 'user',
        text: 'Sí. El supermercado estaba lleno, pero tranquilo.',
        english: 'Yes. The supermarket was full, but calm.',
      },
      {
        id: 'es-4',
        speaker: 'kea',
        text: 'Me alegra. ¿Qué vas a cocinar esta noche?',
        english: 'I’m glad. What are you going to cook tonight?',
      },
    ],
    fr: [
      {
        id: 'fr-1',
        speaker: 'user',
        text: 'La journée était longue. Je ne connais pas le mot for supermarket.',
      },
      {
        id: 'fr-2',
        speaker: 'kea',
        text: 'Supermarket en français, c’est supermarché. Tu y es allé après le travail ?',
      },
      {
        id: 'fr-3',
        speaker: 'user',
        text: 'Oui. Le supermarché était plein, mais calme.',
      },
      {
        id: 'fr-4',
        speaker: 'kea',
        text: 'Je vois. Qu’est-ce que tu vas cuisiner ce soir ?',
      },
    ],
    de: [
      {
        id: 'de-1',
        speaker: 'user',
        text: 'Der Tag war lang. Ich kenne das Wort for supermarket nicht.',
      },
      {
        id: 'de-2',
        speaker: 'kea',
        text: 'Supermarket auf Deutsch ist Supermarkt. Warst du nach der Arbeit dort?',
      },
      {
        id: 'de-3',
        speaker: 'user',
        text: 'Ja. Der Supermarkt war voll, aber ruhig.',
      },
      {
        id: 'de-4',
        speaker: 'kea',
        text: 'Schön. Was kochst du heute Abend?',
      },
    ],
  }

export const PLACEHOLDER_VOCABULARY: VocabularyMemoryItem[] = [
  {
    id: 'es-supermarket',
    english: 'supermarket',
    translation: 'supermercado',
    languageCode: 'es',
    successfulUses: 3,
  },
  {
    id: 'es-full',
    english: 'full',
    translation: 'lleno',
    languageCode: 'es',
    successfulUses: 1,
  },
  {
    id: 'es-thanks',
    english: 'thank you',
    translation: 'gracias',
    languageCode: 'es',
    successfulUses: VOCABULARY_MASTERY_THRESHOLD,
  },
  {
    id: 'fr-supermarket',
    english: 'supermarket',
    translation: 'supermarché',
    languageCode: 'fr',
    successfulUses: 3,
  },
  {
    id: 'fr-full',
    english: 'full',
    translation: 'plein',
    languageCode: 'fr',
    successfulUses: 1,
  },
  {
    id: 'fr-thanks',
    english: 'thank you',
    translation: 'merci',
    languageCode: 'fr',
    successfulUses: VOCABULARY_MASTERY_THRESHOLD,
  },
  {
    id: 'de-supermarket',
    english: 'supermarket',
    translation: 'Supermarkt',
    languageCode: 'de',
    successfulUses: 3,
  },
  {
    id: 'de-full',
    english: 'full',
    translation: 'voll',
    languageCode: 'de',
    successfulUses: 1,
  },
  {
    id: 'de-thanks',
    english: 'thank you',
    translation: 'danke',
    languageCode: 'de',
    successfulUses: VOCABULARY_MASTERY_THRESHOLD,
  },
]

export const PLACEHOLDER_USERS: PlaceholderUser[] = [
  {
    id: 'u1',
    displayName: 'Amelia Chen',
    languageCode: 'es',
    activeVocabularyCount: 12,
  },
  {
    id: 'u2',
    displayName: 'Noah Patel',
    languageCode: 'fr',
    activeVocabularyCount: 4,
  },
  {
    id: 'u3',
    displayName: 'Lena Hofmann',
    languageCode: 'de',
    activeVocabularyCount: 9,
  },
]

export const FUTURE_ADMIN_EMAIL = 'simonghooper@gmail.com'
