import { getWtSupabase } from './supabase.ts'
import { DEFAULT_FUNNEL_PAGES, normaliseFunnelPages } from './funnel-pages.ts'

export type WtRetentionPeriod = '90' | '180' | '365' | 'unlimited'

export type WtLeadScoreWeights = {
  register_page_visit: number
  pricing_page_visit: number
  video_complete: number
  email_entered: number
  name_entered: number
  register_click: number
  contact_form_submitted: number
  return_visit: number
  register_complete?: number
  subscription_started?: number
  subscription_completed?: number
}

export type WtPathRules = {
  register_page: string[]
  pricing_page: string[]
  benefits: string[]
  video: string[]
  landing: string[]
}

export type WtLeadScoreTiers = {
  cold_max: number
  warm_max: number
}

const DEFAULT_WEIGHTS: WtLeadScoreWeights = {
  register_page_visit: 25,
  pricing_page_visit: 20,
  video_complete: 15,
  email_entered: 25,
  name_entered: 15,
  register_click: 30,
  contact_form_submitted: 20,
  return_visit: 10,
  register_complete: 40,
  subscription_started: 35,
  subscription_completed: 50,
}

const DEFAULT_PATH_RULES: WtPathRules = {
  landing: ['/'],
  benefits: ['/about', '/home'],
  video: ['/conversation'],
  register_page: ['/'],
  pricing_page: ['/settings'],
}

const DEFAULT_TIERS: WtLeadScoreTiers = {
  cold_max: 14,
  warm_max: 39,
}

export async function getWtSetting<T>(key: string, fallback: T): Promise<T> {
  const { data, error } = await getWtSupabase()
    .from('wt_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle()
  if (error || !data?.value) return fallback
  return { ...fallback, ...(data.value as object) } as T
}

export async function getLeadScoreWeights(): Promise<WtLeadScoreWeights> {
  return getWtSetting('lead_score_weights', DEFAULT_WEIGHTS)
}

export async function getPathRules(): Promise<WtPathRules> {
  return getWtSetting('path_rules', DEFAULT_PATH_RULES)
}

export async function getLeadScoreTiers(): Promise<WtLeadScoreTiers> {
  return getWtSetting('lead_score_tiers', DEFAULT_TIERS)
}

export async function getFunnelPages() {
  const raw = await getWtSetting<{ pages?: unknown }>('funnel_pages', {
    pages: [...DEFAULT_FUNNEL_PAGES],
  })
  return normaliseFunnelPages(raw.pages ?? raw)
}

export function classifyLeadScore(
  score: number,
  tiers: WtLeadScoreTiers,
): 'Cold' | 'Warm' | 'Hot' {
  if (score <= tiers.cold_max) return 'Cold'
  if (score <= tiers.warm_max) return 'Warm'
  return 'Hot'
}

export { DEFAULT_WEIGHTS, DEFAULT_PATH_RULES, DEFAULT_TIERS }
