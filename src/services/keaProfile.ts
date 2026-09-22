import { getSupabase } from '../lib/supabase'
import { isLanguageCode } from '../config/languages'
import { DEFAULT_VOICE_CHARACTER } from '../config/voices'
import type { LanguageCode, VoicePersonalityId } from '../types'

const VOICES: VoicePersonalityId[] = ['luna', 'mira', 'sage', 'rowan', 'theo']

export function isVoicePersonalityId(value: string | null | undefined): value is VoicePersonalityId {
  return Boolean(value && VOICES.includes(value as VoicePersonalityId))
}

export interface CloudProfile {
  firstName: string
  nativeLanguage: LanguageCode | null
  targetLanguage: LanguageCode | null
  preferredVoice: VoicePersonalityId
  avatarUrl: string
  listenIdleSeconds: number
  skyTheme: 'clouds' | 'weather'
  chatKeep: 'device' | 'cloud'
  notifyMemory: boolean
  notifyTalk: boolean
  saveTranscripts: boolean
}

function asProfile(row: Record<string, unknown> | null): CloudProfile | null {
  if (!row) return null
  const native = typeof row.native_language === 'string' ? row.native_language : ''
  const target = typeof row.target_language === 'string' ? row.target_language : ''
  const voice = typeof row.preferred_voice === 'string' ? row.preferred_voice : ''
  const listen = Number(row.listen_idle_seconds)
  return {
    firstName: typeof row.first_name === 'string' ? row.first_name : '',
    nativeLanguage: isLanguageCode(native) ? native : null,
    targetLanguage: isLanguageCode(target) ? target : null,
    preferredVoice: isVoicePersonalityId(voice) ? voice : DEFAULT_VOICE_CHARACTER,
    avatarUrl: typeof row.avatar_url === 'string' ? row.avatar_url : '',
    listenIdleSeconds:
      Number.isFinite(listen) && listen >= 3 ? Math.min(60, Math.round(listen)) : 10,
    skyTheme: row.sky_theme === 'weather' ? 'weather' : 'clouds',
    chatKeep: row.chat_keep === 'cloud' ? 'cloud' : 'device',
    notifyMemory: row.notify_memory !== false,
    notifyTalk: row.notify_talk !== false,
    saveTranscripts: row.save_transcripts !== false,
  }
}

export async function fetchCloudProfile(userId: string): Promise<CloudProfile | null> {
  const supabase = getSupabase()
  if (!supabase) return null
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'first_name, native_language, target_language, preferred_voice, avatar_url, listen_idle_seconds, sky_theme, chat_keep, notify_memory, notify_talk, save_transcripts',
    )
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  return asProfile(data)
}

export async function upsertCloudProfile(
  userId: string,
  patch: Partial<CloudProfile>,
): Promise<void> {
  const supabase = getSupabase()
  if (!supabase) return
  const row: Record<string, unknown> = { id: userId }
  if (patch.firstName !== undefined) row.first_name = patch.firstName
  if (patch.nativeLanguage !== undefined) row.native_language = patch.nativeLanguage
  if (patch.targetLanguage !== undefined) row.target_language = patch.targetLanguage
  if (patch.preferredVoice !== undefined) row.preferred_voice = patch.preferredVoice
  if (patch.avatarUrl !== undefined) row.avatar_url = patch.avatarUrl
  if (patch.listenIdleSeconds !== undefined) {
    row.listen_idle_seconds = patch.listenIdleSeconds
  }
  if (patch.skyTheme !== undefined) row.sky_theme = patch.skyTheme
  if (patch.chatKeep !== undefined) row.chat_keep = patch.chatKeep
  if (patch.notifyMemory !== undefined) row.notify_memory = patch.notifyMemory
  if (patch.notifyTalk !== undefined) row.notify_talk = patch.notifyTalk
  if (patch.saveTranscripts !== undefined) row.save_transcripts = patch.saveTranscripts
  const { error } = await supabase.from('profiles').upsert(row, { onConflict: 'id' })
  if (error) throw error
}

export function keaAuthRedirect() {
  return `${window.location.origin}/`
}

export function isPasswordRecoveryLocation() {
  if (typeof window === 'undefined') return false
  const hash = window.location.hash
  const search = window.location.search
  try {
    if (sessionStorage.getItem('kea-password-recovery') === '1') return true
  } catch {
    // ignore
  }
  return (
    hash.includes('type=recovery') ||
    search.includes('type=recovery')
  )
}

export function markPasswordRecovery() {
  try {
    sessionStorage.setItem('kea-password-recovery', '1')
  } catch {
    // ignore
  }
}

export function clearPasswordRecovery() {
  try {
    sessionStorage.removeItem('kea-password-recovery')
  } catch {
    // ignore
  }
}

export function authMessage(error: unknown, fallback: string) {
  const obj =
    error && typeof error === 'object' ? (error as Record<string, unknown>) : null
  const parts = [obj?.message, obj?.error_description, obj?.code, obj?.error]
    .filter((value): value is string => typeof value === 'string' && Boolean(value.trim()))
  const text = parts.join(' ')
  if (/already registered/i.test(text)) {
    return 'That email already has a Kea account. Sign in instead.'
  }
  if (
    /invalid login|invalid.?credential|invalid_grant|invalid_credentials|email or password/i.test(
      text,
    )
  ) {
    return 'Incorrect email or password.'
  }
  if (/email not confirmed|email_not_confirmed/i.test(text)) {
    return 'Please confirm your email first. Look for a note from Kea.'
  }
  if (/should be at least/i.test(text)) return 'Use at least 6 characters for your password.'
  if (/rate limit|over_request/i.test(text)) {
    return 'Too many tries. Wait a moment and try again.'
  }
  return text.trim() || fallback
}
