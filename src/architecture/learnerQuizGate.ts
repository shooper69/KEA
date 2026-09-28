/**
 * Who sees the first-visit questionnaire.
 * Existing talkers are left on the welcome line. A new member sees it once.
 * Admin only sees it when they open Onboarding from the account menu.
 */
export function shouldShowLearnerQuiz(options: {
  isAdmin: boolean
  review: boolean
  profileKnown: boolean
  hasAnswers: boolean
  hasTalked: boolean
}) {
  if (options.review) return true
  if (options.isAdmin) return false
  if (!options.profileKnown || options.hasAnswers || options.hasTalked) return false
  return true
}

/**
 * Spoken product tour (“Kea is just a conversational tool…”).
 * A login that already gets the welcome-back line must not cover it with this caption.
 */
export function shouldShowSpokenTour(options: {
  isAdmin: boolean
  profileKnown: boolean
  hasName: boolean
  hasTalked: boolean
  completed: boolean
  busy: boolean
}) {
  if (options.busy || options.isAdmin || !options.profileKnown) return false
  if (options.hasName || options.hasTalked || options.completed) return false
  return true
}
