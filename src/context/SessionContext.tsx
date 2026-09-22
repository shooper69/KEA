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
    null,
  )
  const [nativeLanguage, setNativeLanguage] =
    useState<NativeLanguageCode>('en')
  const [level, setLevel] = useState<LearnerLevel>('intermediate')
  const [vocabulary, setVocabulary] = useState<VocabularyMemoryItem[]>([])

  function setLanguageCode(code: LanguageCode) {
    setLanguageCodeState(code)
    setVocabulary(
      PLACEHOLDER_VOCABULARY.filter((item) => item.languageCode === code),
    )
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
