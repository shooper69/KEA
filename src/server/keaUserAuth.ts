import { createClient } from '@supabase/supabase-js'
import {
  KEA_PUBLIC_SUPABASE_ANON_KEY,
  KEA_PUBLIC_SUPABASE_URL,
} from '../config/keaPublic.ts'

export type KeaUserAuth =
  | { ok: true; userId: string; email: string }
  | { ok: false; error: string; status: number }

function headerValue(
  headers: Record<string, string | undefined> | undefined,
  name: string,
): string | null {
  if (!headers) return null
  const want = name.toLowerCase()
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === want && value) return value
  }
  return null
}

/** Require a signed-in Kea Supabase user (Bearer access token). */
export async function requireKeaUser(
  headers: Record<string, string | undefined> | undefined,
): Promise<KeaUserAuth> {
  const authHeader = headerValue(headers, 'authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return { ok: false, error: 'Sign in to use Kea.', status: 401 }
  }
  const token = authHeader.slice(7).trim()
  if (!token) {
    return { ok: false, error: 'Sign in to use Kea.', status: 401 }
  }

  const url = (process.env.SUPABASE_URL || KEA_PUBLIC_SUPABASE_URL).trim()
  const anon = (
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    KEA_PUBLIC_SUPABASE_ANON_KEY
  ).trim()
  const supabase = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user?.id) {
    return { ok: false, error: 'Session expired. Sign in again.', status: 401 }
  }
  return {
    ok: true,
    userId: data.user.id,
    email: (data.user.email || '').trim().toLowerCase(),
  }
}
