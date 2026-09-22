import { ADMIN_EMAIL } from '../config/languages'

const HASH_KEY = 'kea-admin-password-hash'
const SESSION_KEY = 'kea-admin-session'
export const DEFAULT_ADMIN_PASSWORD = 'Tester'

export function isAdminEmail(email: string) {
  return email.trim().toLowerCase() === ADMIN_EMAIL
}

async function sha256(text: string) {
  const bytes = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function storedHash() {
  try {
    return localStorage.getItem(HASH_KEY)
  } catch {
    return null
  }
}

export async function verifyAdminPassword(password: string) {
  const incoming = await sha256(password)
  const saved = storedHash()
  if (saved) return incoming === saved
  return incoming === (await sha256(DEFAULT_ADMIN_PASSWORD))
}

export async function changeAdminPassword(current: string, next: string) {
  if (!(await verifyAdminPassword(current))) return false
  if (next.trim().length < 4) return false
  try {
    localStorage.setItem(HASH_KEY, await sha256(next.trim()))
  } catch {
    return false
  }
  return true
}

export function isAdminSessionOpen() {
  try {
    return sessionStorage.getItem(SESSION_KEY) === '1'
  } catch {
    return false
  }
}

export function openAdminSession() {
  try {
    sessionStorage.setItem(SESSION_KEY, '1')
  } catch {
    // ignore
  }
}

export function closeAdminSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY)
  } catch {
    // ignore
  }
}
