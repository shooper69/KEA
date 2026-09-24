import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { KEA_PUBLIC_SUPABASE_URL } from '../../config/keaPublic.ts'

let client: SupabaseClient | null = null

/** Service-role client for Website Tracker (Netlify functions only). */
export function getWtSupabase(): SupabaseClient {
  if (client) return client
  const url = (process.env.SUPABASE_URL || KEA_PUBLIC_SUPABASE_URL).trim()
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  if (!url.includes('laubnngplqvsxokbfski') || !key) {
    throw new Error(
      'Kea Website Tracker needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for Kea Production.',
    )
  }
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return client
}
