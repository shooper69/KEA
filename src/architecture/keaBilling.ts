import {
  getPlan,
  loadPlanCatalog,
  type PlanId,
} from './keaPlans'

const BILLING_KEY = 'kea-billing-v1'
const USAGE_PREFIX = 'kea-usage-'

export type BillingStatus = 'trial' | 'active' | 'expired'

export interface BillingState {
  trialStartedAt: string
  status: BillingStatus
  planId: PlanId | null
  stripeSessionId: string
  subscribedAt: string
}

export type TalkBlockReason = 'ok' | 'trial-expired' | 'daily-limit'

export interface TalkAccess {
  ok: boolean
  reason: TalkBlockReason
  status: BillingStatus
  planId: PlanId | null
  trialDaysLeft: number
  dailyMinutesAllowed: number
  minutesUsedToday: number
  minutesLeftToday: number
}

function todayKey() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${USAGE_PREFIX}${y}-${m}-${d}`
}

function emptyBilling(): BillingState {
  return {
    trialStartedAt: '',
    status: 'trial',
    planId: null,
    stripeSessionId: '',
    subscribedAt: '',
  }
}

export function loadBilling(): BillingState {
  try {
    const raw = localStorage.getItem(BILLING_KEY)
    if (!raw) return emptyBilling()
    const parsed = JSON.parse(raw) as Partial<BillingState>
    return {
      ...emptyBilling(),
      ...parsed,
      planId:
        parsed.planId === 'starter' ||
        parsed.planId === 'companion' ||
        parsed.planId === 'unlimited'
          ? parsed.planId
          : null,
    }
  } catch {
    return emptyBilling()
  }
}

export function saveBilling(state: BillingState) {
  localStorage.setItem(BILLING_KEY, JSON.stringify(state))
}

export function ensureTrialStarted(): BillingState {
  const current = loadBilling()
  if (current.trialStartedAt) return refreshBillingStatus(current)
  const next = {
    ...current,
    trialStartedAt: new Date().toISOString(),
    status: 'trial' as const,
  }
  saveBilling(next)
  return next
}

export function refreshBillingStatus(state = loadBilling()): BillingState {
  if (state.status === 'active' && state.planId) {
    saveBilling(state)
    return state
  }
  const catalog = loadPlanCatalog()
  const started = state.trialStartedAt
    ? new Date(state.trialStartedAt).getTime()
    : 0
  const ends = started + catalog.trialDays * 24 * 60 * 60 * 1000
  const next: BillingState = {
    ...state,
    status: started && Date.now() > ends ? 'expired' : 'trial',
  }
  saveBilling(next)
  return next
}

export function activatePlan(planId: PlanId, stripeSessionId = '') {
  const next: BillingState = {
    ...loadBilling(),
    status: 'active',
    planId,
    stripeSessionId,
    subscribedAt: new Date().toISOString(),
    trialStartedAt: loadBilling().trialStartedAt || new Date().toISOString(),
  }
  saveBilling(next)
  return next
}

export function minutesUsedToday() {
  try {
    const raw = localStorage.getItem(todayKey())
    const parsed = raw ? (JSON.parse(raw) as { seconds?: number }) : null
    const seconds = Number(parsed?.seconds)
    return Number.isFinite(seconds) ? seconds / 60 : 0
  } catch {
    return 0
  }
}

export function recordTalkSeconds(seconds: number) {
  const add = Math.max(0, seconds)
  if (!add) return
  const used = minutesUsedToday() * 60 + add
  localStorage.setItem(todayKey(), JSON.stringify({ seconds: used }))
}

export function trialDaysLeft(state = refreshBillingStatus()) {
  const catalog = loadPlanCatalog()
  if (!state.trialStartedAt || state.status === 'active') return 0
  const ends =
    new Date(state.trialStartedAt).getTime() +
    catalog.trialDays * 24 * 60 * 60 * 1000
  return Math.max(0, Math.ceil((ends - Date.now()) / (24 * 60 * 60 * 1000)))
}

export function getTalkAccess(isAdmin = false): TalkAccess {
  const catalog = loadPlanCatalog()
  const state = ensureTrialStarted()
  const used = minutesUsedToday()
  if (isAdmin) {
    return {
      ok: true,
      reason: 'ok',
      status: state.status === 'active' ? 'active' : 'trial',
      planId: state.planId,
      trialDaysLeft: trialDaysLeft(state),
      dailyMinutesAllowed: 0,
      minutesUsedToday: used,
      minutesLeftToday: 999,
    }
  }
  if (state.status === 'active' && state.planId) {
    const plan = getPlan(state.planId, catalog)
    const allowed = plan.dailyMinutes
    const left = allowed <= 0 ? 999 : Math.max(0, allowed - used)
    const ok = allowed <= 0 || used < allowed
    return {
      ok,
      reason: ok ? 'ok' : 'daily-limit',
      status: 'active',
      planId: state.planId,
      trialDaysLeft: 0,
      dailyMinutesAllowed: allowed,
      minutesUsedToday: used,
      minutesLeftToday: left,
    }
  }
  if (state.status === 'expired') {
    return {
      ok: false,
      reason: 'trial-expired',
      status: 'expired',
      planId: null,
      trialDaysLeft: 0,
      dailyMinutesAllowed: catalog.trialDailyMinutes,
      minutesUsedToday: used,
      minutesLeftToday: 0,
    }
  }
  const allowed = catalog.trialDailyMinutes
  const left = Math.max(0, allowed - used)
  const ok = used < allowed
  return {
    ok,
    reason: ok ? 'ok' : 'daily-limit',
    status: 'trial',
    planId: null,
    trialDaysLeft: trialDaysLeft(state),
    dailyMinutesAllowed: allowed,
    minutesUsedToday: used,
    minutesLeftToday: left,
  }
}
