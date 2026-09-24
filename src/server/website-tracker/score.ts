import { getWtSupabase } from './supabase.ts'
import {
  getLeadScoreWeights,
  getPathRules,
  type WtLeadScoreWeights,
  type WtPathRules,
} from './settings.ts'

function pathMatches(path: string | null | undefined, rules: string[]): boolean {
  if (!path) return false
  const p = path.split('?')[0] || path
  return rules.some((rule) => {
    if (rule === '/') return p === '/' || p === ''
    return p === rule || p.startsWith(rule + '/')
  })
}

export async function computeVisitorLeadScore(
  visitorId: string,
  weights?: WtLeadScoreWeights,
  pathRules?: WtPathRules,
): Promise<number> {
  const w = weights || (await getLeadScoreWeights())
  const rules = pathRules || (await getPathRules())
  const db = getWtSupabase()

  const [{ data: visitor }, { data: sessions }, { data: events }, { data: conversions }] =
    await Promise.all([
      db.from('wt_visitors').select('first_name, email').eq('id', visitorId).maybeSingle(),
      db.from('wt_sessions').select('id').eq('visitor_id', visitorId),
      db
        .from('wt_events')
        .select('type, path')
        .eq('visitor_id', visitorId)
        .in('type', ['page_view', 'video_complete']),
      db.from('wt_conversions').select('kind').eq('visitor_id', visitorId),
    ])

  let score = 0
  const sessionCount = sessions?.length || 0
  if (sessionCount > 1) score += w.return_visit || 0

  if (visitor?.email) score += w.email_entered || 0
  if (visitor?.first_name) score += w.name_entered || 0

  const seen = new Set<string>()
  for (const ev of events || []) {
    if (ev.type === 'video_complete' && !seen.has('video_complete')) {
      score += w.video_complete || 0
      seen.add('video_complete')
    }
    if (ev.type === 'page_view') {
      if (pathMatches(ev.path, rules.register_page) && !seen.has('register_page')) {
        score += w.register_page_visit || 0
        seen.add('register_page')
      }
      if (pathMatches(ev.path, rules.pricing_page) && !seen.has('pricing_page')) {
        score += w.pricing_page_visit || 0
        seen.add('pricing_page')
      }
    }
  }

  const convSeen = new Set<string>()
  for (const c of conversions || []) {
    const kind = c.kind as string
    if (convSeen.has(kind)) continue
    convSeen.add(kind)
    if (kind === 'register_click') score += w.register_click || 0
    else if (kind === 'contact_form_submitted') score += w.contact_form_submitted || 0
    else if (kind === 'register_complete') score += w.register_complete || 40
    else if (kind === 'subscription_started') score += w.subscription_started || 35
    else if (kind === 'subscription_completed') score += w.subscription_completed || 50
  }

  return Math.max(0, Math.min(score, 999))
}

export async function recalculateVisitorScore(visitorId: string): Promise<number> {
  const score = await computeVisitorLeadScore(visitorId)
  await getWtSupabase()
    .from('wt_visitors')
    .update({ lead_score: score, updated_at: new Date().toISOString() })
    .eq('id', visitorId)
  return score
}
