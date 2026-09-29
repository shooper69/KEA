import { getSupabase } from '../lib/supabase'
import { isLanguageCode } from '../config/languages'
import type { LanguageCode, LearnListItem } from '../types'

function asItem(row: Record<string, unknown>): LearnListItem | null {
  const term = typeof row.term === 'string' ? row.term.trim() : ''
  const language = typeof row.language_code === 'string' ? row.language_code : ''
  const id = typeof row.id === 'string' ? row.id : ''
  if (!term || !id || !isLanguageCode(language)) return null
  const status = row.status === 'reinforced' ? 'reinforced' : 'learning'
  return {
    id,
    term,
    translation: typeof row.translation === 'string' ? row.translation : '',
    languageCode: language as LanguageCode,
    createdAt: typeof row.created_at === 'string' ? row.created_at : new Date().toISOString(),
    lastReviewedAt:
      typeof row.last_reviewed_at === 'string' ? row.last_reviewed_at : new Date().toISOString(),
    practiceCount: Number(row.practice_count) || 0,
    status,
  }
}

export async function pullCloudLearnList(userId: string): Promise<LearnListItem[]> {
  const supabase = getSupabase()
  if (!supabase) return []
  const { data, error } = await supabase
    .from('learn_list')
    .select('id, term, translation, language_code, created_at, last_reviewed_at, practice_count, status')
    .eq('user_id', userId)
  if (error || !data) return []
  return data
    .map((row) => asItem(row as Record<string, unknown>))
    .filter((item): item is LearnListItem => item !== null)
}

export async function pushCloudLearnList(userId: string, items: LearnListItem[]) {
  const supabase = getSupabase()
  if (!supabase) return
  const local = items.filter((item) => item.term.trim() && !item.id.startsWith('sample-'))
  const { data, error } = await supabase
    .from('learn_list')
    .select('id, term, language_code')
    .eq('user_id', userId)
  if (error) {
    console.warn('[Kea learn] cloud pull for sync failed', error.message)
    return
  }
  const rows = (data ?? []) as Array<{ id: string; term: string; language_code: string }>
  const kept = new Set<string>()
  for (const item of local) {
    const match = rows.find(
      (row) =>
        row.language_code === item.languageCode &&
        row.term.trim().toLowerCase() === item.term.trim().toLowerCase(),
    )
    if (match) {
      kept.add(match.id)
      const { error: updateError } = await supabase
        .from('learn_list')
        .update({
          translation: item.translation,
          practice_count: item.practiceCount,
          status: item.status,
          last_reviewed_at: item.lastReviewedAt,
        })
        .eq('id', match.id)
        .eq('user_id', userId)
      if (updateError) {
        console.warn('[Kea learn] cloud update failed', item.term, updateError.message)
      }
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from('learn_list')
        .insert({
          user_id: userId,
          term: item.term,
          translation: item.translation,
          language_code: item.languageCode,
          practice_count: item.practiceCount,
          status: item.status,
          created_at: item.createdAt,
          last_reviewed_at: item.lastReviewedAt,
        })
        .select('id')
        .maybeSingle()
      if (insertError) {
        console.warn('[Kea learn] cloud insert failed', item.term, insertError.message)
        continue
      }
      if (inserted && typeof inserted.id === 'string') kept.add(inserted.id)
    }
  }
  for (const row of rows) {
    if (kept.has(row.id)) continue
    const { error: deleteError } = await supabase
      .from('learn_list')
      .delete()
      .eq('id', row.id)
      .eq('user_id', userId)
    if (deleteError) {
      console.warn('[Kea learn] cloud delete failed', row.term, deleteError.message)
    }
  }
}
