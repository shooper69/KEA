export type PlanId = 'starter' | 'companion' | 'unlimited'

export interface KeaPlan {
  id: PlanId
  name: string
  tagline: string
  monthlyPrice: number
  dailyMinutes: number
  bullets: string[]
  stripePriceId: string
  featured: boolean
}

export interface KeaPlanCatalog {
  trialDays: number
  trialDailyMinutes: number
  trialBlurb: string
  currency: 'usd'
  plans: KeaPlan[]
}

const STORAGE_KEY = 'kea-plan-catalog-v1'

export const DEFAULT_PLAN_CATALOG: KeaPlanCatalog = {
  trialDays: 7,
  trialDailyMinutes: 10,
  trialBlurb:
    'Seven days free, with 10 minutes of conversation a day. After that, choose a plan to keep talking with Kea.',
  currency: 'usd',
  plans: [
    {
      id: 'starter',
      name: 'Starter',
      tagline: 'Short daily chats.',
      monthlyPrice: 9.99,
      dailyMinutes: 15,
      featured: false,
      stripePriceId: '',
      bullets: [
        '15 minutes of talk a day',
        'Whisper listening and Kea’s voice',
        'Learn List and chat topics',
      ],
    },
    {
      id: 'companion',
      name: 'Companion',
      tagline: 'The everyday plan.',
      monthlyPrice: 19.99,
      dailyMinutes: 45,
      featured: true,
      stripePriceId: '',
      bullets: [
        '45 minutes of talk a day',
        'All voices the admin has enabled',
        'Best value for daily practice',
      ],
    },
    {
      id: 'unlimited',
      name: 'Unlimited',
      tagline: 'Talk as long as you like.',
      monthlyPrice: 34.99,
      dailyMinutes: 0,
      featured: false,
      stripePriceId: '',
      bullets: [
        'No daily time cap',
        'Longer sessions without watching the clock',
        'For people who live in the language',
      ],
    },
  ],
}

function isPlan(value: unknown): value is KeaPlan {
  if (!value || typeof value !== 'object') return false
  const item = value as KeaPlan
  return (
    item.id === 'starter' ||
    item.id === 'companion' ||
    item.id === 'unlimited'
  )
}

export function loadPlanCatalog(): KeaPlanCatalog {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return structuredClone(DEFAULT_PLAN_CATALOG)
    const parsed = JSON.parse(raw) as Partial<KeaPlanCatalog>
    const base = structuredClone(DEFAULT_PLAN_CATALOG)
    const trialDays = Number(parsed.trialDays)
    const trialDailyMinutes = Number(parsed.trialDailyMinutes)
    const plans = Array.isArray(parsed.plans)
      ? parsed.plans.filter(isPlan).map((plan) => {
          const seed = base.plans.find((item) => item.id === plan.id)
          return {
            ...seed,
            ...plan,
            monthlyPrice: Math.max(0, Number(plan.monthlyPrice) || 0),
            dailyMinutes: Math.max(0, Math.round(Number(plan.dailyMinutes) || 0)),
            bullets: Array.isArray(plan.bullets)
              ? plan.bullets.map((line) => String(line)).filter(Boolean)
              : seed?.bullets ?? [],
            stripePriceId:
              typeof plan.stripePriceId === 'string' ? plan.stripePriceId : '',
          } as KeaPlan
        })
      : base.plans
    const byId = new Map(plans.map((item) => [item.id, item]))
    return {
      trialDays:
        Number.isFinite(trialDays) && trialDays >= 1
          ? Math.min(30, Math.round(trialDays))
          : base.trialDays,
      trialDailyMinutes:
        Number.isFinite(trialDailyMinutes) && trialDailyMinutes >= 1
          ? Math.min(120, Math.round(trialDailyMinutes))
          : base.trialDailyMinutes,
      trialBlurb:
        typeof parsed.trialBlurb === 'string' && parsed.trialBlurb.trim()
          ? parsed.trialBlurb.trim()
          : base.trialBlurb,
      currency: 'usd',
      plans: base.plans.map((seed) => byId.get(seed.id) ?? seed),
    }
  } catch {
    return structuredClone(DEFAULT_PLAN_CATALOG)
  }
}

export function savePlanCatalog(catalog: KeaPlanCatalog) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(catalog))
}

export function getPlan(id: PlanId, catalog = loadPlanCatalog()) {
  return catalog.plans.find((item) => item.id === id) ?? catalog.plans[0]
}

export function formatUsd(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

export function formatDailyMinutes(minutes: number) {
  if (minutes <= 0) return 'Unlimited each day'
  return `${minutes} minutes a day`
}
