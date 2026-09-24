import { getWtSupabase } from './supabase.ts'
import type { WtConversionKind, WtIngestBody, WtIngestEvent } from './types.ts'
import { sanitizeIdentify } from './validate.ts'
import { recalculateVisitorScore } from './score.ts'

const CONVERSION_FROM_EVENT: Partial<Record<WtIngestEvent['type'], WtConversionKind>> = {
  register_click: 'register_click',
  contact_form_submitted: 'contact_form_submitted',
}

function utmFromProps(props: Record<string, unknown> | undefined) {
  return {
    source: typeof props?.source === 'string' ? props.source.slice(0, 120) : undefined,
    medium: typeof props?.medium === 'string' ? props.medium.slice(0, 120) : undefined,
    campaign: typeof props?.campaign === 'string' ? props.campaign.slice(0, 120) : undefined,
    referrer: typeof props?.referrer === 'string' ? props.referrer.slice(0, 500) : undefined,
  }
}

export async function processWebsiteTrackerIngest(opts: {
  body: WtIngestBody
  device: string
  country: string | null
}): Promise<{ accepted: number; dropped: number }> {
  const { body, device, country } = opts
  const now = new Date().toISOString()
  const db = getWtSupabase()

  const { data: existingVisitor, error: visLookupErr } = await db
    .from('wt_visitors')
    .select('id, first_name, email')
    .eq('anon_id', body.anon_id)
    .maybeSingle()

  if (visLookupErr) throw new Error(`visitor lookup: ${visLookupErr.message}`)

  let visitorId = existingVisitor?.id as string | undefined

  if (!visitorId) {
    const { data: inserted, error: insErr } = await db
      .from('wt_visitors')
      .insert({
        anon_id: body.anon_id,
        consent_analytics: true,
        consent_version: body.consent?.v ?? null,
        country,
        first_seen_at: now,
        last_seen_at: now,
      })
      .select('id')
      .single()

    if (insErr) {
      const { data: again, error: againErr } = await db
        .from('wt_visitors')
        .select('id')
        .eq('anon_id', body.anon_id)
        .single()
      if (againErr || !again) throw new Error(`visitor insert: ${insErr.message}`)
      visitorId = again.id
    } else {
      visitorId = inserted.id
    }
  } else {
    await db
      .from('wt_visitors')
      .update({
        last_seen_at: now,
        consent_version: body.consent?.v ?? undefined,
        ...(country ? { country } : {}),
        updated_at: now,
      })
      .eq('id', visitorId)
  }

  const { data: existingSession } = await db
    .from('wt_sessions')
    .select('id')
    .eq('id', body.session_id)
    .maybeSingle()

  const sessionStart = body.events.find(
    (e: WtIngestEvent) => e.type === 'session_start',
  )
  const utm = utmFromProps(sessionStart?.props)
  const landingPath =
    sessionStart?.path ||
    body.events.find((e: WtIngestEvent) => e.type === 'page_view')?.path ||
    null

  if (!existingSession) {
    const { error: sessErr } = await db.from('wt_sessions').insert({
      id: body.session_id,
      visitor_id: visitorId,
      landed_at: sessionStart?.ts || now,
      last_heartbeat_at: now,
      current_path: landingPath,
      landing_path: landingPath,
      source: utm.source ?? null,
      medium: utm.medium ?? null,
      campaign: utm.campaign ?? null,
      referrer: utm.referrer ?? null,
      device,
      country,
      consent_version: body.consent?.v ?? null,
    })
    if (sessErr) {
      const { data: again } = await db
        .from('wt_sessions')
        .select('id')
        .eq('id', body.session_id)
        .maybeSingle()
      if (!again) throw new Error(`session insert: ${sessErr.message}`)
    }
  }

  let accepted = 0
  let dropped = 0

  for (const event of body.events) {
    try {
      await persistEvent({
        event,
        visitorId: visitorId!,
        sessionId: body.session_id,
        now,
      })
      accepted++
    } catch (err) {
      console.error('[kea-website-tracker] event persist failed', event.type, err)
      dropped++
    }
  }

  if (visitorId) {
    await recalculateVisitorScore(visitorId).catch((err: unknown) => {
      console.warn('[kea-website-tracker] score recompute failed', err)
    })
  }

  return { accepted, dropped }
}

async function persistEvent(opts: {
  event: WtIngestEvent
  visitorId: string
  sessionId: string
  now: string
}) {
  const { event, visitorId, sessionId, now } = opts
  const ts = event.ts || now
  const props = event.props || {}
  const db = getWtSupabase()

  const { error: evErr } = await db.from('wt_events').insert({
    session_id: sessionId,
    visitor_id: visitorId,
    type: event.type,
    path: event.path ?? null,
    ts,
    duration_ms: event.duration_ms ?? null,
    scroll_pct: event.scroll_pct ?? null,
    props,
  })
  if (evErr) throw new Error(evErr.message)

  if (event.type === 'page_view') {
    await db
      .from('wt_sessions')
      .update({
        last_heartbeat_at: ts,
        current_path: event.path ?? undefined,
        updated_at: now,
      })
      .eq('id', sessionId)
  }

  if (event.type === 'page_leave') {
    await db
      .from('wt_sessions')
      .update({
        last_heartbeat_at: ts,
        exit_path: event.path ?? undefined,
        updated_at: now,
      })
      .eq('id', sessionId)
  }

  if (event.type === 'session_start') {
    const utm = utmFromProps(props)
    await db
      .from('wt_sessions')
      .update({
        landing_path: event.path ?? undefined,
        source: utm.source ?? undefined,
        medium: utm.medium ?? undefined,
        campaign: utm.campaign ?? undefined,
        referrer: utm.referrer ?? undefined,
        updated_at: now,
      })
      .eq('id', sessionId)
  }

  if (event.type === 'identify') {
    const { first_name, email } = sanitizeIdentify(props)
    if (first_name || email) {
      const patch: Record<string, unknown> = { updated_at: now, last_seen_at: now }
      if (first_name) patch.first_name = first_name
      if (email) patch.email = email
      const { error: idErr } = await db.from('wt_visitors').update(patch).eq('id', visitorId)
      if (idErr?.code === '23505' && email) {
        const fallback: Record<string, unknown> = { updated_at: now, last_seen_at: now }
        if (first_name) fallback.first_name = first_name
        await db.from('wt_visitors').update(fallback).eq('id', visitorId)
      } else if (idErr) {
        throw new Error(idErr.message)
      }
    }
  }

  const conversionKind = CONVERSION_FROM_EVENT[event.type]
  if (conversionKind) {
    const target_url =
      typeof props.target_url === 'string'
        ? props.target_url.slice(0, 1000)
        : typeof props.href === 'string'
          ? props.href.slice(0, 1000)
          : null

    const { error: convErr } = await db.from('wt_conversions').insert({
      session_id: sessionId,
      visitor_id: visitorId,
      kind: conversionKind,
      target_url,
      occurred_at: ts,
      props,
    })

    if (convErr && convErr.code !== '23505') {
      throw new Error(convErr.message)
    }
  }
}
