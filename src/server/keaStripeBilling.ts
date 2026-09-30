/**
 * Server-side Stripe ↔ Kea Production Supabase billing sync.
 * Uses service role only. Never expose this to the browser.
 */

export type KeaPlanId = 'starter' | 'companion' | 'unlimited'

export type SubscriptionStatus =
  | 'none'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'incomplete'
  | 'trialing'

/** Live Kea price IDs → plan. */
export const KEA_PRICE_TO_PLAN: Record<string, KeaPlanId> = {
  price_1UJqsa6G7iCRQAR8Scrj3QK0: 'starter',
  price_1UJqsb6G7iCRQAR8eywbl44K: 'companion',
  price_1UJqsd6G7iCRQAR87yJmgO4R: 'unlimited',
}

/** Plan → live Stripe Price id (server catalog only — never trust the browser). */
export const KEA_PLAN_TO_PRICE: Record<KeaPlanId, string> = {
  starter: 'price_1UJqsa6G7iCRQAR8Scrj3QK0',
  companion: 'price_1UJqsb6G7iCRQAR8eywbl44K',
  unlimited: 'price_1UJqsd6G7iCRQAR87yJmgO4R',
}

/** Server-trusted discount codes (mirror of product defaults; ignore client %). */
export const KEA_SERVER_DISCOUNTS: Array<{
  code: string
  percentOff: number
}> = [
  { code: "kea's friend", percentOff: 100 },
  { code: 'Flying', percentOff: 50 },
  { code: 'Superlearner', percentOff: 60 },
]

function normalizeDiscountCode(code: string) {
  return code.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function serverDiscountForCode(entry: string): {
  code: string
  percentOff: number
} | null {
  const needle = normalizeDiscountCode(entry)
  if (!needle) return null
  const hit = KEA_SERVER_DISCOUNTS.find(
    (item) => normalizeDiscountCode(item.code) === needle,
  )
  return hit ? { code: hit.code, percentOff: hit.percentOff } : null
}

export function priceIdForPlan(planId: KeaPlanId) {
  return KEA_PLAN_TO_PRICE[planId]
}

export function isKeaPlanId(value: unknown): value is KeaPlanId {
  return value === 'starter' || value === 'companion' || value === 'unlimited'
}

export function planIdFromPriceId(priceId: string | null | undefined) {
  if (!priceId) return null
  return KEA_PRICE_TO_PLAN[priceId] ?? null
}

export function normalizeSubscriptionStatus(
  status: string | null | undefined,
): SubscriptionStatus {
  switch (status) {
    case 'active':
    case 'trialing':
    case 'past_due':
    case 'canceled':
    case 'unpaid':
    case 'incomplete':
      return status
    case 'incomplete_expired':
      return 'canceled'
    default:
      return 'none'
  }
}

/** Paid access for talk gating. past_due keeps access while Stripe retries. */
export function subscriptionGrantsAccess(status: SubscriptionStatus) {
  return status === 'active' || status === 'trialing' || status === 'past_due'
}

export interface BillingProfilePatch {
  userId?: string | null
  customerId?: string | null
  subscriptionId?: string | null
  planId?: KeaPlanId | null
  status?: SubscriptionStatus
  currentPeriodEnd?: string | null
  email?: string | null
}

function supabaseConfig(env: {
  SUPABASE_URL?: string
  SUPABASE_SERVICE_ROLE_KEY?: string
}) {
  const url = (env.SUPABASE_URL || '').trim().replace(/\/$/, '')
  const key = (env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  if (!url || !key) return null
  if (!url.includes('laubnngplqvsxokbfski')) return null
  return { url, key }
}

async function supabaseRest(
  env: { SUPABASE_URL?: string; SUPABASE_SERVICE_ROLE_KEY?: string },
  path: string,
  init: RequestInit,
) {
  const cfg = supabaseConfig(env)
  if (!cfg) return { ok: false as const, status: 0, data: null }
  const response = await fetch(`${cfg.url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(init.headers ?? {}),
    },
  })
  const text = await response.text()
  let data: unknown = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  return { ok: response.ok, status: response.status, data }
}

export async function findProfileIdForBilling(
  env: { SUPABASE_URL?: string; SUPABASE_SERVICE_ROLE_KEY?: string },
  options: {
    userId?: string | null
    customerId?: string | null
    email?: string | null
  },
): Promise<string | null> {
  if (options.userId) return options.userId
  if (options.customerId) {
    const { ok, data } = await supabaseRest(
      env,
      `profiles?stripe_customer_id=eq.${encodeURIComponent(options.customerId)}&select=id&limit=1`,
      { method: 'GET' },
    )
    if (ok && Array.isArray(data) && data[0] && typeof data[0].id === 'string') {
      return data[0].id
    }
  }
  if (options.email?.trim()) {
    // Resolve auth user by email via admin API
    const cfg = supabaseConfig(env)
    if (!cfg) return null
    const response = await fetch(
      `${cfg.url}/auth/v1/admin/users?page=1&per_page=200`,
      {
        headers: {
          apikey: cfg.key,
          Authorization: `Bearer ${cfg.key}`,
        },
      },
    )
    if (!response.ok) return null
    const payload = (await response.json()) as {
      users?: Array<{ id?: string; email?: string }>
    }
    const needle = options.email.trim().toLowerCase()
    const match = payload.users?.find(
      (user) => (user.email || '').toLowerCase() === needle,
    )
    return match?.id ?? null
  }
  return null
}

export async function readProfileBilling(
  env: { SUPABASE_URL?: string; SUPABASE_SERVICE_ROLE_KEY?: string },
  userId: string,
): Promise<{
  customerId: string | null
  subscriptionId: string | null
  planId: string | null
  status: string | null
} | null> {
  const { ok, data } = await supabaseRest(
    env,
    `profiles?id=eq.${encodeURIComponent(userId)}&select=stripe_customer_id,stripe_subscription_id,subscription_plan_id,subscription_status&limit=1`,
    { method: 'GET' },
  )
  if (!ok || !Array.isArray(data) || !data[0]) return null
  const row = data[0] as Record<string, unknown>
  return {
    customerId:
      typeof row.stripe_customer_id === 'string' ? row.stripe_customer_id : null,
    subscriptionId:
      typeof row.stripe_subscription_id === 'string'
        ? row.stripe_subscription_id
        : null,
    planId:
      typeof row.subscription_plan_id === 'string'
        ? row.subscription_plan_id
        : null,
    status:
      typeof row.subscription_status === 'string'
        ? row.subscription_status
        : null,
  }
}

export async function upsertBillingProfile(
  env: { SUPABASE_URL?: string; SUPABASE_SERVICE_ROLE_KEY?: string },
  patch: BillingProfilePatch,
): Promise<{ ok: boolean; userId: string | null; error?: string }> {
  const userId = await findProfileIdForBilling(env, patch)
  if (!userId) {
    return { ok: false, userId: null, error: 'No matching Kea profile for billing event' }
  }
  const row: Record<string, unknown> = {
    id: userId,
    updated_at: new Date().toISOString(),
  }
  if (patch.customerId !== undefined) row.stripe_customer_id = patch.customerId
  if (patch.subscriptionId !== undefined) {
    row.stripe_subscription_id = patch.subscriptionId
  }
  if (patch.planId !== undefined) row.subscription_plan_id = patch.planId
  if (patch.status !== undefined) row.subscription_status = patch.status
  if (patch.currentPeriodEnd !== undefined) {
    row.subscription_current_period_end = patch.currentPeriodEnd
  }
  const { ok, data, status } = await supabaseRest(env, 'profiles?on_conflict=id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(row),
  })
  if (!ok) {
    return {
      ok: false,
      userId,
      error: `Supabase upsert failed (${status}): ${JSON.stringify(data)}`,
    }
  }
  return { ok: true, userId }
}

export function planFromSubscriptionObject(sub: Record<string, unknown>): {
  planId: KeaPlanId | null
  status: SubscriptionStatus
  customerId: string | null
  subscriptionId: string | null
  currentPeriodEnd: string | null
  userId: string | null
} {
  const meta = (sub.metadata ?? {}) as Record<string, string>
  const items = sub.items as
    | { data?: Array<{ price?: { id?: string } }> }
    | undefined
  const priceId = items?.data?.[0]?.price?.id ?? ''
  const fromMeta = isKeaPlanId(meta.planId) ? meta.planId : null
  const planId = fromMeta || planIdFromPriceId(priceId)
  const periodEnd =
    typeof sub.current_period_end === 'number'
      ? new Date(sub.current_period_end * 1000).toISOString()
      : null
  return {
    planId,
    status: normalizeSubscriptionStatus(
      typeof sub.status === 'string' ? sub.status : null,
    ),
    customerId: typeof sub.customer === 'string' ? sub.customer : null,
    subscriptionId: typeof sub.id === 'string' ? sub.id : null,
    currentPeriodEnd: periodEnd,
    userId: typeof meta.userId === 'string' ? meta.userId : null,
  }
}
