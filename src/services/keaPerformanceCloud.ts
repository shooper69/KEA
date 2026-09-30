import { getSupabase } from '../lib/supabase'

export interface DailyStatRow {
  day: string
  talkSeconds: number
  wordsAdded: number
  wordsRemoved: number
}

function asRow(raw: Record<string, unknown>): DailyStatRow | null {
  const day = typeof raw.day === 'string' ? raw.day.slice(0, 10) : ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null
  return {
    day,
    talkSeconds: Math.max(0, Math.round(Number(raw.talk_seconds) || 0)),
    wordsAdded: Math.max(0, Math.round(Number(raw.words_added) || 0)),
    wordsRemoved: Math.max(0, Math.round(Number(raw.words_removed) || 0)),
  }
}

export async function pullCloudDailyStats(
  userId: string,
): Promise<DailyStatRow[]> {
  const supabase = getSupabase()
  if (!supabase) return []
  const { data, error } = await supabase
    .from('user_daily_stats')
    .select('day, talk_seconds, words_added, words_removed')
    .eq('user_id', userId)
    .order('day', { ascending: true })
  if (error || !data) {
    if (error) console.warn('[Kea performance] cloud pull failed', error.message)
    return []
  }
  return data
    .map((row) => asRow(row as Record<string, unknown>))
    .filter((row): row is DailyStatRow => row !== null)
}

/** Upsert one day. Cloud keeps the higher counters when merging. */
export async function upsertCloudDailyStat(
  userId: string,
  row: DailyStatRow,
): Promise<void> {
  const supabase = getSupabase()
  if (!supabase) return
  const { data: existing } = await supabase
    .from('user_daily_stats')
    .select('talk_seconds, words_added, words_removed')
    .eq('user_id', userId)
    .eq('day', row.day)
    .maybeSingle()

  const prior = existing as
    | { talk_seconds?: number; words_added?: number; words_removed?: number }
    | null

  const payload = {
    user_id: userId,
    day: row.day,
    talk_seconds: Math.max(
      row.talkSeconds,
      Math.round(Number(prior?.talk_seconds) || 0),
    ),
    words_added: Math.max(
      row.wordsAdded,
      Math.round(Number(prior?.words_added) || 0),
    ),
    words_removed: Math.max(
      row.wordsRemoved,
      Math.round(Number(prior?.words_removed) || 0),
    ),
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase.from('user_daily_stats').upsert(payload, {
    onConflict: 'user_id,day',
  })
  if (error) {
    console.warn('[Kea performance] cloud upsert failed', row.day, error.message)
  }
}

export async function pushCloudDailyStats(
  userId: string,
  rows: DailyStatRow[],
): Promise<void> {
  const supabase = getSupabase()
  if (!supabase || rows.length === 0) return
  // Upsert in small batches so one failure does not drop the whole history.
  for (const row of rows) {
    await upsertCloudDailyStat(userId, row)
  }
}
