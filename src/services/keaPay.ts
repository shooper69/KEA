import {
  activatePlan,
  applyCloudSubscription,
  loadBilling,
  type BillingState,
} from '../architecture/keaBilling'
import type { PlanId } from '../architecture/keaPlans'
import { getSupabase } from '../lib/supabase'
import { keaAuthHeaders } from './keaAuthHeaders'

export async function startKeaCheckout(options: {
  planId: PlanId
  email: string
  discountCode?: string
}) {
  const origin = window.location.origin
  const response = await fetch('/api/billing/checkout', {
    method: 'POST',
    headers: await keaAuthHeaders(),
    body: JSON.stringify({
      planId: options.planId,
      email: options.email,
      discountCode: options.discountCode || '',
      successUrl: `${origin}/subscription?checkout=success`,
      cancelUrl: `${origin}/subscription?checkout=cancel`,
    }),
  })
  const data = (await response.json()) as { url?: string; error?: string }
  if (!response.ok || !data.url) {
    throw new Error(data.error ?? 'Could not start checkout')
  }
  window.location.assign(data.url)
}

export async function confirmCheckoutSession(
  sessionId: string,
): Promise<BillingState | null> {
  const response = await fetch(
    `/api/billing/session?id=${encodeURIComponent(sessionId)}`,
    { headers: await keaAuthHeaders() },
  )
  const data = (await response.json()) as {
    paid?: boolean
    planId?: string
    customer?: string
    subscription?: string
    subscriptionStatus?: string
    currentPeriodEnd?: string | null
    error?: string
  }
  if (!response.ok || !data.paid) return null
  const planId = data.planId
  if (planId !== 'starter' && planId !== 'companion' && planId !== 'unlimited') {
    return null
  }
  return activatePlan(planId, sessionId, {
    customerId: data.customer || undefined,
    subscriptionId: data.subscription || undefined,
    currentPeriodEnd: data.currentPeriodEnd || undefined,
    status: data.subscriptionStatus === 'past_due' ? 'past_due' : 'active',
  })
}

export async function openKeaBillingPortal() {
  const response = await fetch('/api/billing/portal', {
    method: 'POST',
    headers: await keaAuthHeaders(),
    body: JSON.stringify({
      returnUrl: `${window.location.origin}/subscription`,
    }),
  })
  const data = (await response.json()) as { url?: string; error?: string }
  if (!response.ok || !data.url) {
    throw new Error(data.error ?? 'Could not open billing portal')
  }
  window.location.assign(data.url)
}

/** Pull subscription fields from Kea Production profile into local access. */
export async function syncBillingFromCloud(userId: string) {
  const supabase = getSupabase()
  if (!supabase) return loadBilling()
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'stripe_customer_id, stripe_subscription_id, subscription_plan_id, subscription_status, subscription_current_period_end',
    )
    .eq('id', userId)
    .maybeSingle()
  if (error || !data) return loadBilling()
  return applyCloudSubscription({
    planId: data.subscription_plan_id,
    status: data.subscription_status,
    customerId: data.stripe_customer_id,
    subscriptionId: data.stripe_subscription_id,
    currentPeriodEnd: data.subscription_current_period_end,
  })
}
