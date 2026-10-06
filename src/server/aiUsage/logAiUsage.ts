import { KEA_ADMIN_EMAIL } from '../../config/keaAdmin.ts'
import {
  estimateChatUsd,
  estimateTtsUsd,
  estimateWhisperUsd,
  roundUsd,
  type OpenAiRateCard,
} from '../../architecture/keaCostsMath.ts'
import { getKeaServiceSupabase } from '../keaServiceSupabase.ts'
import { loadOpenAiRateCard } from './loadRateCard.ts'

export type AiUsageFeature =
  | 'conversation_chat'
  | 'translation'
  | 'plain_translation'
  | 'transcription'
  | 'tts'
  | 'welcome_tts'
  | 'other'

export type AiUsageRequestType =
  | 'chat_completions'
  | 'audio_transcriptions'
  | 'audio_speech'

export type AiUsageActor = 'user' | 'anonymous' | 'admin'

export type AiUsageEventInput = {
  userId?: string | null
  userEmail?: string | null
  actor?: AiUsageActor
  feature: AiUsageFeature
  requestType: AiUsageRequestType
  model: string
  planIdAtTime?: string | null
  promptTokens?: number
  completionTokens?: number
  audioSeconds?: number
  ttsCharacters?: number
  requestId?: string | null
  status?: 'ok' | 'error'
}

function isAdminEmail(email: string | null | undefined) {
  return (email || '').trim().toLowerCase() === KEA_ADMIN_EMAIL.trim().toLowerCase()
}

export function actorForEmail(
  userId: string | null | undefined,
  email: string | null | undefined,
): AiUsageActor {
  if (!userId) return 'anonymous'
  if (isAdminEmail(email)) return 'admin'
  return 'user'
}

export function openaiRequestId(response: Response): string | null {
  return (
    response.headers.get('x-request-id') ||
    response.headers.get('openai-request-id') ||
    null
  )
}

export function estimateEventCost(
  input: AiUsageEventInput,
  rates?: OpenAiRateCard,
) {
  if (input.requestType === 'chat_completions') {
    return roundUsd(
      estimateChatUsd(input.promptTokens ?? 0, input.completionTokens ?? 0, rates),
    )
  }
  if (input.requestType === 'audio_transcriptions') {
    return roundUsd(estimateWhisperUsd(input.audioSeconds ?? 0, rates))
  }
  return roundUsd(estimateTtsUsd(input.model, input.ttsCharacters ?? 0, rates))
}

const planCache = new Map<string, { planId: string | null; at: number }>()
const PLAN_TTL_MS = 60_000

export async function lookupPlanIdAtTime(userId: string | null | undefined) {
  if (!userId) return null
  const hit = planCache.get(userId)
  if (hit && Date.now() - hit.at < PLAN_TTL_MS) return hit.planId
  const supabase = getKeaServiceSupabase()
  if (!supabase) return null
  try {
    const { data } = await supabase
      .from('profiles')
      .select('subscription_plan_id, subscription_status')
      .eq('id', userId)
      .maybeSingle()
    const status = String(data?.subscription_status || 'none')
    const plan =
      status === 'active' || status === 'trialing' || status === 'past_due'
        ? typeof data?.subscription_plan_id === 'string'
          ? data.subscription_plan_id
          : null
        : status === 'none'
          ? 'trial'
          : null
    planCache.set(userId, { planId: plan, at: Date.now() })
    return plan
  } catch {
    return null
  }
}

/** Fire-and-forget insert. Never throws into the OpenAI response path. */
export function logAiUsage(input: AiUsageEventInput) {
  const supabase = getKeaServiceSupabase()
  if (!supabase) return
  void (async () => {
    try {
      const rates = await loadOpenAiRateCard()
      const row = {
        user_id: input.userId || null,
        user_email: input.userEmail?.trim().toLowerCase() || null,
        actor: input.actor || actorForEmail(input.userId, input.userEmail),
        feature: input.feature,
        request_type: input.requestType,
        model: input.model,
        plan_id_at_time: input.planIdAtTime ?? null,
        prompt_tokens: Math.max(0, Math.round(input.promptTokens ?? 0)),
        completion_tokens: Math.max(0, Math.round(input.completionTokens ?? 0)),
        audio_seconds: Math.max(0, Number(input.audioSeconds ?? 0) || 0),
        tts_characters: Math.max(0, Math.round(input.ttsCharacters ?? 0)),
        estimated_cost_usd: estimateEventCost(input, rates),
        request_id: input.requestId || null,
        status: input.status || 'ok',
      }
      const { error } = await supabase.from('ai_usage_events').insert(row)
      if (error) console.warn('[kea-ai-usage] insert failed', error.message)
    } catch (err: unknown) {
      console.warn(
        '[kea-ai-usage] insert failed',
        err instanceof Error ? err.message : err,
      )
    }
  })()
}
