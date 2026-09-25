import { activatePlan, type BillingState } from '../architecture/keaBilling'
import type { PlanId } from '../architecture/keaPlans'

export async function startKeaCheckout(options: {
  planId: PlanId
  planName: string
  monthlyPrice: number
  stripePriceId: string
  email: string
}) {
  const origin = window.location.origin
  const response = await fetch('/api/billing/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      planId: options.planId,
      planName: options.planName,
      monthlyPrice: options.monthlyPrice,
      stripePriceId: options.stripePriceId,
      email: options.email,
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
  )
  const data = (await response.json()) as {
    paid?: boolean
    planId?: string
    error?: string
  }
  if (!response.ok || !data.paid) return null
  const planId = data.planId
  if (planId !== 'starter' && planId !== 'companion' && planId !== 'unlimited') {
    return null
  }
  return activatePlan(planId, sessionId)
}
