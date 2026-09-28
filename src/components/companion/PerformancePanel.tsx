import { useEffect, useMemo, useRef, useState } from 'react'
import { getMasteredLearnItems } from '../../architecture/companionMemory'
import { getLearnMasteryUses } from '../../data/keaLearnMastery'
import {
  formatTrendPercent,
  getTalkAverageMonths,
  getTalkTrendPercent,
  localDayKey,
  TALK_PERFORMANCE_EVENT,
  type TalkMonth,
} from '../../architecture/keaTalkPerformance'

function hoursLabel(hours: number) {
  if (hours <= 0) return '0 h'
  if (hours < 0.1) return `${Math.round(hours * 60)} min`
  if (hours < 10) return `${hours.toFixed(1)} h`
  return `${Math.round(hours)} h`
}

function dayKeyFromIso(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return localDayKey(date)
}

function eachDay(from: string, to: string) {
  const start = new Date(`${from}T12:00:00`)
  const end = new Date(`${to}T12:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return []
  }
  const days: string[] = []
  const cursor = new Date(start)
  while (cursor <= end) {
    days.push(localDayKey(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return days
}

/** Cumulative words that left the Learn List after enough proper uses. */
function wordsLearnedCurve() {
  const items = getMasteredLearnItems()
  const counts = new Map<string, number>()
  for (const item of items) {
    const day = dayKeyFromIso(item.masteredAt)
    if (!day) continue
    counts.set(day, (counts.get(day) ?? 0) + 1)
  }
  const today = localDayKey()
  const first = [...counts.keys()].sort()[0]
  if (!first) return [{ date: today, total: 0 }]
  let total = 0
  return eachDay(first, today).map((date) => {
    total += counts.get(date) ?? 0
    return { date, total }
  })
}

function LineChart({
  values,
  label,
}: {
  values: number[]
  label: string
}) {
  const width = 320
  const height = 148
  const peak = Math.max(0.01, ...values)
  const points = values.map((value, index) => {
    const x = values.length <= 1 ? width / 2 : (index / (values.length - 1)) * width
    const y = height - 10 - (value / peak) * (height - 22)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  const last = points[points.length - 1] ?? `0,${height}`
  const area = `0,${height} ${points.join(' ')} ${width},${height}`
  return (
    <svg className="perf-line" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
      <polygon className="perf-line__fill" points={area} />
      <polyline className="perf-line__stroke" points={points.join(' ')} />
      <circle className="perf-line__dot" cx={last.split(',')[0]} cy={last.split(',')[1]} r="3.5" />
    </svg>
  )
}

export function PerformancePanel({ embedded = false }: { embedded?: boolean }) {
  const [words, setWords] = useState(() => wordsLearnedCurve())
  const [months, setMonths] = useState<TalkMonth[]>(() => getTalkAverageMonths())
  const [trend, setTrend] = useState(() => getTalkTrendPercent())
  const monthsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const refresh = () => {
      setWords(wordsLearnedCurve())
      setMonths(getTalkAverageMonths())
      setTrend(getTalkTrendPercent())
    }
    refresh()
    window.addEventListener(TALK_PERFORMANCE_EVENT, refresh)
    window.addEventListener('kea-learn-memory', refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener(TALK_PERFORMANCE_EVENT, refresh)
      window.removeEventListener('kea-learn-memory', refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])

  useEffect(() => {
    const node = monthsRef.current
    if (!node) return
    node.scrollLeft = node.scrollWidth
  }, [months])

  const learned = words[words.length - 1]?.total ?? 0
  const wordValues = useMemo(() => words.map((point) => point.total), [words])

  const body = (
    <>
      <section className="perf-block" aria-labelledby="perf-words-title">
        <h2 id="perf-words-title">Words learned</h2>
        <p className="perf-block__number">{learned}</p>
        <p className="perf-block__note">
          Words that entered the Learn List and then left it after {getLearnMasteryUses()} proper uses.
        </p>
        <LineChart values={wordValues} label={`${learned} words learned, climbing over time`} />
      </section>

      <section className="perf-block" aria-labelledby="perf-average-title">
        <h2 id="perf-average-title">Seven-day average</h2>
        <p className="perf-block__number">{formatTrendPercent(trend)}</p>
        <p className="perf-block__note">
          Talk time with Kea, averaged over seven days. Slide from month to month.
        </p>
        {months.length === 0 ? (
          <p className="perf-block__note">No talk time recorded yet.</p>
        ) : (
          <div className="perf-months" ref={monthsRef} aria-label="Seven-day average by month">
            {months.map((month) => (
              <article className="perf-month" key={month.id}>
                <h3>{month.label}</h3>
                <LineChart
                  values={month.points.map((point) => point.hours)}
                  label={`${month.label} seven-day average`}
                />
                <p className="perf-month__end">
                  {hoursLabel(month.points[month.points.length - 1]?.hours ?? 0)} a day
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  )

  if (embedded) {
    return <section className="settings-card settings-card--performance">{body}</section>
  }
  return <div className="performance-page__panel">{body}</div>
}
