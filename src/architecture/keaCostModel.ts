import { getAverageReplyWords } from '../data/keaSpeech'
import {
  loadPlanCatalog,
  type KeaPlan,
  type KeaPlanCatalog,
} from './keaPlans'

const RATES_KEY = 'kea-openai-rates-v1'
const ASSUME_KEY = 'kea-cost-assumptions-v1'

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
  whisper: number
  chat: number
  tts: number
  total: number
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
    whisper,
    chat,
    tts,
    total: whisper + chat + tts,
  }
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
