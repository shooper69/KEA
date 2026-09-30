import { KEA_ADMIN_EMAIL } from '../config/keaAdmin.ts'
import {
  normalizeSubscriptionStatus,
  subscriptionGrantsAccess,
  type SubscriptionStatus,
} from './keaStripeBilling.ts'

type GateEnv = {
  SUPABASE_URL?: string
  SUPABASE_SERVICE_ROLE_KEY?: string
  VITE_SUPABASE_URL?: string
}

/** Matches default plan catalog trial length (server does not trust client catalog). */
const SERVER_TRIAL_DAYS = 7

export type TalkAccessGate =
  | { ok: true }
  | { ok: false; error: string; status: number }

function isAdminEmail(email: string) {
  return email.trim().toLowerCase() === KEA_ADMIN_EMAIL.trim().toLowerCase()
}

async function readTalkProfile(
  env: GateEnv,
  userId: string,
): Promise<{
  email: string | null
  status: SubscriptionStatus
  createdAt: string | null
} | null> {
  const url = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').trim().replace(/\/$/, '')
  const service = (env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  if (!url.includes('laubnngplqvsxokbfski') || !service) return null

  const endpoint = `${url}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=email,subscription_status,created_at&limit=1`
  const response = await fetch(endpoint, {
    headers: {
      apikey: service,
      Authorization: `Bearer ${service}`,
      Accept: 'application/json',
    },
  })
  if (!response.ok) return null
  const data = (await response.json()) as unknown
  if (!Array.isArray(data) || !data[0]) return null
  const row = data[0] as Record<string, unknown>
  return {
    email: typeof row.email === 'string' ? row.email : null,
    status: normalizeSubscriptionStatus(
      typeof row.subscription_status === 'string'
        ? row.subscription_status
        : 'none',
    ),
    createdAt: typeof row.created_at === 'string' ? row.created_at : null,
  }
}

function trialStillOpen(createdAt: string | null) {
  if (!createdAt) return true
  const started = new Date(createdAt).getTime()
  if (!Number.isFinite(started)) return true
  const ends = started + SERVER_TRIAL_DAYS * 24 * 60 * 60 * 1000
  return Date.now() <= ends
}

/**
 * Server talk gate: cloud subscription / trial / admin email.
 * Does not trust browser localStorage billing.
 */
export async function requireKeaTalkAccess(
  env: GateEnv,
  auth: { userId: string; email: string },
): Promise<TalkAccessGate> {
  if (isAdminEmail(auth.email)) return { ok: true }

  const profile = await readTalkProfile(env, auth.userId)
  if (!profile) {
    const service = (env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
    // Local without service role: do not block development.
    if (!service) return { ok: true }
    // Profile row not readable yet — allow; trigger usually creates it on signup.
    return { ok: true }
  }

  if (isAdminEmail(profile.email || auth.email)) return { ok: true }

  if (subscriptionGrantsAccess(profile.status)) return { ok: true }

  if (trialStillOpen(profile.createdAt)) return { ok: true }

  return {
    ok: false,
    status: 402,
    error:
      'Your free trial has ended. Choose a plan in Subscription to keep talking.',
  }
}

/** Shared env bag for Netlify + Vite API plugins. */
export function talkAccessEnvFromProcess(): GateEnv {
  return {
    SUPABASE_URL: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
  }
}
