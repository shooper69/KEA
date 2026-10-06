import {
  getPlan,
  loadPlanCatalog,
  type PlanId,
} from './keaPlans'
import { isAdminEmail } from './adminAuth'
import { recordTalkPerformanceSeconds } from './keaTalkPerformance'

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

export type BillingStatus =
  | 'trial'
  | 'active'
  | 'expired'
  | 'past_due'
  | 'canceled'

export interface BillingState {
  trialStartedAt: string
  status: BillingStatus
  planId: PlanId | null
  stripeSessionId: string
  stripeCustomerId: string
  stripeSubscriptionId: string
  subscribedAt: string
  currentPeriodEnd: string
}

export type TalkBlockReason = 'ok' | 'trial-expired' | 'daily-limit' | 'canceled'

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
    stripeCustomerId: '',
    stripeSubscriptionId: '',
    subscribedAt: '',
    currentPeriodEnd: '',
  }
}

function asPlanId(value: unknown): PlanId | null {
  return value === 'starter' || value === 'companion' || value === 'unlimited'
    ? value
    : null
}

export function loadBilling(): BillingState {
  try {
    const raw = localStorage.getItem(BILLING_KEY)
    if (!raw) return emptyBilling()
    const parsed = JSON.parse(raw) as Partial<BillingState>
    return {
      ...emptyBilling(),
      ...parsed,
      planId: asPlanId(parsed.planId),
      status:
        parsed.status === 'active' ||
        parsed.status === 'expired' ||
        parsed.status === 'past_due' ||
        parsed.status === 'canceled' ||
        parsed.status === 'trial'
          ? parsed.status
          : 'trial',
      stripeCustomerId: String(parsed.stripeCustomerId ?? ''),
      stripeSubscriptionId: String(parsed.stripeSubscriptionId ?? ''),
      currentPeriodEnd: String(parsed.currentPeriodEnd ?? ''),
    }
  } catch {
    return emptyBilling()
  }
}

/** Paid plan on this device (does not start a trial). */
export function hasActiveSubscription() {
  const state = loadBilling()
  return (
    (state.status === 'active' || state.status === 'past_due') &&
    Boolean(state.planId)
  )
}

export function saveBilling(state: BillingState) {
  localStorage.setItem(BILLING_KEY, JSON.stringify(state))
  window.dispatchEvent(new Event('kea-billing-changed'))
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
  if (state.status === 'past_due' && state.planId) {
    saveBilling(state)
    return state
  }
  if (state.status === 'canceled') {
    const next: BillingState = { ...state, status: 'canceled', planId: state.planId }
    saveBilling(next)
    return next
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

export function activatePlan(
  planId: PlanId,
  stripeSessionId = '',
  extras: {
    customerId?: string
    subscriptionId?: string
    currentPeriodEnd?: string
    status?: BillingStatus
  } = {},
) {
  const current = loadBilling()
  const next: BillingState = {
    ...current,
    status: extras.status === 'past_due' ? 'past_due' : 'active',
    planId,
    stripeSessionId,
    stripeCustomerId: extras.customerId || current.stripeCustomerId,
    stripeSubscriptionId: extras.subscriptionId || current.stripeSubscriptionId,
    currentPeriodEnd: extras.currentPeriodEnd || current.currentPeriodEnd,
    subscribedAt: new Date().toISOString(),
    trialStartedAt: current.trialStartedAt || new Date().toISOString(),
  }
  saveBilling(next)
  return next
}

/** Apply Stripe/cloud subscription fields onto local access state. */
export function applyCloudSubscription(input: {
  planId?: string | null
  status?: string | null
  customerId?: string | null
  subscriptionId?: string | null
  currentPeriodEnd?: string | null
}) {
  const planId = asPlanId(input.planId)
  const statusRaw = (input.status || '').toLowerCase()
  const current = loadBilling()
  if (
    statusRaw === 'active' ||
    statusRaw === 'trialing' ||
    statusRaw === 'past_due'
  ) {
    if (!planId) return current
    return activatePlan(planId, current.stripeSessionId, {
      customerId: input.customerId || undefined,
      subscriptionId: input.subscriptionId || undefined,
      currentPeriodEnd: input.currentPeriodEnd || undefined,
      status: statusRaw === 'past_due' ? 'past_due' : 'active',
    })
  }
  if (
    statusRaw === 'canceled' ||
    statusRaw === 'unpaid' ||
    statusRaw === 'incomplete_expired'
  ) {
    const next: BillingState = {
      ...current,
      status: 'canceled',
      planId: planId ?? current.planId,
      stripeCustomerId: input.customerId || current.stripeCustomerId,
      stripeSubscriptionId:
        input.subscriptionId || current.stripeSubscriptionId,
      currentPeriodEnd: input.currentPeriodEnd || current.currentPeriodEnd,
    }
    saveBilling(next)
    return next
  }
  return current
}

export function clearPaidSubscription() {
  const current = loadBilling()
  const next: BillingState = {
    ...current,
    status: 'expired',
    planId: null,
    stripeSubscriptionId: '',
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
  minutesLeft: number
  usedPercent: number
  remainingPercent: number
  unlimited: boolean
  dailyMinutesAllowed: number
}

const ADMIN_USAGE_ORIGIN_KEY = 'kea-admin-usage-origin-minutes'

/** One admin meter cycle, from 10% to 100%, matches a Companion month. */
function adminCycleMinutes() {
  const plan = getPlan('companion')
  const daily = plan?.dailyMinutes && plan.dailyMinutes > 0 ? plan.dailyMinutes : 45
  return daily * daysInCurrentMonth()
}

/**
 * Admin has no talk cap. The meter still shows usage: it starts at 10%
 * and returns to 10% whenever it would pass 100%.
 */
function adminUsedPercent(minutesUsed: number) {
  const span = Math.max(1, adminCycleMinutes())
  let origin = Number(localStorage.getItem(ADMIN_USAGE_ORIGIN_KEY))
  if (!Number.isFinite(origin)) {
    origin = minutesUsed
    localStorage.setItem(ADMIN_USAGE_ORIGIN_KEY, String(origin))
  }
  let extra = minutesUsed - origin
  if (extra < 0) {
    origin = minutesUsed
    extra = 0
    localStorage.setItem(ADMIN_USAGE_ORIGIN_KEY, String(origin))
  }
  const cycles = Math.floor(extra / span)
  if (cycles > 0) {
    origin += cycles * span
    extra -= cycles * span
    localStorage.setItem(ADMIN_USAGE_ORIGIN_KEY, String(origin))
  }
  const percent = 10 + (extra / span) * 90
  if (percent >= 100) {
    localStorage.setItem(ADMIN_USAGE_ORIGIN_KEY, String(minutesUsed))
    return 10
  }
  return Math.max(10, Math.min(99, Math.round(percent)))
}

/**
 * Monthly entitlement = soft daily pace × days in this calendar month.
 * The commercial SKU is monthly hours; daily pace is only a pacing guide.
 * Usage is the sum of stored talk seconds (no separate Stripe usage ledger).
 * Unlimited / admin (daily pace 0) has no monthly ceiling.
 */
export function getMonthlyCreditUsage(isAdmin = false): MonthlyCreditUsage {
  const access = getTalkAccess(isAdmin)
  const minutesUsed = minutesUsedThisMonth()
  const unlimited = access.dailyMinutesAllowed <= 0
  const minutesAllowed = unlimited
    ? 0
    : access.dailyMinutesAllowed * daysInCurrentMonth()
  const usedPercent = isAdmin
    ? adminUsedPercent(minutesUsed)
    : unlimited || minutesAllowed <= 0
      ? 0
      : Math.min(100, Math.round((minutesUsed / minutesAllowed) * 100))
  const remainingPercent = Math.max(0, 100 - usedPercent)
  const minutesLeft = unlimited
    ? 0
    : Math.max(0, Math.round((minutesAllowed - minutesUsed) * 10) / 10)
  return {
    minutesUsed,
    minutesAllowed,
    minutesLeft,
    usedPercent,
    remainingPercent,
    unlimited: isAdmin ? false : unlimited,
    dailyMinutesAllowed: access.dailyMinutesAllowed,
  }
}

export function recordTalkSeconds(seconds: number) {
  const add = Math.max(0, seconds)
  if (!add) return
  recordTalkPerformanceSeconds(add)
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
      status: state.status === 'active' || state.status === 'past_due' ? state.status : 'trial',
      planId: state.planId,
      trialDaysLeft: trialDaysLeft(state),
      dailyMinutesAllowed: 0,
      minutesUsedToday: used,
      minutesLeftToday: 999,
    }
  }
  if (
    (state.status === 'active' || state.status === 'past_due') &&
    state.planId
  ) {
    const plan = getPlan(state.planId, catalog)
    const allowed = plan.dailyMinutes
    const left = allowed <= 0 ? 999 : Math.max(0, allowed - used)
    const ok = allowed <= 0 || used < allowed
    return {
      ok,
      reason: ok ? 'ok' : 'daily-limit',
      status: state.status,
      planId: state.planId,
      trialDaysLeft: 0,
      dailyMinutesAllowed: allowed,
      minutesUsedToday: used,
      minutesLeftToday: left,
    }
  }
  if (state.status === 'canceled') {
    return {
      ok: false,
      reason: 'canceled',
      status: 'canceled',
      planId: state.planId,
      trialDaysLeft: 0,
      dailyMinutesAllowed: catalog.trialDailyMinutes,
      minutesUsedToday: used,
      minutesLeftToday: 0,
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
