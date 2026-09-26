import { useEffect, useMemo, useRef, useState } from 'react'
import {
  formatTrendPercent,
  getTalkPerformanceSeries,
  getTalkTrendPercent,
  TALK_PERFORMANCE_EVENT,
  type TalkDayHours,
} from '../../architecture/keaTalkPerformance'

function hoursLabel(hours: number) {
  if (hours <= 0) return '0 h'
  if (hours < 0.1) return `${Math.round(hours * 60)} min`
  if (hours < 10) return `${hours.toFixed(1)} h`
  return `${Math.round(hours)} h`
}

export function PerformancePanel({ embedded = false }: { embedded?: boolean }) {
  const [series, setSeries] = useState<TalkDayHours[]>(() =>
    getTalkPerformanceSeries(),
  )
  const [trend, setTrend] = useState(() => getTalkTrendPercent())
  const scrollerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const refresh = () => {
      setSeries(getTalkPerformanceSeries())
      setTrend(getTalkTrendPercent())
    }
    refresh()
    window.addEventListener(TALK_PERFORMANCE_EVENT, refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener(TALK_PERFORMANCE_EVENT, refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])

  useEffect(() => {
    const node = scrollerRef.current
    if (!node) return
    node.scrollLeft = node.scrollWidth
  }, [series])

  const maxHours = useMemo(() => {
    const peak = Math.max(0, ...series.map((day) => day.hours))
    return Math.max(peak, 0.25)
  }, [series])

  const body = (
    <>
      <h2>Performance</h2>
      <p className="settings-note">
        Hours you spent talking with Kea each day, from your first session
        onward. The nav percentage is a seven-day moving average versus the
        week before
        {trend === 0
          ? ''
          : trend > 0
            ? ` (currently ${formatTrendPercent(trend)} more time)`
            : ` (currently ${formatTrendPercent(trend)} less time)`}
        .
      </p>
      {series.length === 0 ? (
        <p className="settings-note">
          No talk time recorded yet. Start a chat and this chart will fill in.
        </p>
      ) : (
        <div className="perf-chart" aria-label="Daily talk hours with Kea">
          <div className="perf-chart__scroll" ref={scrollerRef}>
            <div
              className="perf-chart__bars"
              style={{ minWidth: `${Math.max(series.length * 2.35, 12)}rem` }}
            >
              {series.map((day) => {
                const height = Math.max(4, (day.hours / maxHours) * 100)
                return (
                  <div className="perf-chart__col" key={day.date} title={`${day.label}: ${hoursLabel(day.hours)}`}>
                    <span className="perf-chart__value">
                      {day.hours > 0 ? hoursLabel(day.hours) : ''}
                    </span>
                    <div className="perf-chart__bar-wrap">
                      <div
                        className="perf-chart__bar"
                        style={{ height: `${height}%` }}
                      />
                    </div>
                    <span className="perf-chart__label">{day.label}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </>
  )

  if (embedded) {
    return <section className="settings-card settings-card--performance">{body}</section>
  }
  return <div className="performance-page__panel">{body}</div>
}
