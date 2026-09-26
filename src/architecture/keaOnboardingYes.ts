/**
 * Detect a short affirmative reply during spoken onboarding (“yes” / “OK” / etc.).
 */

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const YES =
  /^(yes|yeah|yep|yup|yea|yah|ok|okay|sure|si|sí|oui|ja|hai|claro|vale|de acuerdo|daccord|d'accord|absolutely|definitely|alright|all right|right|correct|afirmativo|yez|yas)[.!]*$/i

export function heardOnboardingYes(text: string) {
  const n = normalize(text)
  if (!n) return false
  if (n.split(/\s+/).length > 6) return false
  if (YES.test(n)) return true
  // Soft: “yes kea”, “ok kea”, “yes please”
  if (
    /^(yes|yeah|yep|yup|ok|okay|sure|si|oui|ja|claro|vale)\b/.test(n) &&
    n.split(/\s+/).length <= 4
  ) {
    return true
  }
  return false
}
