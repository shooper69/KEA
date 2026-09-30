import type { IncomingMessage, ServerResponse } from 'node:http'
import { requireKeaUser } from './keaUserAuth.ts'
import { readProfileBilling } from './keaStripeBilling.ts'
import {
  KEA_PUBLIC_SUPABASE_URL,
} from '../config/keaPublic.ts'

type DeleteEnv = {
  SUPABASE_URL?: string
  SUPABASE_SERVICE_ROLE_KEY?: string
  STRIPE_SECRET_KEY?: string
}

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

function reqHeaders(req: IncomingMessage): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {}
  for (const [key, value] of Object.entries(req.headers)) {
    out[key] = Array.isArray(value) ? value[0] : value
  }
  return out
}

async function cancelStripeSubscription(
  apiKey: string,
  subscriptionId: string | null,
) {
  if (!subscriptionId) return
  try {
    await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${apiKey}` },
    })
  } catch {
    // Best-effort — account delete still proceeds.
  }
}

/**
 * Delete the signed-in user's Kea cloud account and cascaded rows
 * (profiles, learn_list, conversation_topics, user_daily_stats).
 */
export async function handleKeaAccountDelete(
  req: IncomingMessage,
  res: ServerResponse,
  env: DeleteEnv,
) {
  if (req.method !== 'POST') {
    json(res, 405, { error: 'Method not allowed' })
    return
  }

  const auth = await requireKeaUser(reqHeaders(req))
  if (!auth.ok) {
    json(res, auth.status, { error: auth.error })
    return
  }

  // Consume body if present (clients may send confirm: true).
  try {
    await readBody(req)
  } catch {
    // ignore
  }

  const url = (env.SUPABASE_URL || KEA_PUBLIC_SUPABASE_URL).trim().replace(/\/$/, '')
  const service = (env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  if (!url.includes('laubnngplqvsxokbfski') || !service) {
    json(res, 501, {
      error: 'Account delete is not configured on this server yet.',
    })
    return
  }

  const billing = await readProfileBilling(env, auth.userId)
  const stripeKey = env.STRIPE_SECRET_KEY?.trim()
  if (stripeKey && billing?.subscriptionId) {
    await cancelStripeSubscription(stripeKey, billing.subscriptionId)
  }

  const del = await fetch(`${url}/auth/v1/admin/users/${auth.userId}`, {
    method: 'DELETE',
    headers: {
      apikey: service,
      Authorization: `Bearer ${service}`,
    },
  })
  if (!del.ok) {
    const text = await del.text()
    json(res, 502, {
      error: text.trim() || 'Could not delete the Kea account.',
    })
    return
  }

  json(res, 200, { ok: true, deletedUserId: auth.userId })
}
