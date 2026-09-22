import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { isActiveMemoryItem } from '../architecture/vocabularyMemory'
import { PLACEHOLDER_VOCABULARY } from '../data/placeholders'
import type { LanguageCode, LearnerLevel, NativeLanguageCode, VocabularyMemoryItem } from '../types'

const LANGUAGE_STORAGE_KEY = 'kea-language'

function readStoredLanguage(): LanguageCode | null {
  try {
    const value = sessionStorage.getItem(LANGUAGE_STORAGE_KEY)
    if (value === 'es' || value === 'fr' || value === 'de') return value
  } catch {
    // Private browsing can block sessionStorage.
  }
  return null
}

function vocabularyFor(code: LanguageCode | null): VocabularyMemoryItem[] {
  if (!code) return []
  return PLACEHOLDER_VOCABULARY.filter((item) => item.languageCode === code)
}

interface SessionContextValue {
  languageCode: LanguageCode | null
  setLanguageCode: (code: LanguageCode) => void
  nativeLanguage: NativeLanguageCode
  setNativeLanguage: (code: NativeLanguageCode) => void
  level: LearnerLevel
  setLevel: (level: LearnerLevel) => void
  vocabulary: VocabularyMemoryItem[]
  activeVocabulary: VocabularyMemoryItem[]
}

const SessionContext = createContext<SessionContextValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [languageCode, setLanguageCodeState] = useState<LanguageCode | null>(
    readStoredLanguage,
  )
  const [nativeLanguage, setNativeLanguage] =
    useState<NativeLanguageCode>('en')
  const [level, setLevel] = useState<LearnerLevel>('intermediate')
  const [vocabulary, setVocabulary] = useState<VocabularyMemoryItem[]>(() =>
    vocabularyFor(readStoredLanguage()),
  )

  function setLanguageCode(code: LanguageCode) {
    try {
      sessionStorage.setItem(LANGUAGE_STORAGE_KEY, code)
    } catch {
      // Ignore storage failures; in-memory session still works.
    }
    setLanguageCodeState(code)
    setVocabulary(vocabularyFor(code))
  }

  const activeVocabulary = useMemo(
    () => vocabulary.filter(isActiveMemoryItem),
    [vocabulary],
  )

  const value = useMemo(
    () => ({
      languageCode,
      setLanguageCode,
      nativeLanguage,
      setNativeLanguage,
      level,
      setLevel,
      vocabulary,
      activeVocabulary,
    }),
    [languageCode, nativeLanguage, level, vocabulary, activeVocabulary],
  )

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  )
}

export function useSession() {
  const context = useContext(SessionContext)
  if (!context) {
    throw new Error('useSession must be used within SessionProvider')
  }
  return context
}
