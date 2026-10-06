/** Stripe + margin math for Kea cost analysis (server + shared with admin UI types). */

import type { TrafficLight } from './keaCostsTypes.ts'

export type { TrafficLight }

export const TARGET_GROSS_MARGIN = 0.5
export const STRIPE_PERCENT = 0.029
export const STRIPE_FIXED_PER_CHARGE = 0.3
export const DAYS_PER_MONTH = 30
/** Fair-use daily pace for Unlimited when costing full monthly entitlement. */
export const UNLIMITED_FAIR_USE_MINUTES = 90

/** Heavy intensity (pricing-doc worst case): full entitlement, dense talk. */
export const HEAVY_INTENSITY = {
  userSpeakFrac: 0.5,
  keaSpeakFrac: 0.45,
  turnsPerMin: 2.2,
  inputTokPerTurn: 3800,
  outputTokPerTurn: 90,
} as const

export const PLANNING_TTS_PER_MINUTE = 0.015

export const OBSERVED_EVENT_THRESHOLD = 50

export function stripeFeesForRevenue(revenue: number, chargeCount: number) {
  return revenue * STRIPE_PERCENT + STRIPE_FIXED_PER_CHARGE * Math.max(0, chargeCount)
}

export function netAfterStripe(price: number) {
  return price * (1 - STRIPE_PERCENT) - STRIPE_FIXED_PER_CHARGE
}

export function priceFromNet(net: number) {
  return (net + STRIPE_FIXED_PER_CHARGE) / (1 - STRIPE_PERCENT)
}

/** Gross margin vs net after Stripe (policy: 50% of net covers OpenAI). */
export function grossMargin(net: number, openaiCost: number) {
  if (net <= 0) return openaiCost > 0 ? -1 : 0
  return (net - openaiCost) / net
}

export function trafficLight(margin: number): TrafficLight {
  if (margin < TARGET_GROSS_MARGIN) return 'red'
  if (margin <= 0.6) return 'amber'
  return 'green'
}

export function charm99(amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) return 0
  return Math.max(0.99, Math.ceil(amount) - 0.01)
}

export function recommendedPriceForCogs(monthlyCogs: number) {
  const netNeeded = monthlyCogs / TARGET_GROSS_MARGIN
  return charm99(priceFromNet(netNeeded))
}

/** Soft daily pace → planning-month minutes (30-day commercial month). */
export function monthlyMinutesFromDaily(
  dailyMinutes: number,
  days = DAYS_PER_MONTH,
) {
  if (dailyMinutes <= 0) return 0
  return dailyMinutes * days
}

/**
 * Max monthly talk minutes a sticker price can fund at the 50% margin target.
 * Floors are monthly minutes (not daily).
 */
export function recommendedMonthlyMinutes(
  monthlyPrice: number,
  cogsPerMin: number,
  floorMonthlyMinutes: number,
) {
  const net = netAfterStripe(monthlyPrice)
  const affordableMinutes =
    net > 0 && cogsPerMin > 0 ? (net * TARGET_GROSS_MARGIN) / cogsPerMin : 0
  return Math.max(floorMonthlyMinutes, Math.floor(affordableMinutes))
}

/** @deprecated Prefer recommendedMonthlyMinutes — kept for older call sites. */
export function recommendedDailyCap(
  monthlyPrice: number,
  cogsPerMin: number,
  floorMinutes: number,
) {
  return Math.floor(
    recommendedMonthlyMinutes(monthlyPrice, cogsPerMin, floorMinutes * DAYS_PER_MONTH) /
      DAYS_PER_MONTH,
  )
}

/** Soft daily-pace floor → monthly minutes floor for the optimizer. */
export function monthlyCapFloor(planId: string) {
  if (planId === 'starter' || planId === 'trial') return 8 * DAYS_PER_MONTH
  if (planId === 'companion') return 20 * DAYS_PER_MONTH
  return 45 * DAYS_PER_MONTH
}

/** @deprecated Prefer monthlyCapFloor. */
export function capFloor(planId: string) {
  return Math.floor(monthlyCapFloor(planId) / DAYS_PER_MONTH)
}

/** Convert monthly minutes back to the soft daily-pace field stored on plans. */
export function dailyPaceFromMonthlyMinutes(monthlyMinutes: number) {
  if (monthlyMinutes <= 0) return 0
  return Math.max(1, Math.round(monthlyMinutes / DAYS_PER_MONTH))
}

export type OpenAiRateCard = {
  whisperPerMinute: number
  chatInputPerMillion: number
  chatOutputPerMillion: number
  ttsInputPerMillion: number
  ttsAudioPerMillion: number
  ttsHdPerMillionChars: number
}

export const DEFAULT_OPENAI_RATE_CARD: OpenAiRateCard = {
  whisperPerMinute: 0.006,
  chatInputPerMillion: 0.15,
  chatOutputPerMillion: 0.6,
  ttsInputPerMillion: 0.6,
  ttsAudioPerMillion: 12,
  ttsHdPerMillionChars: 30,
}

export function planningCogsPerMinute(rates: OpenAiRateCard = DEFAULT_OPENAI_RATE_CARD) {
  const stt = HEAVY_INTENSITY.userSpeakFrac * rates.whisperPerMinute
  const tts = HEAVY_INTENSITY.keaSpeakFrac * PLANNING_TTS_PER_MINUTE
  const chat =
    (HEAVY_INTENSITY.turnsPerMin *
      (HEAVY_INTENSITY.inputTokPerTurn * rates.chatInputPerMillion +
        HEAVY_INTENSITY.outputTokPerTurn * rates.chatOutputPerMillion)) /
    1_000_000
  return stt + tts + chat
}

export function estimateChatUsd(
  promptTokens: number,
  completionTokens: number,
  rates: OpenAiRateCard = DEFAULT_OPENAI_RATE_CARD,
) {
  return (
    (Math.max(0, promptTokens) / 1_000_000) * rates.chatInputPerMillion +
    (Math.max(0, completionTokens) / 1_000_000) * rates.chatOutputPerMillion
  )
}

export function estimateWhisperUsd(
  audioSeconds: number,
  rates: OpenAiRateCard = DEFAULT_OPENAI_RATE_CARD,
) {
  return (Math.max(0, audioSeconds) / 60) * rates.whisperPerMinute
}

export function estimateTtsUsd(
  model: string,
  ttsCharacters: number,
  rates: OpenAiRateCard = DEFAULT_OPENAI_RATE_CARD,
) {
  const chars = Math.max(0, ttsCharacters)
  if (model === 'tts-1-hd' || model === 'tts-1') {
    return (chars / 1_000_000) * rates.ttsHdPerMillionChars
  }
  const inputTokens = chars / 4
  const spokenMinutes = chars / 5 / 140
  const audioTokens = spokenMinutes * 1250
  return (
    (inputTokens / 1_000_000) * rates.ttsInputPerMillion +
    (audioTokens / 1_000_000) * rates.ttsAudioPerMillion
  )
}

export function roundUsd(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000
}

export function formatHoursFromMinutes(minutes: number) {
  if (!Number.isFinite(minutes) || minutes <= 0) return '0 h'
  const hours = minutes / 60
  const rounded = Math.round(hours * 10) / 10
  return `${rounded} h`
}
