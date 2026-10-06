import { DEFAULT_PLAN_CATALOG } from '../../architecture/keaPlanCatalog.ts'
import {
  DAYS_PER_MONTH,
  UNLIMITED_FAIR_USE_MINUTES,
  dailyPaceFromMonthlyMinutes,
  grossMargin,
  monthlyCapFloor,
  monthlyMinutesFromDaily,
  netAfterStripe,
  OBSERVED_EVENT_THRESHOLD,
  planningCogsPerMinute,
  recommendedMonthlyMinutes,
  recommendedPriceForCogs,
  stripeFeesForRevenue,
  TARGET_GROSS_MARGIN,
  trafficLight,
} from '../../architecture/keaCostsMath.ts'
import type {
  CostsAdminReport,
  CostsBreakdownRow,
  CostsForecastRow,
  CostsOptimizerRow,
  CostsUserRow,
} from '../../architecture/keaCostsTypes.ts'
import { getKeaServiceSupabase } from '../keaServiceSupabase.ts'
import { loadOpenAiRateCard } from './loadRateCard.ts'

type UsageRow = {
  user_id: string | null
  user_email: string | null
  feature: string
  model: string
  plan_id_at_time: string | null
  prompt_tokens: number | string | null
  completion_tokens: number | string | null
  audio_seconds: number | string | null
  tts_characters: number | string | null
  estimated_cost_usd: number | string | null
  status: string | null
}

type ProfileRow = {
  id: string
  first_name: string | null
  subscription_plan_id: string | null
  subscription_status: string | null
}

const FORECAST_SIZES = [100, 1_000, 10_000, 100_000] as const
const PAGE = 1000

function num(value: unknown) {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

function paidStatus(status: string | null | undefined) {
  return status === 'active' || status === 'trialing'
}

function planPrice(planId: string | null | undefined) {
  if (!planId) return 0
  const plan = DEFAULT_PLAN_CATALOG.plans.find((item) => item.id === planId)
  return plan?.monthlyPrice ?? 0
}

function planName(planId: string) {
  if (planId === 'trial') return 'Trial'
  if (planId === 'none' || planId === 'anonymous') return 'No plan'
  return (
    DEFAULT_PLAN_CATALOG.plans.find((item) => item.id === planId)?.name || planId
  )
}

/** Soft daily pace for a plan (0 = unlimited). */
function dailyPace(planId: string) {
  if (planId === 'trial') return DEFAULT_PLAN_CATALOG.trialDailyMinutes
  const plan = DEFAULT_PLAN_CATALOG.plans.find((item) => item.id === planId)
  if (!plan) return UNLIMITED_FAIR_USE_MINUTES
  return plan.dailyMinutes > 0 ? plan.dailyMinutes : UNLIMITED_FAIR_USE_MINUTES
}

/** Commercial monthly entitlement minutes (planning month = 30 days). */
function monthlyAllowanceMinutes(planId: string) {
  if (planId === 'trial') {
    return (
      DEFAULT_PLAN_CATALOG.trialDailyMinutes * DEFAULT_PLAN_CATALOG.trialDays
    )
  }
  const plan = DEFAULT_PLAN_CATALOG.plans.find((item) => item.id === planId)
  if (!plan) return monthlyMinutesFromDaily(UNLIMITED_FAIR_USE_MINUTES)
  if (plan.dailyMinutes <= 0) {
    return monthlyMinutesFromDaily(UNLIMITED_FAIR_USE_MINUTES)
  }
  return monthlyMinutesFromDaily(plan.dailyMinutes)
}

async function fetchAllUsage(sinceIso: string) {
  const supabase = getKeaServiceSupabase()
  if (!supabase) return [] as UsageRow[]
  const rows: UsageRow[] = []
  let from = 0
  for (;;) {
    const { data, error } = await supabase
      .from('ai_usage_events')
      .select(
        'user_id,user_email,feature,model,plan_id_at_time,prompt_tokens,completion_tokens,audio_seconds,tts_characters,estimated_cost_usd,status',
      )
      .gte('created_at', sinceIso)
      .range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    const batch = (data || []) as UsageRow[]
    rows.push(...batch)
    if (batch.length < PAGE) break
    from += PAGE
    if (from > 200_000) break
  }
  return rows
}

async function fetchProfiles() {
  const supabase = getKeaServiceSupabase()
  if (!supabase) return [] as ProfileRow[]
  const rows: ProfileRow[] = []
  let from = 0
  for (;;) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id,first_name,subscription_plan_id,subscription_status')
      .range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    const batch = (data || []) as ProfileRow[]
    rows.push(...batch)
    if (batch.length < PAGE) break
    from += PAGE
    if (from > 200_000) break
  }
  return rows
}

function emptyBreakdown(key: string, label: string): CostsBreakdownRow {
  return {
    key,
    label,
    events: 0,
    costUsd: 0,
    promptTokens: 0,
    completionTokens: 0,
    audioSeconds: 0,
    ttsCharacters: 0,
  }
}

function addToBreakdown(
  map: Map<string, CostsBreakdownRow>,
  key: string,
  label: string,
  row: UsageRow,
) {
  const current = map.get(key) || emptyBreakdown(key, label)
  current.events += 1
  current.costUsd += num(row.estimated_cost_usd)
  current.promptTokens += num(row.prompt_tokens)
  current.completionTokens += num(row.completion_tokens)
  current.audioSeconds += num(row.audio_seconds)
  current.ttsCharacters += num(row.tts_characters)
  map.set(key, current)
}

function sortByCost<T extends { costUsd: number }>(rows: T[]) {
  return [...rows].sort((a, b) => b.costUsd - a.costUsd)
}

function observedTalkMinutes(rows: UsageRow[]) {
  let audio = 0
  let ttsChars = 0
  for (const row of rows) {
    audio += num(row.audio_seconds)
    ttsChars += num(row.tts_characters)
  }
  const ttsMinutes = ttsChars / 5 / 140
  return audio / 60 + ttsMinutes
}

export async function buildCostsReport(periodDays: number): Promise<CostsAdminReport> {
  const days = Math.min(90, Math.max(1, Math.round(periodDays) || DAYS_PER_MONTH))
  const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const since = sinceDate.toISOString()
  const [events, profiles, rateCard] = await Promise.all([
    fetchAllUsage(since),
    fetchProfiles(),
    loadOpenAiRateCard(),
  ])

  const okEvents = events.filter((row) => row.status !== 'error')
  const openaiCost = okEvents.reduce((sum, row) => sum + num(row.estimated_cost_usd), 0)
  const openaiMonthlyEquivalent = openaiCost * (DAYS_PER_MONTH / days)

  const paid = profiles.filter((row) => paidStatus(row.subscription_status))
  const revenue = paid.reduce(
    (sum, row) => sum + planPrice(row.subscription_plan_id),
    0,
  )
  const stripeFees = stripeFeesForRevenue(revenue, paid.length)
  const net = revenue - stripeFees
  const grossProfit = net - openaiMonthlyEquivalent
  const margin = grossMargin(net, openaiMonthlyEquivalent)

  const profileById = new Map(profiles.map((row) => [row.id, row]))
  const byUserMap = new Map<string, CostsUserRow>()
  for (const row of okEvents) {
    const key = row.user_id || 'anonymous'
    const profile = row.user_id ? profileById.get(row.user_id) : undefined
    const planId =
      row.plan_id_at_time ||
      (paidStatus(profile?.subscription_status) ? profile?.subscription_plan_id : null) ||
      null
    const current = byUserMap.get(key) || {
      ...emptyBreakdown(
        key,
        row.user_email ||
          profile?.first_name ||
          (row.user_id ? row.user_id.slice(0, 8) : 'Anonymous'),
      ),
      userId: row.user_id,
      email: row.user_email,
      planId,
      revenueUsd: planPrice(planId),
      profitUsd: 0,
    }
    current.events += 1
    current.costUsd += num(row.estimated_cost_usd)
    current.promptTokens += num(row.prompt_tokens)
    current.completionTokens += num(row.completion_tokens)
    current.audioSeconds += num(row.audio_seconds)
    current.ttsCharacters += num(row.tts_characters)
    if (!current.email && row.user_email) current.email = row.user_email
    if (!current.planId && planId) current.planId = planId
    byUserMap.set(key, current)
  }
  const byUser = sortByCost(
    [...byUserMap.values()].map((row) => {
      const monthlyCost = row.costUsd * (DAYS_PER_MONTH / days)
      const userNet = netAfterStripe(row.revenueUsd)
      return {
        ...row,
        profitUsd: userNet - monthlyCost,
        label: row.email || row.label,
      }
    }),
  ).slice(0, 50)

  const byFeatureMap = new Map<string, CostsBreakdownRow>()
  const byModelMap = new Map<string, CostsBreakdownRow>()
  const byPlanMap = new Map<string, CostsBreakdownRow>()
  for (const row of okEvents) {
    addToBreakdown(byFeatureMap, row.feature, row.feature, row)
    addToBreakdown(byModelMap, row.model, row.model, row)
    const planKey = row.plan_id_at_time || 'unknown'
    addToBreakdown(byPlanMap, planKey, planName(planKey), row)
  }

  const planning = planningCogsPerMinute(rateCard)
  const talkMinutes = observedTalkMinutes(okEvents)
  const observed =
    talkMinutes >= 5 && openaiCost > 0 ? openaiCost / talkMinutes : null
  const used = observed != null ? Math.max(planning, observed) : planning
  const mode = okEvents.length >= OBSERVED_EVENT_THRESHOLD ? 'observed' : 'planning'

  const planRows: Array<{
    id: string
    name: string
    monthlyPrice: number
  }> = [
    {
      id: 'trial',
      name: 'Free trial',
      monthlyPrice: 0,
    },
    ...DEFAULT_PLAN_CATALOG.plans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      monthlyPrice: plan.monthlyPrice,
    })),
  ]

  const optimizer: CostsOptimizerRow[] = planRows.map((plan) => {
    const planId = plan.id
    const currentPrice = plan.monthlyPrice
    const currentDaily = dailyPace(planId)
    const currentMonthly = monthlyAllowanceMinutes(planId)
    const monthlyCogs = currentMonthly * used
    const net = currentPrice > 0 ? netAfterStripe(currentPrice) : 0
    const currentMargin = currentPrice > 0 ? grossMargin(net, monthlyCogs) : 0
    const recPrice = recommendedPriceForCogs(monthlyCogs)
    const recMonthly =
      currentPrice > 0
        ? recommendedMonthlyMinutes(currentPrice, used, monthlyCapFloor(planId))
        : currentMonthly
    const recDaily = dailyPaceFromMonthlyMinutes(recMonthly)
    const status = currentPrice > 0 ? trafficLight(currentMargin) : 'amber'
    let action: CostsOptimizerRow['action'] = 'ok'
    let actionLabel = 'Meets 50% at full monthly entitlement (heavy use)'
    if (currentPrice <= 0) {
      action = 'ok'
      actionLabel = 'Trial is not priced; watch OpenAI spend'
    } else if (status === 'red') {
      if (recMonthly < currentMonthly && recMonthly >= monthlyCapFloor(planId)) {
        action = 'cut_allowance'
        const hours = Math.round((recMonthly / 60) * 10) / 10
        actionLabel = `Cut monthly allowance to ${hours} h (keep $${currentPrice.toFixed(2)})`
      } else {
        action = 'raise_price'
        const hours = Math.round((currentMonthly / 60) * 10) / 10
        actionLabel = `Raise price to $${recPrice.toFixed(2)} (keep ${hours} h/month)`
      }
    }
    const projectedCogs =
      action === 'cut_allowance' ? recMonthly * used : currentMonthly * used
    const projectedNet =
      action === 'raise_price' ? netAfterStripe(recPrice) : net
    return {
      planId,
      name: plan.name,
      currentPrice,
      recommendedPrice: recPrice,
      currentDailyPace: currentDaily,
      currentMonthlyMinutes: currentMonthly,
      recommendedMonthlyMinutes: recMonthly,
      recommendedDailyPace: recDaily,
      currentMargin,
      projectedMarginAtRecommended:
        currentPrice > 0 ? grossMargin(projectedNet, projectedCogs) : 0,
      monthlyCogsAtCap: monthlyCogs,
      monthlyRevenue: currentPrice,
      netAfterStripe: net,
      status,
      action,
      actionLabel,
    }
  })

  const mixSource = paid.length
    ? paid
    : DEFAULT_PLAN_CATALOG.plans.map((plan) => ({
        subscription_plan_id: plan.id,
      }))
  const mixCounts = new Map<string, number>()
  for (const row of mixSource) {
    const id = row.subscription_plan_id || 'companion'
    mixCounts.set(id, (mixCounts.get(id) || 0) + 1)
  }
  const mixTotal = [...mixCounts.values()].reduce((sum, n) => sum + n, 0) || 1
  const avgRevenue =
    [...mixCounts.entries()].reduce(
      (sum, [id, count]) => sum + planPrice(id) * count,
      0,
    ) / mixTotal
  const avgMonthlyMinutes =
    [...mixCounts.entries()].reduce(
      (sum, [id, count]) => sum + monthlyAllowanceMinutes(id) * count,
      0,
    ) / mixTotal
  const observedPerUser =
    paid.length > 0
      ? openaiMonthlyEquivalent / Math.max(paid.length, 1)
      : used * avgMonthlyMinutes

  const forecast: CostsForecastRow[] = FORECAST_SIZES.map((users) => {
    const rev = avgRevenue * users
    const fees = stripeFeesForRevenue(rev, users)
    const openaiWorst = used * avgMonthlyMinutes * users
    const openaiObs = observedPerUser * users
    const netRev = rev - fees
    const marginWorst = grossMargin(netRev, openaiWorst)
    const marginObs = grossMargin(netRev, openaiObs)
    return {
      users,
      revenue: rev,
      stripeFees: fees,
      openaiWorstCase: openaiWorst,
      openaiObserved: openaiObs,
      marginWorstCase: marginWorst,
      marginObserved: marginObs,
      statusWorstCase: trafficLight(marginWorst),
    }
  })

  return {
    periodDays: days,
    since,
    mode,
    eventCount: okEvents.length,
    overview: {
      revenue,
      stripeFees,
      netAfterStripe: net,
      openaiCost,
      openaiMonthlyEquivalent,
      grossProfit,
      grossMargin: margin,
      profitable: margin >= TARGET_GROSS_MARGIN,
      paidSubscribers: paid.length,
      status: trafficLight(margin),
    },
    byUser,
    byFeature: sortByCost([...byFeatureMap.values()]),
    byModel: sortByCost([...byModelMap.values()]),
    byPlan: sortByCost([...byPlanMap.values()]),
    optimizer,
    forecast,
    cogsPerMinute: {
      planning,
      observed,
      used,
    },
    rates: {
      whisperPerMinute: rateCard.whisperPerMinute,
      chatInputPerMillion: rateCard.chatInputPerMillion,
      chatOutputPerMillion: rateCard.chatOutputPerMillion,
      ttsInputPerMillion: rateCard.ttsInputPerMillion,
      ttsAudioPerMillion: rateCard.ttsAudioPerMillion,
      ttsHdPerMillionChars: rateCard.ttsHdPerMillionChars,
      source: rateCard.source,
      updatedAt: rateCard.updatedAt,
      updatedBy: rateCard.updatedBy,
    },
  }
}
