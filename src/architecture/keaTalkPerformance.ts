/**
 * Daily performance stats (talk seconds + Learn List adds/removes).
 * Local first; synced to Supabase user_daily_stats for charts and tokens.
 */

import type { DailyStatRow } from '../services/keaPerformanceCloud'

const DAY_PREFIX = 'kea-talk-day-v1-'
const STATS_PREFIX = 'kea-daily-stats-v1-'
const FIRST_DAY_KEY = 'kea-talk-first-day-v1'
const ADMIN_SEEDED_KEY = 'kea-daily-stats-admin-seed-v1'
export const TALK_PERFORMANCE_EVENT = 'kea-talk-performance'

export interface DayStat {
  day: string
  talkSeconds: number
  wordsAdded: number
  wordsRemoved: number
}

let cloudPush: ((row: DayStat) => void) | null = null

export function setDailyStatsCloudPush(push: ((row: DayStat) => void) | null) {
  cloudPush = push
}

function pad2(value: number) {
  return String(value).padStart(2, '0')
}

export function localDayKey(date = new Date()) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

function parseDay(day: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day)
  if (!match) return null
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    12,
    0,
    0,
    0,
  )
  return Number.isNaN(date.getTime()) ? null : date
}

function statsKey(day: string) {
  return `${STATS_PREFIX}${day}`
}

function legacyTalkKey(day: string) {
  return `${DAY_PREFIX}${day}`
}

function readLegacyTalkSeconds(day: string) {
  try {
    const raw = localStorage.getItem(legacyTalkKey(day))
    if (!raw) return 0
    const parsed = JSON.parse(raw) as { seconds?: number }
    const seconds = Number(parsed?.seconds)
    return Number.isFinite(seconds) && seconds > 0 ? seconds : 0
  } catch {
    return 0
  }
}

function emptyStat(day: string): DayStat {
  return { day, talkSeconds: 0, wordsAdded: 0, wordsRemoved: 0 }
}

export function readDayStat(day: string): DayStat {
  try {
    const raw = localStorage.getItem(statsKey(day))
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DayStat>
      return {
        day,
        talkSeconds: Math.max(0, Math.round(Number(parsed.talkSeconds) || 0)),
        wordsAdded: Math.max(0, Math.round(Number(parsed.wordsAdded) || 0)),
        wordsRemoved: Math.max(0, Math.round(Number(parsed.wordsRemoved) || 0)),
      }
    }
  } catch {
    // fall through to legacy
  }
  const legacy = readLegacyTalkSeconds(day)
  if (legacy > 0) return { day, talkSeconds: legacy, wordsAdded: 0, wordsRemoved: 0 }
  return emptyStat(day)
}

function writeDayStat(stat: DayStat) {
  const next: DayStat = {
    day: stat.day,
    talkSeconds: Math.max(0, Math.round(stat.talkSeconds)),
    wordsAdded: Math.max(0, Math.round(stat.wordsAdded)),
    wordsRemoved: Math.max(0, Math.round(stat.wordsRemoved)),
  }
  try {
    localStorage.setItem(statsKey(next.day), JSON.stringify(next))
    // Keep legacy talk key in sync for billing / older readers.
    localStorage.setItem(
      legacyTalkKey(next.day),
      JSON.stringify({ seconds: next.talkSeconds }),
    )
  } catch {
    // ignore quota
  }
  cloudPush?.(next)
}

function readFirstDay(): string | null {
  try {
    const value = localStorage.getItem(FIRST_DAY_KEY)
    return value && parseDay(value) ? value : null
  } catch {
    return null
  }
}

function ensureFirstDay(day: string) {
  const existing = readFirstDay()
  if (!existing) {
    try {
      localStorage.setItem(FIRST_DAY_KEY, day)
    } catch {
      // ignore
    }
    return
  }
  if (day < existing) {
    try {
      localStorage.setItem(FIRST_DAY_KEY, day)
    } catch {
      // ignore
    }
  }
}

function notify() {
  window.dispatchEvent(new Event(TALK_PERFORMANCE_EVENT))
}

function bumpStat(
  day: string,
  patch: Partial<Pick<DayStat, 'talkSeconds' | 'wordsAdded' | 'wordsRemoved'>>,
) {
  ensureFirstDay(day)
  const current = readDayStat(day)
  writeDayStat({
    day,
    talkSeconds: current.talkSeconds + (patch.talkSeconds ?? 0),
    wordsAdded: current.wordsAdded + (patch.wordsAdded ?? 0),
    wordsRemoved: current.wordsRemoved + (patch.wordsRemoved ?? 0),
  })
  notify()
}

/** Record seconds spoken with Kea (all users, including admin). */
export function recordTalkPerformanceSeconds(seconds: number) {
  const add = Math.max(0, seconds)
  if (!add) return
  bumpStat(localDayKey(), { talkSeconds: add })
}

export function recordWordsAdded(count = 1, day = localDayKey()) {
  const add = Math.max(0, Math.round(count))
  if (!add) return
  bumpStat(day, { wordsAdded: add })
}

export function recordWordsRemoved(count = 1, day = localDayKey()) {
  const add = Math.max(0, Math.round(count))
  if (!add) return
  bumpStat(day, { wordsRemoved: add })
}

export function mergeCloudDayStats(rows: DailyStatRow[]) {
  for (const row of rows) {
    if (!parseDay(row.day)) continue
    ensureFirstDay(row.day)
    const local = readDayStat(row.day)
    writeDayStat({
      day: row.day,
      talkSeconds: Math.max(local.talkSeconds, row.talkSeconds),
      wordsAdded: Math.max(local.wordsAdded, row.wordsAdded),
      wordsRemoved: Math.max(local.wordsRemoved, row.wordsRemoved),
    })
  }
  notify()
}

export function exportAllDayStats(): DayStat[] {
  const today = localDayKey()
  let first = readFirstDay() ?? today
  const found = new Set<string>()
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key) continue
      if (key.startsWith(STATS_PREFIX)) {
        found.add(key.slice(STATS_PREFIX.length))
      } else if (key.startsWith(DAY_PREFIX)) {
        found.add(key.slice(DAY_PREFIX.length))
      }
    }
  } catch {
    // ignore
  }
  for (const day of found) {
    if (parseDay(day) && day < first) first = day
  }
  return eachDayInclusive(first, today).map((day) => readDayStat(day))
}

function eachDayInclusive(from: string, to: string): string[] {
  const start = parseDay(from)
  const end = parseDay(to)
  if (!start || !end || start > end) return []
  const days: string[] = []
  const cursor = new Date(start)
  while (cursor <= end) {
    days.push(localDayKey(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return days
}

function shortLabel(day: string) {
  const date = parseDay(day)
  if (!date) return day
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

export interface TalkDayHours {
  date: string
  label: string
  seconds: number
  hours: number
}

/** Every calendar day from first recorded use through today. */
export function getTalkPerformanceSeries(): TalkDayHours[] {
  const today = localDayKey()
  let first = readFirstDay()
  if (!first) {
    first = today
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (!key) continue
        let day = ''
        if (key.startsWith(STATS_PREFIX)) day = key.slice(STATS_PREFIX.length)
        else if (key.startsWith(DAY_PREFIX)) day = key.slice(DAY_PREFIX.length)
        if (parseDay(day) && day < first) first = day
      }
    } catch {
      // ignore
    }
    const hasAny =
      readDayStat(first).talkSeconds > 0 ||
      readDayStat(today).talkSeconds > 0 ||
      first !== today
    if (!hasAny) return []
    ensureFirstDay(first)
  }

  return eachDayInclusive(first, today).map((date) => {
    const seconds = readDayStat(date).talkSeconds
    return {
      date,
      label: shortLabel(date),
      seconds,
      hours: seconds / 3600,
    }
  })
}

export interface WordDayCounts {
  date: string
  label: string
  added: number
  removed: number
}

export function getWordPerformanceSeries(): WordDayCounts[] {
  const today = localDayKey()
  const first = readFirstDay() ?? today
  return eachDayInclusive(first, today).map((date) => {
    const stat = readDayStat(date)
    return {
      date,
      label: shortLabel(date),
      added: stat.wordsAdded,
      removed: stat.wordsRemoved,
    }
  })
}

function averageSeconds(days: string[]) {
  if (days.length === 0) return 0
  const total = days.reduce((sum, day) => sum + readDayStat(day).talkSeconds, 0)
  return total / days.length
}

/**
 * 7-day moving-average change vs the prior 7 days.
 * Positive = more time with Kea lately; negative = less.
 */
export function getTalkTrendPercent(): number {
  const series = getTalkPerformanceSeries()
  if (series.length === 0) return 0

  const today = localDayKey()
  const end = parseDay(today)
  if (!end) return 0

  const recent: string[] = []
  const prior: string[] = []
  for (let i = 0; i < 7; i++) {
    const recentDate = new Date(end)
    recentDate.setDate(end.getDate() - i)
    recent.push(localDayKey(recentDate))
    const priorDate = new Date(end)
    priorDate.setDate(end.getDate() - 7 - i)
    prior.push(localDayKey(priorDate))
  }

  const recentAvg = averageSeconds(recent)
  const priorAvg = averageSeconds(prior)

  if (priorAvg <= 0.5) {
    if (recentAvg <= 0.5) return 0
    return 100
  }
  const change = ((recentAvg - priorAvg) / priorAvg) * 100
  return Math.round(change)
}

export function formatTrendPercent(value = getTalkTrendPercent()) {
  if (value > 0) return `+${value}%`
  if (value < 0) return `${value}%`
  return '0%'
}

export interface TalkAveragePoint {
  date: string
  label: string
  /** Mean talk hours across this day and the six days before it. */
  hours: number
}

/** Seven-day moving average of talk hours, one point per calendar day. */
export function getTalkMovingAverageSeries(): TalkAveragePoint[] {
  const series = getTalkPerformanceSeries()
  return series.map((day, index) => {
    const window = series.slice(Math.max(0, index - 6), index + 1)
    const hours = window.reduce((sum, item) => sum + item.hours, 0) / 7
    return { date: day.date, label: day.label, hours }
  })
}

export interface PerformanceMonthWindow {
  id: string
  label: string
  /** Inclusive day keys in this month window (calendar month, or trailing 30). */
  days: string[]
}

/** Calendar months from first use through the current month (for slideable charts). */
export function getPerformanceMonthWindows(): PerformanceMonthWindow[] {
  const today = localDayKey()
  const first = readFirstDay() ?? today
  const start = parseDay(first)
  const end = parseDay(today)
  if (!start || !end) return []

  const windows: PerformanceMonthWindow[] = []
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1, 12)
  const lastMonth = new Date(end.getFullYear(), end.getMonth(), 1, 12)

  while (cursor <= lastMonth) {
    const year = cursor.getFullYear()
    const month = cursor.getMonth()
    const id = `${year}-${pad2(month + 1)}`
    const monthStart = localDayKey(new Date(year, month, 1, 12))
    const monthEndDate = new Date(year, month + 1, 0, 12)
    const monthEnd = localDayKey(
      monthEndDate > end ? end : monthEndDate,
    )
    const from = monthStart < first ? first : monthStart
    const days = eachDayInclusive(from, monthEnd)
    if (days.length) {
      windows.push({
        id,
        label: cursor.toLocaleDateString(undefined, {
          month: 'long',
          year: 'numeric',
        }),
        days,
      })
    }
    cursor.setMonth(cursor.getMonth() + 1)
  }
  return windows
}

/** Seed ~90 days of demo stats for admin preview (once per device). */
export function ensureAdminDemoPerformance() {
  try {
    if (localStorage.getItem(ADMIN_SEEDED_KEY) === '1') return
  } catch {
    return
  }
  const today = new Date()
  const first = new Date(today)
  first.setDate(today.getDate() - 89)
  ensureFirstDay(localDayKey(first))

  for (let i = 0; i < 90; i++) {
    const date = new Date(first)
    date.setDate(first.getDate() + i)
    const day = localDayKey(date)
    const existing = readDayStat(day)
    if (
      existing.talkSeconds > 0 ||
      existing.wordsAdded > 0 ||
      existing.wordsRemoved > 0
    ) {
      continue
    }
    const wave = 0.35 + 0.25 * Math.sin(i / 7) + 0.15 * Math.sin(i / 3)
    const spike = i % 23 === 0 ? 1.1 : i % 17 === 0 ? 0.55 : 0
    const hours = Math.max(0, Math.min(1.9, wave + spike + (i % 5) * 0.02))
    const added = Math.max(0, Math.round((i % 4 === 0 ? 2 : 0) + (i % 11 === 0 ? 3 : 0)))
    const removed = Math.max(0, Math.round(i % 6 === 0 ? 1 : 0) + (i % 13 === 0 ? 2 : 0))
    writeDayStat({
      day,
      talkSeconds: Math.round(hours * 3600),
      wordsAdded: added,
      wordsRemoved: removed,
    })
  }
  try {
    localStorage.setItem(ADMIN_SEEDED_KEY, '1')
  } catch {
    // ignore
  }
  notify()
}
