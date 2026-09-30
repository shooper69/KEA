import { getSupabase } from '../lib/supabase'

/** Authorization header for spendy Kea APIs (chat / TTS / Whisper). */
export async function keaAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  try {
    const supabase = getSupabase()
    if (!supabase) return headers
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (token) headers.Authorization = `Bearer ${token}`
  } catch {
    // leave without bearer — server will 401
  }
  return headers
}
