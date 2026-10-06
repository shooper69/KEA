import {
  DEFAULT_OPENAI_RATE_CARD,
  type OpenAiRateCard,
} from '../../architecture/keaCostsMath.ts'
import { getKeaServiceSupabase } from '../keaServiceSupabase.ts'

export type StoredRateCard = OpenAiRateCard & {
  source: 'database' | 'code_defaults'
  updatedAt: string | null
  updatedBy: string | null
}

type RateCardRow = {
  id: number
  whisper_per_minute: number | string
  chat_input_per_million: number | string
  chat_output_per_million: number | string
  tts_input_per_million: number | string
  tts_audio_per_million: number | string
  tts_hd_per_million_chars: number | string
  updated_at: string | null
  updated_by: string | null
}

let cache: { card: StoredRateCard; at: number } | null = null
const TTL_MS = 60_000

function num(value: unknown, fallback: number) {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) && n >= 0 ? n : fallback
}

export function normalizeRateCard(
  partial: Partial<OpenAiRateCard> | null | undefined,
): OpenAiRateCard {
  const base = DEFAULT_OPENAI_RATE_CARD
  return {
    whisperPerMinute: num(partial?.whisperPerMinute, base.whisperPerMinute),
    chatInputPerMillion: num(partial?.chatInputPerMillion, base.chatInputPerMillion),
    chatOutputPerMillion: num(
      partial?.chatOutputPerMillion,
      base.chatOutputPerMillion,
    ),
    ttsInputPerMillion: num(partial?.ttsInputPerMillion, base.ttsInputPerMillion),
    ttsAudioPerMillion: num(partial?.ttsAudioPerMillion, base.ttsAudioPerMillion),
    ttsHdPerMillionChars: num(
      partial?.ttsHdPerMillionChars,
      base.ttsHdPerMillionChars,
    ),
  }
}

function fromRow(row: RateCardRow): StoredRateCard {
  return {
    whisperPerMinute: num(row.whisper_per_minute, DEFAULT_OPENAI_RATE_CARD.whisperPerMinute),
    chatInputPerMillion: num(
      row.chat_input_per_million,
      DEFAULT_OPENAI_RATE_CARD.chatInputPerMillion,
    ),
    chatOutputPerMillion: num(
      row.chat_output_per_million,
      DEFAULT_OPENAI_RATE_CARD.chatOutputPerMillion,
    ),
    ttsInputPerMillion: num(
      row.tts_input_per_million,
      DEFAULT_OPENAI_RATE_CARD.ttsInputPerMillion,
    ),
    ttsAudioPerMillion: num(
      row.tts_audio_per_million,
      DEFAULT_OPENAI_RATE_CARD.ttsAudioPerMillion,
    ),
    ttsHdPerMillionChars: num(
      row.tts_hd_per_million_chars,
      DEFAULT_OPENAI_RATE_CARD.ttsHdPerMillionChars,
    ),
    source: 'database',
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  }
}

function codeDefaultsCard(): StoredRateCard {
  return {
    ...DEFAULT_OPENAI_RATE_CARD,
    source: 'code_defaults',
    updatedAt: null,
    updatedBy: null,
  }
}

export function invalidateRateCardCache() {
  cache = null
}

export async function loadOpenAiRateCard(): Promise<StoredRateCard> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.card
  const supabase = getKeaServiceSupabase()
  if (!supabase) {
    const card = codeDefaultsCard()
    cache = { card, at: Date.now() }
    return card
  }
  try {
    const { data, error } = await supabase
      .from('ai_rate_card')
      .select(
        'id,whisper_per_minute,chat_input_per_million,chat_output_per_million,tts_input_per_million,tts_audio_per_million,tts_hd_per_million_chars,updated_at,updated_by',
      )
      .eq('id', 1)
      .maybeSingle()
    if (error || !data) {
      const card = codeDefaultsCard()
      cache = { card, at: Date.now() }
      return card
    }
    const card = fromRow(data as RateCardRow)
    cache = { card, at: Date.now() }
    return card
  } catch {
    const card = codeDefaultsCard()
    cache = { card, at: Date.now() }
    return card
  }
}

export async function saveOpenAiRateCard(
  rates: OpenAiRateCard,
  updatedBy: string | null,
): Promise<StoredRateCard> {
  const next = normalizeRateCard(rates)
  const supabase = getKeaServiceSupabase()
  if (!supabase) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured')
  }
  const row = {
    id: 1,
    whisper_per_minute: next.whisperPerMinute,
    chat_input_per_million: next.chatInputPerMillion,
    chat_output_per_million: next.chatOutputPerMillion,
    tts_input_per_million: next.ttsInputPerMillion,
    tts_audio_per_million: next.ttsAudioPerMillion,
    tts_hd_per_million_chars: next.ttsHdPerMillionChars,
    updated_at: new Date().toISOString(),
    updated_by: updatedBy,
  }
  const { data, error } = await supabase
    .from('ai_rate_card')
    .upsert(row, { onConflict: 'id' })
    .select(
      'id,whisper_per_minute,chat_input_per_million,chat_output_per_million,tts_input_per_million,tts_audio_per_million,tts_hd_per_million_chars,updated_at,updated_by',
    )
    .single()
  if (error || !data) {
    throw new Error(error?.message || 'Failed to save rate card')
  }
  invalidateRateCardCache()
  const card = fromRow(data as RateCardRow)
  cache = { card, at: Date.now() }
  return card
}
