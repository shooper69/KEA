import {
  getPlan,
  loadPlanCatalog,
  type PlanId,
} from './keaPlans'
import { isAdminEmail } from './adminAuth'

const BILLING_KEY = 'kea-billing-v1'
const USAGE_PREFIX = 'kea-usage-'
const PROFILE_STORAGE_KEY = 'kea-profile'

function storedProfileIsAdmin() {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY)
    if (!raw) return false
    const email = String((JSON.parse(raw) as { email?: string }).email ?? '')
    return isAdminEmail(email)
  } catch {
    return false
  }
}

/** Admin (simonghooper@gmail.com) never hits a talk time cap. */
export function hasUnlimitedTalk(isAdminFlag = false) {
  return Boolean(isAdminFlag) || storedProfileIsAdmin()
}

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

function pad2(value: number) {
  return String(value).padStart(2, '0')
}

function todayKey() {
  const now = new Date()
  return `${USAGE_PREFIX}${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`
}

export function calendarMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`
}

function monthUsagePrefix(yyyyMm = calendarMonthKey()) {
  return `${USAGE_PREFIX}${yyyyMm}-`
}

function secondsFromUsageRaw(raw: string | null) {
  if (!raw) return 0
  try {
    const parsed = JSON.parse(raw) as { seconds?: number }
    const seconds = Number(parsed?.seconds)
    return Number.isFinite(seconds) ? seconds : 0
  } catch {
    return 0
  }
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
  return secondsFromUsageRaw(localStorage.getItem(todayKey())) / 60
}

/** Sum of stored talk seconds for every day in the given calendar month (YYYY-MM). */
export function minutesUsedInMonth(yyyyMm = calendarMonthKey()) {
  const prefix = monthUsagePrefix(yyyyMm)
  let seconds = 0
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i)
      if (!key?.startsWith(prefix)) continue
      seconds += secondsFromUsageRaw(localStorage.getItem(key))
    }
  } catch {
    return 0
  }
  return seconds / 60
}

/** Sum of stored talk seconds for every day in the current calendar month. */
export function minutesUsedThisMonth() {
  return minutesUsedInMonth()
}

export function daysInCurrentMonth() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
}

export interface MonthlyCreditUsage {
  minutesUsed: number
  minutesAllowed: number
  usedPercent: number
  remainingPercent: number
  unlimited: boolean
  dailyMinutesAllowed: number
}

/**
 * Monthly credits are the daily talk cap × days in this calendar month.
 * Usage is the sum of stored daily talk seconds (there is no separate Stripe
 * usage ledger). Unlimited / admin (daily cap 0) has no monthly ceiling.
 */
export function getMonthlyCreditUsage(isAdmin = false): MonthlyCreditUsage {
  const access = getTalkAccess(isAdmin)
  const minutesUsed = minutesUsedThisMonth()
  const unlimited = access.dailyMinutesAllowed <= 0
  const minutesAllowed = unlimited
    ? 0
    : access.dailyMinutesAllowed * daysInCurrentMonth()
  const usedPercent =
    unlimited || minutesAllowed <= 0
      ? 0
      : Math.min(100, Math.round((minutesUsed / minutesAllowed) * 100))
  return {
    minutesUsed,
    minutesAllowed,
    usedPercent,
    remainingPercent: unlimited ? 100 : Math.max(0, 100 - usedPercent),
    unlimited,
    dailyMinutesAllowed: access.dailyMinutesAllowed,
  }
}

export function recordTalkSeconds(seconds: number) {
  if (hasUnlimitedTalk()) return
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
  if (hasUnlimitedTalk(isAdmin)) {
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
