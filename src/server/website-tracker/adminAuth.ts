import { createClient } from '@supabase/supabase-js'
import { KEA_ADMIN_EMAIL } from '../../config/keaAdmin.ts'
import { KEA_PUBLIC_SUPABASE_ANON_KEY, KEA_PUBLIC_SUPABASE_URL } from '../../config/keaPublic.ts'

export type WtAdminAuth =
  | { ok: true; email: string }
  | { ok: false; error: string; status: number }

export async function requireWtAdmin(authHeader: string | null): Promise<WtAdminAuth> {
  if (!authHeader?.startsWith('Bearer ')) {
    return { ok: false, error: 'Unauthorized', status: 401 }
  }
  const token = authHeader.slice(7).trim()
  if (!token) return { ok: false, error: 'Unauthorized', status: 401 }

  const url = (process.env.SUPABASE_URL || KEA_PUBLIC_SUPABASE_URL).trim()
  const anon = (process.env.SUPABASE_ANON_KEY || KEA_PUBLIC_SUPABASE_ANON_KEY).trim()
  const supabase = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user?.email) {
    return { ok: false, error: 'Invalid session', status: 401 }
  }
  if (data.user.email.trim().toLowerCase() !== KEA_ADMIN_EMAIL.trim().toLowerCase()) {
    return { ok: false, error: 'Admin only', status: 403 }
  }
  return { ok: true, email: data.user.email }
}
