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
  dismissed?: boolean
}) {
  if (options.review) return true
  if (options.isAdmin) return false
  if (options.dismissed) return false
  if (!options.profileKnown || options.hasAnswers || options.hasTalked) return false
  return true
}

/**
 * Spoken product tour (“How to use Kea”).
 * Only in the same browser visit that just finished the questionnaire
 * (pending + session arm). A later login or Reset must go straight to chat.
 */
export function shouldShowSpokenTour(options: {
  isAdmin: boolean
  profileKnown: boolean
  hasName: boolean
  hasTalked: boolean
  completed: boolean
  busy: boolean
  /** Set when the get-to-know-you questionnaire has just been saved. */
  awaitingTour?: boolean
  /** True only in the visit that armed the tour after stage 1. */
  tourArmed?: boolean
}) {
  if (options.busy || !options.profileKnown) return false
  if (!options.awaitingTour) return false
  return Boolean(options.tourArmed)
}
