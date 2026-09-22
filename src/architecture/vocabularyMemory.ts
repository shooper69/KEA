/**
 * Vocabulary memory
 *
 * When KEA notices the user reaching for English, the word is kept:
 *   English = translation in the chosen language
 *
 * It stays in memory until KEA has heard the user use it naturally
 * 10 times. Then it leaves, like a word that no longer needs help.
 */

import type { VocabularyMemoryItem } from '../types'

export const VOCABULARY_MASTERY_THRESHOLD = 10

export function isVocabularyMastered(successfulUses: number): boolean {
  return successfulUses >= VOCABULARY_MASTERY_THRESHOLD
}

export function isActiveMemoryItem(item: VocabularyMemoryItem): boolean {
  return !isVocabularyMastered(item.successfulUses)
}
