import { expect, test } from '@playwright/test'
import {
  normalizeSubscriptionStatus,
  subscriptionGrantsAccess,
} from '../src/server/keaStripeBilling'
import { requireKeaTalkAccess } from '../src/server/keaTalkAccessGate'

test('subscription status grants talk for active and trial', () => {
  expect(subscriptionGrantsAccess(normalizeSubscriptionStatus('active'))).toBe(true)
  expect(subscriptionGrantsAccess(normalizeSubscriptionStatus('trialing'))).toBe(true)
  expect(subscriptionGrantsAccess(normalizeSubscriptionStatus('past_due'))).toBe(true)
  expect(subscriptionGrantsAccess(normalizeSubscriptionStatus('canceled'))).toBe(false)
  expect(subscriptionGrantsAccess(normalizeSubscriptionStatus('none'))).toBe(false)
})

test('talk access allows admin email without service role', async () => {
  const result = await requireKeaTalkAccess(
    {},
    { userId: 'admin-id', email: 'simonghooper@gmail.com' },
  )
  expect(result).toEqual({ ok: true })
})

test('talk access allows any user when service role is missing (local dev)', async () => {
  const result = await requireKeaTalkAccess(
    {},
    { userId: 'user-id', email: 'learner@example.com' },
  )
  expect(result).toEqual({ ok: true })
})
