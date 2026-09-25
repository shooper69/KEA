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
const CHANGE_EVENT = 'kea-plans-changed'

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

/** Live catalog after Admin saves — same tab sees edits immediately. */
let memoryCatalog: KeaPlanCatalog | null = null

function isPlanId(value: unknown): value is PlanId {
  return value === 'starter' || value === 'companion' || value === 'unlimited'
}

function isPlan(value: unknown): value is Partial<KeaPlan> & { id: PlanId } {
  if (!value || typeof value !== 'object') return false
  return isPlanId((value as KeaPlan).id)
}

function normalizePlan(plan: Partial<KeaPlan> & { id: PlanId }, seed: KeaPlan): KeaPlan {
  const name =
    typeof plan.name === 'string' && plan.name.trim() ? plan.name.trim() : seed.name
  const tagline =
    typeof plan.tagline === 'string' && plan.tagline.trim()
      ? plan.tagline.trim()
      : seed.tagline
  const monthlyRaw = Number(plan.monthlyPrice)
  const dailyRaw = Number(plan.dailyMinutes)
  const bullets = Array.isArray(plan.bullets)
    ? plan.bullets.map((line) => String(line).trim()).filter(Boolean)
    : seed.bullets

  return {
    id: seed.id,
    name,
    tagline,
    monthlyPrice:
      Number.isFinite(monthlyRaw) && monthlyRaw >= 0 ? monthlyRaw : seed.monthlyPrice,
    dailyMinutes:
      Number.isFinite(dailyRaw) && dailyRaw >= 0
        ? Math.round(dailyRaw)
        : seed.dailyMinutes,
    bullets: bullets.length ? bullets : seed.bullets,
    stripePriceId:
      typeof plan.stripePriceId === 'string' ? plan.stripePriceId.trim() : '',
    featured: Boolean(plan.featured),
  }
}

function normalizeCatalog(input: Partial<KeaPlanCatalog> | null | undefined): KeaPlanCatalog {
  const base = structuredClone(DEFAULT_PLAN_CATALOG)
  if (!input || typeof input !== 'object') return base

  const trialDays = Number(input.trialDays)
  const trialDailyMinutes = Number(input.trialDailyMinutes)
  const savedPlans = Array.isArray(input.plans)
    ? input.plans.filter(isPlan).map((plan) => {
        const seed = base.plans.find((item) => item.id === plan.id) ?? base.plans[0]
        return normalizePlan(plan, seed)
      })
    : []
  const byId = new Map(savedPlans.map((item) => [item.id, item]))

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
      typeof input.trialBlurb === 'string' && input.trialBlurb.trim()
        ? input.trialBlurb.trim()
        : base.trialBlurb,
    currency: 'usd',
    plans: base.plans.map((seed) => byId.get(seed.id) ?? seed),
  }
}

function readStoredCatalog(): KeaPlanCatalog | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return normalizeCatalog(JSON.parse(raw) as Partial<KeaPlanCatalog>)
  } catch {
    return null
  }
}

function notifyCatalogChanged() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

export function loadPlanCatalog(): KeaPlanCatalog {
  if (memoryCatalog) return structuredClone(memoryCatalog)
  const stored = readStoredCatalog()
  memoryCatalog = stored ?? structuredClone(DEFAULT_PLAN_CATALOG)
  return structuredClone(memoryCatalog)
}

export function savePlanCatalog(catalog: KeaPlanCatalog) {
  const next = normalizeCatalog(catalog)
  memoryCatalog = structuredClone(next)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Keep memory catalog so this session’s Subscription UI still matches Admin.
  }
  notifyCatalogChanged()
  return next
}

/** Subscribe to Admin catalog edits (same tab + other tabs). */
export function subscribePlanCatalog(listener: () => void) {
  if (typeof window === 'undefined') return () => {}

  function onStorage(event: StorageEvent) {
    if (event.key !== STORAGE_KEY && event.key != null) return
    memoryCatalog = null
    listener()
  }

  function onCustom() {
    listener()
  }

  function onFocus() {
    memoryCatalog = null
    listener()
  }

  function onVisibility() {
    if (document.visibilityState !== 'visible') return
    memoryCatalog = null
    listener()
  }

  window.addEventListener(CHANGE_EVENT, onCustom)
  window.addEventListener('storage', onStorage)
  window.addEventListener('focus', onFocus)
  document.addEventListener('visibilitychange', onVisibility)

  return () => {
    window.removeEventListener(CHANGE_EVENT, onCustom)
    window.removeEventListener('storage', onStorage)
    window.removeEventListener('focus', onFocus)
    document.removeEventListener('visibilitychange', onVisibility)
  }
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
