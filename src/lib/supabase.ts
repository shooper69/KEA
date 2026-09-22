import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/** Kea Production only. Never point this at another product. */
export const KEA_SUPABASE_URL = 'https://laubnngplqvsxokbfski.supabase.co'
export const KEA_PROJECT_REF = 'laubnngplqvsxokbfski'

const url = (import.meta.env.VITE_SUPABASE_URL || KEA_SUPABASE_URL).trim()
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim()

let client: SupabaseClient | null = null

export function isKeaCloudConfigured() {
  return Boolean(anonKey) && url.includes(KEA_PROJECT_REF)
}

export function getSupabase(): SupabaseClient | null {
  if (!isKeaCloudConfigured()) return null
  if (!client) {
    client = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  }
  return client
}
