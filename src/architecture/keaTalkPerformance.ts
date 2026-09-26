/**
 * Daily talk-time performance (hours with Kea), independent of billing caps.
 */

const DAY_PREFIX = 'kea-talk-day-v1-'
const FIRST_DAY_KEY = 'kea-talk-first-day-v1'
export const TALK_PERFORMANCE_EVENT = 'kea-talk-performance'

function pad2(value: number) {
  return String(value).padStart(2, '0')
}

export function localDayKey(date = new Date()) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

function storageKeyForDay(day: string) {
  return `${DAY_PREFIX}${day}`
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

function readSeconds(day: string) {
  try {
    const raw = localStorage.getItem(storageKeyForDay(day))
    if (!raw) return 0
    const parsed = JSON.parse(raw) as { seconds?: number }
    const seconds = Number(parsed?.seconds)
    return Number.isFinite(seconds) && seconds > 0 ? seconds : 0
  } catch {
    return 0
  }
}

function writeSeconds(day: string, seconds: number) {
  try {
    localStorage.setItem(
      storageKeyForDay(day),
      JSON.stringify({ seconds: Math.max(0, Math.round(seconds)) }),
    )
  } catch {
    // ignore quota
  }
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

/** Record seconds spoken with Kea (all users, including admin). */
export function recordTalkPerformanceSeconds(seconds: number) {
  const add = Math.max(0, seconds)
  if (!add) return
  const day = localDayKey()
  ensureFirstDay(day)
  writeSeconds(day, readSeconds(day) + add)
  notify()
}

export interface TalkDayHours {
  date: string
  label: string
  seconds: number
  hours: number
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

/** Every calendar day from first recorded use through today. */
export function getTalkPerformanceSeries(): TalkDayHours[] {
  const today = localDayKey()
  let first = readFirstDay()
  if (!first) {
    // Fall back: scan recent keys if first-day marker missing.
    first = today
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (!key?.startsWith(DAY_PREFIX)) continue
        const day = key.slice(DAY_PREFIX.length)
        if (parseDay(day) && day < first) first = day
      }
    } catch {
      // ignore
    }
    const hasAny = readSeconds(first) > 0 || first !== today
    if (!hasAny && readSeconds(today) <= 0) return []
    ensureFirstDay(first)
  }

  return eachDayInclusive(first, today).map((date) => {
    const seconds = readSeconds(date)
    return {
      date,
      label: shortLabel(date),
      seconds,
      hours: seconds / 3600,
    }
  })
}

function averageSeconds(days: string[]) {
  if (days.length === 0) return 0
  const total = days.reduce((sum, day) => sum + readSeconds(day), 0)
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
