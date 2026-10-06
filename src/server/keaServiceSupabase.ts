import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { KEA_PUBLIC_SUPABASE_URL } from '../config/keaPublic.ts'

let client: SupabaseClient | null = null
let missingLogged = false

/** Service-role client for server writes (usage logs, admin costs). Null if unset. */
export function getKeaServiceSupabase(): SupabaseClient | null {
  if (client) return client
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || KEA_PUBLIC_SUPABASE_URL).trim()
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  if (!url.includes('laubnngplqvsxokbfski') || !key) {
    if (!missingLogged) {
      missingLogged = true
      console.warn(
        '[kea-ai-usage] SUPABASE_SERVICE_ROLE_KEY not set; usage logging skipped.',
      )
    }
    return null
  }
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return client
}
