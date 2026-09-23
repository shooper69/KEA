const STORAGE_KEY = 'kea-learn-mastery-uses'
export const DEFAULT_LEARN_MASTERY_USES = 5
export const MIN_LEARN_MASTERY_USES = 2
export const MAX_LEARN_MASTERY_USES = 20

export function clampLearnMasteryUses(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return DEFAULT_LEARN_MASTERY_USES
  return Math.min(
    MAX_LEARN_MASTERY_USES,
    Math.max(MIN_LEARN_MASTERY_USES, Math.round(n)),
  )
}

export function getLearnMasteryUses(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw == null || raw === '') return DEFAULT_LEARN_MASTERY_USES
    return clampLearnMasteryUses(Number(raw))
  } catch {
    return DEFAULT_LEARN_MASTERY_USES
  }
}

export function saveLearnMasteryUses(value: number) {
  localStorage.setItem(STORAGE_KEY, String(clampLearnMasteryUses(value)))
  window.dispatchEvent(new Event('kea-learn-memory'))
}
