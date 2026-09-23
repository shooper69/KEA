import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  KEA_PUBLIC_SUPABASE_ANON_KEY,
  KEA_PUBLIC_SUPABASE_URL,
} from '../config/keaPublic'

/** Kea Production only. Never point this at another product. */
export const KEA_SUPABASE_URL = KEA_PUBLIC_SUPABASE_URL
export const KEA_PROJECT_REF = 'laubnngplqvsxokbfski'

const url = (import.meta.env.VITE_SUPABASE_URL || KEA_SUPABASE_URL).trim()
const anonKey = (
  import.meta.env.VITE_SUPABASE_ANON_KEY || KEA_PUBLIC_SUPABASE_ANON_KEY
).trim()

let client: SupabaseClient | null = null

const memoryStore = new Map<string, string>()
const memoryStorage: Storage = {
  get length() {
    return memoryStore.size
  },
  clear() {
    memoryStore.clear()
  },
  getItem(key) {
    return memoryStore.has(key) ? memoryStore.get(key)! : null
  },
  key(index) {
    return [...memoryStore.keys()][index] ?? null
  },
  removeItem(key) {
    memoryStore.delete(key)
  },
  setItem(key, value) {
    memoryStore.set(key, value)
  },
}

function authStorage(): Storage {
  try {
    const probe = 'kea-auth-probe'
    window.localStorage.setItem(probe, '1')
    window.localStorage.removeItem(probe)
    return window.localStorage
  } catch {
    return memoryStorage
  }
}

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
        storage: authStorage(),
      },
    })
  }
  return client
}
