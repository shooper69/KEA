export type TrafficLight = 'green' | 'amber' | 'red'

export type CostsBreakdownRow = {
  key: string
  label: string
  events: number
  costUsd: number
  promptTokens: number
  completionTokens: number
  audioSeconds: number
  ttsCharacters: number
}

export type CostsUserRow = CostsBreakdownRow & {
  userId: string | null
  email: string | null
  planId: string | null
  revenueUsd: number
  profitUsd: number
}

export type CostsOptimizerRow = {
  planId: string
  name: string
  currentPrice: number
  recommendedPrice: number
  /** Soft daily pace stored on the plan (0 = unlimited). */
  currentDailyPace: number
  /** Commercial monthly entitlement in minutes (planning month = 30 days). */
  currentMonthlyMinutes: number
  recommendedMonthlyMinutes: number
  recommendedDailyPace: number
  currentMargin: number
  projectedMarginAtRecommended: number
  monthlyCogsAtCap: number
  monthlyRevenue: number
  netAfterStripe: number
  status: TrafficLight
  action: 'ok' | 'cut_allowance' | 'raise_price'
  actionLabel: string
}

export type CostsForecastRow = {
  users: number
  revenue: number
  stripeFees: number
  openaiWorstCase: number
  openaiObserved: number
  marginWorstCase: number
  marginObserved: number
  statusWorstCase: TrafficLight
}

export type CostsRateCardInfo = {
  whisperPerMinute: number
  chatInputPerMillion: number
  chatOutputPerMillion: number
  ttsInputPerMillion: number
  ttsAudioPerMillion: number
  ttsHdPerMillionChars: number
  source: 'database' | 'code_defaults'
  updatedAt: string | null
  updatedBy: string | null
}

export type CostsAdminReport = {
  periodDays: number
  since: string
  mode: 'planning' | 'observed'
  eventCount: number
  overview: {
    revenue: number
    stripeFees: number
    netAfterStripe: number
    openaiCost: number
    openaiMonthlyEquivalent: number
    grossProfit: number
    grossMargin: number
    profitable: boolean
    paidSubscribers: number
    status: TrafficLight
  }
  byUser: CostsUserRow[]
  byFeature: CostsBreakdownRow[]
  byModel: CostsBreakdownRow[]
  byPlan: CostsBreakdownRow[]
  optimizer: CostsOptimizerRow[]
  forecast: CostsForecastRow[]
  cogsPerMinute: {
    planning: number
    observed: number | null
    used: number
  }
  rates: CostsRateCardInfo
}
