export const WT_EVENT_TYPES = [
  'session_start',
  'page_view',
  'page_leave',
  'click',
  'identify',
  'video_complete',
  'register_click',
  'contact_form_submitted',
] as const

export type WtEventType = (typeof WT_EVENT_TYPES)[number]

export const WT_CONVERSION_KINDS = [
  'register_click',
  'register_complete',
  'subscription_started',
  'subscription_completed',
  'contact_form_submitted',
] as const

export type WtConversionKind = (typeof WT_CONVERSION_KINDS)[number]

export type WtIngestEvent = {
  type: WtEventType
  path?: string
  ts?: string
  duration_ms?: number
  scroll_pct?: number
  props?: Record<string, unknown>
}

export type WtIngestBody = {
  anon_id: string
  session_id: string
  consent?: {
    analytics?: boolean
    v?: string
  }
  events: WtIngestEvent[]
}
