import { getAverageReplyWords } from '../data/keaSpeech'
import {
  calendarMonthKey,
  loadBilling,
  minutesUsedInMonth,
} from './keaBilling'
import {
  getPlan,
  loadPlanCatalog,
  type KeaPlan,
  type KeaPlanCatalog,
} from './keaPlans'

const RATES_KEY = 'kea-openai-rates-v1'
const ASSUME_KEY = 'kea-cost-assumptions-v1'
const MONTHLY_KEY = 'kea-cost-monthly-v1'

export interface OpenAiRates {
  whisperPerMinute: number
  chatInputPerMillion: number
  chatOutputPerMillion: number
  ttsInputPerMillion: number
  ttsAudioPerMillion: number
}

export interface CostAssumptions {
  typicalDailyMinutes: number
  unlimitedTypicalMinutes: number
  userTalkShare: number
  keaTalkShare: number
  wordsPerMinuteSpoken: number
  systemPromptTokens: number
  historyTurns: number
  userWordsPerTurn: number
  targetMarginPercent: number
  daysPerMonth: number
}

export const DEFAULT_OPENAI_RATES: OpenAiRates = {
  whisperPerMinute: 0.006,
  chatInputPerMillion: 0.15,
  chatOutputPerMillion: 0.6,
  ttsInputPerMillion: 0.6,
  ttsAudioPerMillion: 12,
}

export const DEFAULT_COST_ASSUMPTIONS: CostAssumptions = {
  typicalDailyMinutes: 18,
  unlimitedTypicalMinutes: 90,
  userTalkShare: 0.45,
  keaTalkShare: 0.4,
  wordsPerMinuteSpoken: 140,
  systemPromptTokens: 2200,
  historyTurns: 6,
  userWordsPerTurn: 22,
  targetMarginPercent: 70,
  daysPerMonth: 30,
}

export function loadOpenAiRates(): OpenAiRates {
  try {
    const raw = localStorage.getItem(RATES_KEY)
    if (!raw) return { ...DEFAULT_OPENAI_RATES }
    return { ...DEFAULT_OPENAI_RATES, ...(JSON.parse(raw) as OpenAiRates) }
  } catch {
    return { ...DEFAULT_OPENAI_RATES }
  }
}

export function saveOpenAiRates(rates: OpenAiRates) {
  localStorage.setItem(RATES_KEY, JSON.stringify(rates))
}

export function loadCostAssumptions(): CostAssumptions {
  try {
    const raw = localStorage.getItem(ASSUME_KEY)
    if (!raw) return { ...DEFAULT_COST_ASSUMPTIONS }
    return { ...DEFAULT_COST_ASSUMPTIONS, ...(JSON.parse(raw) as CostAssumptions) }
  } catch {
    return { ...DEFAULT_COST_ASSUMPTIONS }
  }
}

export function saveCostAssumptions(value: CostAssumptions) {
  localStorage.setItem(ASSUME_KEY, JSON.stringify(value))
}

export interface DayCost {
  minutes: number
  turns: number
  tokens: number
  whisper: number
  chat: number
  tts: number
  total: number
}

export interface MonthlyCostPoint {
  month: string
  tokens: number
  cost: number
  revenue: number
  minutes: number
}

interface MonthlyCostStore {
  startMonth: string
  months: Record<string, MonthlyCostPoint>
}

export interface PlanCostRow {
  id: string
  name: string
  monthlyPrice: number
  allowanceMinutes: number
  atCap: DayCost
  typical: DayCost
  monthlyCostAtCap: number
  monthlyCostTypical: number
  profitAtCap: number
  profitTypical: number
  marginAtCap: number
  marginTypical: number
  recommendedPrice: number
}

function num(value: number, fallback: number) {
  return Number.isFinite(value) ? value : fallback
}

export function costForMinutes(
  minutes: number,
  rates: OpenAiRates,
  assume: CostAssumptions,
  keaWords: number,
): DayCost {
  const mins = Math.max(0, minutes)
  const userMin = mins * num(assume.userTalkShare, 0.45)
  const keaMin = mins * num(assume.keaTalkShare, 0.4)
  const wpm = Math.max(80, num(assume.wordsPerMinuteSpoken, 140))
  const userWords = Math.max(8, num(assume.userWordsPerTurn, 22))
  const keaW = Math.max(8, keaWords)
  const turns = userWords > 0 ? (userMin * wpm) / userWords : 0
  const tokensPerWord = 1.3
  const historyTokens =
    num(assume.historyTurns, 6) * (userWords + keaW) * tokensPerWord
  const inputTokens =
    turns *
    (num(assume.systemPromptTokens, 2200) + historyTokens + userWords * tokensPerWord)
  const outputTokens = turns * keaW * tokensPerWord
  const ttsInputTokens = outputTokens
  const audioTokensPerMinute = 1250
  const ttsAudioTokens = keaMin * audioTokensPerMinute
  const whisper = userMin * rates.whisperPerMinute
  const chat =
    (inputTokens / 1_000_000) * rates.chatInputPerMillion +
    (outputTokens / 1_000_000) * rates.chatOutputPerMillion
  const tts =
    (ttsInputTokens / 1_000_000) * rates.ttsInputPerMillion +
    (ttsAudioTokens / 1_000_000) * rates.ttsAudioPerMillion
  return {
    minutes: mins,
    turns,
    tokens: inputTokens + outputTokens + ttsInputTokens + ttsAudioTokens,
    whisper,
    chat,
    tts,
    total: whisper + chat + tts,
  }
}

function pad2(value: number) {
  return String(value).padStart(2, '0')
}

function isMonthKey(value: string) {
  return /^\d{4}-\d{2}$/.test(value)
}

export function calendarMonthKeys(startMonth: string, endMonth: string): string[] {
  const start = isMonthKey(startMonth) ? startMonth : endMonth
  const end = isMonthKey(endMonth) ? endMonth : start
  const [sy, sm] = start.split('-').map(Number)
  const [ey, em] = end.split('-').map(Number)
  const keys: string[] = []
  let year = sy
  let month = sm
  while (year < ey || (year === ey && month <= em)) {
    keys.push(`${year}-${pad2(month)}`)
    month += 1
    if (month > 12) {
      month = 1
      year += 1
    }
    if (keys.length > 240) break
  }
  return keys.length ? keys : [end]
}

/** Catalog price of the plan stored on this device, else 0. Not a Stripe ledger. */
export function recordedSubscriptionRevenue() {
  const billing = loadBilling()
  if (billing.status !== 'active' || !billing.planId) return 0
  const plan = getPlan(billing.planId)
  const price = Number(plan.monthlyPrice)
  return Number.isFinite(price) && price > 0 ? price : 0
}

function emptyStore(startMonth: string): MonthlyCostStore {
  return { startMonth, months: {} }
}

function loadMonthlyStore(): MonthlyCostStore {
  const now = calendarMonthKey()
  try {
    const raw = localStorage.getItem(MONTHLY_KEY)
    if (!raw) return emptyStore(now)
    const parsed = JSON.parse(raw) as Partial<MonthlyCostStore>
    const startMonth =
      typeof parsed.startMonth === 'string' && isMonthKey(parsed.startMonth)
        ? parsed.startMonth
        : now
    const months: Record<string, MonthlyCostPoint> = {}
    if (parsed.months && typeof parsed.months === 'object') {
      for (const [key, value] of Object.entries(parsed.months)) {
        if (!isMonthKey(key) || !value || typeof value !== 'object') continue
        const point = value as Partial<MonthlyCostPoint>
        months[key] = {
          month: key,
          tokens: num(Number(point.tokens), 0),
          cost: num(Number(point.cost), 0),
          revenue: num(Number(point.revenue), 0),
          minutes: num(Number(point.minutes), 0),
        }
      }
    }
    return { startMonth, months }
  } catch {
    return emptyStore(now)
  }
}

function saveMonthlyStore(store: MonthlyCostStore) {
  localStorage.setItem(MONTHLY_KEY, JSON.stringify(store))
}

export function measureMonth(
  yyyyMm: string,
  rates: OpenAiRates = loadOpenAiRates(),
  assume: CostAssumptions = loadCostAssumptions(),
  keaWords = getAverageReplyWords(),
  includeRevenue = yyyyMm === calendarMonthKey(),
): MonthlyCostPoint {
  const minutes = Math.max(0, minutesUsedInMonth(yyyyMm))
  const day = costForMinutes(minutes, rates, assume, keaWords)
  return {
    month: yyyyMm,
    tokens: day.tokens,
    cost: day.total,
    revenue: includeRevenue ? recordedSubscriptionRevenue() : 0,
    minutes,
  }
}

/**
 * Axis from the first recorded month (this month on first visit) through the
 * current calendar month. The current month is always refreshed from talk
 * usage and local billing; earlier months stay as saved snapshots.
 */
export function loadMonthlyCostSeries(
  rates: OpenAiRates = loadOpenAiRates(),
  assume: CostAssumptions = loadCostAssumptions(),
  keaWords = getAverageReplyWords(),
): MonthlyCostPoint[] {
  const now = calendarMonthKey()
  const store = loadMonthlyStore()
  const startMonth = store.startMonth <= now ? store.startMonth : now
  const months = { ...store.months }
  const points = calendarMonthKeys(startMonth, now).map((month) => {
    if (month === now) {
      const live = measureMonth(month, rates, assume, keaWords, true)
      months[month] = live
      return live
    }
    if (months[month]) return months[month]
    const recovered = measureMonth(month, rates, assume, keaWords, false)
    months[month] = recovered
    return recovered
  })
  saveMonthlyStore({ startMonth, months })
  return points
}

function rowFor(
  id: string,
  name: string,
  monthlyPrice: number,
  allowanceMinutes: number,
  typicalMinutes: number,
  rates: OpenAiRates,
  assume: CostAssumptions,
  keaWords: number,
): PlanCostRow {
  const days = Math.max(1, num(assume.daysPerMonth, 30))
  const margin = Math.min(0.9, Math.max(0.05, num(assume.targetMarginPercent, 70) / 100))
  const atCap = costForMinutes(
    allowanceMinutes <= 0 ? assume.unlimitedTypicalMinutes : allowanceMinutes,
    rates,
    assume,
    keaWords,
  )
  const typical = costForMinutes(typicalMinutes, rates, assume, keaWords)
  const monthlyCostAtCap = atCap.total * days
  const monthlyCostTypical = typical.total * days
  const recommendedPrice = monthlyCostAtCap / (1 - margin)
  return {
    id,
    name,
    monthlyPrice,
    allowanceMinutes,
    atCap,
    typical,
    monthlyCostAtCap,
    monthlyCostTypical,
    profitAtCap: monthlyPrice - monthlyCostAtCap,
    profitTypical: monthlyPrice - monthlyCostTypical,
    marginAtCap: monthlyPrice > 0 ? (monthlyPrice - monthlyCostAtCap) / monthlyPrice : 0,
    marginTypical:
      monthlyPrice > 0 ? (monthlyPrice - monthlyCostTypical) / monthlyPrice : 0,
    recommendedPrice,
  }
}

export function analyseCosts(
  catalog: KeaPlanCatalog = loadPlanCatalog(),
  rates: OpenAiRates = loadOpenAiRates(),
  assume: CostAssumptions = loadCostAssumptions(),
  keaWords = getAverageReplyWords(),
): { trial: PlanCostRow; plans: PlanCostRow[]; rates: OpenAiRates; assume: CostAssumptions; keaWords: number } {
  const typical = Math.max(1, assume.typicalDailyMinutes)
  const trial = rowFor(
    'trial',
    'Free trial',
    0,
    catalog.trialDailyMinutes,
    Math.min(typical, catalog.trialDailyMinutes),
    rates,
    assume,
    keaWords,
  )
  const plans = catalog.plans.map((plan: KeaPlan) =>
    rowFor(
      plan.id,
      plan.name,
      plan.monthlyPrice,
      plan.dailyMinutes,
      plan.dailyMinutes <= 0
        ? assume.unlimitedTypicalMinutes
        : Math.min(typical, plan.dailyMinutes),
      rates,
      assume,
      keaWords,
    ),
  )
  return { trial, plans, rates, assume, keaWords }
}
