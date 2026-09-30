import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { getLearnMasteryUses } from '../../data/keaLearnMastery'
import {
  getPerformanceMonthWindows,
  getTalkMovingAverageSeries,
  getTalkPerformanceSeries,
  getWordPerformanceSeries,
  TALK_PERFORMANCE_EVENT,
  type PerformanceMonthWindow,
} from '../../architecture/keaTalkPerformance'

function minutesLabel(hours: number) {
  const mins = hours * 60
  if (mins <= 0) return '0 min'
  if (mins < 100) return `${mins.toFixed(0)} min`
  return `${Math.round(mins)} min`
}

function median(values: number[]) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2
}

function dayNumber(day: string) {
  const part = day.slice(8, 10)
  const n = Number(part)
  return Number.isFinite(n) ? n : 1
}

function InfoButton({
  label,
  open,
  onToggle,
}: {
  label: string
  open: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      className="perf-info"
      aria-label={label}
      aria-expanded={open}
      onClick={onToggle}
    >
      i
    </button>
  )
}

/** Month picker: drag right → later months, drag left → earlier months. */
function MonthSlider({
  months,
  index,
  onChange,
  label,
}: {
  months: PerformanceMonthWindow[]
  index: number
  onChange: (next: number) => void
  label: string
}) {
  if (months.length <= 1) return null
  const max = months.length - 1
  return (
    <label className="perf-slider">
      <span className="visually-hidden">{label}</span>
      <input
        type="range"
        min={0}
        max={max}
        step={1}
        value={index}
        aria-valuetext={months[index]?.label ?? ''}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}

function AxisChart({
  days,
  monthLabel,
  yLabel,
  peak,
  ariaLabel,
  renderSeries,
}: {
  days: string[]
  monthLabel: string
  yLabel: string
  peak: number
  ariaLabel: string
  renderSeries: (opts: {
    padL: number
    padR: number
    padT: number
    padB: number
    innerW: number
    innerH: number
    peak: number
    n: number
  }) => ReactNode
}) {
  const width = 360
  const height = 178
  const padL = 36
  const padR = 10
  const padT = 14
  const padB = 34
  const innerW = width - padL - padR
  const innerH = height - padT - padB
  const n = Math.max(1, days.length)
  const firstDay = days.length ? dayNumber(days[0]) : 1
  const lastDay = days.length ? dayNumber(days[days.length - 1]) : 31
  const safePeak = Math.max(peak, 0.01)

  return (
    <svg
      className="perf-combo"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={ariaLabel}
    >
      {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
        const y = padT + innerH * (1 - frac)
        return (
          <line
            key={frac}
            className="perf-combo__grid"
            x1={padL}
            x2={width - padR}
            y1={y}
            y2={y}
          />
        )
      })}
      {renderSeries({ padL, padR, padT, padB, innerW, innerH, peak: safePeak, n })}
      <text
        className="perf-combo__ylabel"
        x={12}
        y={padT + innerH / 2}
        transform={`rotate(-90 12 ${padT + innerH / 2})`}
      >
        {yLabel}
      </text>
      <text className="perf-combo__axis" x={padL - 4} y={padT + 8} textAnchor="end">
        {Number.isInteger(safePeak) ? safePeak : safePeak.toFixed(0)}
      </text>
      <text
        className="perf-combo__axis"
        x={padL - 4}
        y={padT + innerH}
        textAnchor="end"
      >
        0
      </text>
      <text
        className="perf-combo__xaxis"
        x={padL}
        y={height - 8}
        textAnchor="start"
      >
        {firstDay}
      </text>
      <text
        className="perf-combo__xaxis perf-combo__xaxis--month"
        x={padL + innerW / 2}
        y={height - 8}
        textAnchor="middle"
      >
        {monthLabel}
      </text>
      <text
        className="perf-combo__xaxis"
        x={width - padR}
        y={height - 8}
        textAnchor="end"
      >
        {lastDay}
      </text>
    </svg>
  )
}

function WordsChart({
  days,
  added,
  removed,
  monthLabel,
}: {
  days: string[]
  added: number[]
  removed: number[]
  monthLabel: string
}) {
  const peak = Math.max(1, ...added, ...removed)
  return (
    <AxisChart
      days={days}
      monthLabel={monthLabel}
      yLabel="Mins"
      peak={peak}
      ariaLabel="Words added and removed each day"
      renderSeries={({ padL, padT, innerW, innerH, peak: p, n }) => {
        const barW = Math.min(10, (innerW / n) * 0.35)
        const points = removed.map((value, index) => {
          const x = padL + (n <= 1 ? innerW / 2 : (index / (n - 1)) * innerW)
          const y = padT + innerH - (value / p) * innerH
          return `${x.toFixed(1)},${y.toFixed(1)}`
        })
        return (
          <>
            {added.map((value, index) => {
              const x =
                padL +
                (n <= 1 ? innerW / 2 : (index / (n - 1)) * innerW) -
                barW / 2
              const h = (value / p) * innerH
              const y = padT + innerH - h
              return (
                <rect
                  key={`a-${days[index]}`}
                  className="perf-combo__bar perf-combo__bar--added"
                  x={x}
                  y={y}
                  width={barW}
                  height={Math.max(0, h)}
                  rx="1.5"
                />
              )
            })}
            {removed.map((value, index) => {
              const x =
                padL +
                (n <= 1 ? innerW / 2 : (index / (n - 1)) * innerW) +
                barW * 0.15
              const h = (value / p) * innerH
              const y = padT + innerH - h
              return (
                <rect
                  key={`r-${days[index]}`}
                  className="perf-combo__bar perf-combo__bar--removed"
                  x={x}
                  y={y}
                  width={barW}
                  height={Math.max(0, h)}
                  rx="1.5"
                />
              )
            })}
            {points.length > 1 ? (
              <polyline className="perf-combo__line" points={points.join(' ')} />
            ) : null}
          </>
        )
      }}
    />
  )
}

function ChatTimeChart({
  days,
  minutes,
  averageMinutes,
  monthLabel,
}: {
  days: string[]
  minutes: number[]
  averageMinutes: number[]
  monthLabel: string
}) {
  const peak = Math.max(30, ...minutes, ...averageMinutes)
  return (
    <AxisChart
      days={days}
      monthLabel={monthLabel}
      yLabel="Mins"
      peak={peak}
      ariaLabel="Daily chat time with seven-day moving average"
      renderSeries={({ padL, padT, innerW, innerH, peak: p, n }) => {
        const barW = Math.min(12, (innerW / n) * 0.55)
        const line = averageMinutes.map((value, index) => {
          const x = padL + (n <= 1 ? innerW / 2 : (index / (n - 1)) * innerW)
          const y = padT + innerH - (value / p) * innerH
          return `${x.toFixed(1)},${y.toFixed(1)}`
        })
        return (
          <>
            {minutes.map((value, index) => {
              const x =
                padL +
                (n <= 1 ? innerW / 2 : (index / (n - 1)) * innerW) -
                barW / 2
              const h = (value / p) * innerH
              const y = padT + innerH - h
              return (
                <rect
                  key={days[index]}
                  className="perf-combo__bar perf-combo__bar--chat"
                  x={x}
                  y={y}
                  width={barW}
                  height={Math.max(0, h)}
                  rx="1.5"
                />
              )
            })}
            {line.length > 1 ? (
              <polyline className="perf-combo__line" points={line.join(' ')} />
            ) : null}
          </>
        )
      }}
    />
  )
}

export function PerformancePanel({ embedded = false }: { embedded?: boolean }) {
  const [months, setMonths] = useState(() => getPerformanceMonthWindows())
  const [talkSeries, setTalkSeries] = useState(() => getTalkPerformanceSeries())
  const [wordSeries, setWordSeries] = useState(() => getWordPerformanceSeries())
  const [avgSeries, setAvgSeries] = useState(() => getTalkMovingAverageSeries())
  const [info, setInfo] = useState<'words' | 'chat' | null>(null)
  const [wordsMonth, setWordsMonth] = useState(0)
  const [chatMonth, setChatMonth] = useState(0)
  const mastery = getLearnMasteryUses()

  useEffect(() => {
    const refresh = () => {
      const nextMonths = getPerformanceMonthWindows()
      setMonths(nextMonths)
      setTalkSeries(getTalkPerformanceSeries())
      setWordSeries(getWordPerformanceSeries())
      setAvgSeries(getTalkMovingAverageSeries())
      const last = Math.max(0, nextMonths.length - 1)
      setWordsMonth(last)
      setChatMonth(last)
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
    const last = Math.max(0, months.length - 1)
    setWordsMonth((current) => Math.min(current, last))
    setChatMonth((current) => Math.min(current, last))
  }, [months])

  const talkByDay = useMemo(() => {
    const map = new Map(talkSeries.map((item) => [item.date, item.hours * 60]))
    return map
  }, [talkSeries])
  const avgByDay = useMemo(() => {
    const map = new Map(avgSeries.map((item) => [item.date, item.hours * 60]))
    return map
  }, [avgSeries])
  const wordsByDay = useMemo(() => {
    const map = new Map(
      wordSeries.map((item) => [
        item.date,
        { added: item.added, removed: item.removed },
      ]),
    )
    return map
  }, [wordSeries])

  const chatStats = useMemo(() => {
    const hours = talkSeries.map((item) => item.hours)
    const total = hours.reduce((sum, value) => sum + value, 0)
    return {
      days: talkSeries.length,
      total,
      average: talkSeries.length ? total / talkSeries.length : 0,
      median: median(hours),
      highest: hours.length ? Math.max(...hours) : 0,
      lowest: hours.length ? Math.min(...hours) : 0,
    }
  }, [talkSeries])

  const wordStats = useMemo(() => {
    const added = wordSeries.reduce((sum, item) => sum + item.added, 0)
    const removed = wordSeries.reduce((sum, item) => sum + item.removed, 0)
    return {
      days: wordSeries.length,
      added,
      removed,
    }
  }, [wordSeries])

  const wordsWindow = months[wordsMonth] ?? months[months.length - 1]
  const chatWindow = months[chatMonth] ?? months[months.length - 1]

  const body = (
    <>
      <section className="perf-card" aria-labelledby="perf-words-title">
        <div className="perf-card__head">
          <div>
            <h2 id="perf-words-title">Words learned</h2>
            <p className="perf-card__sub">
              English words added and removed each day
            </p>
          </div>
          <InfoButton
            label="About words learned"
            open={info === 'words'}
            onToggle={() => setInfo((value) => (value === 'words' ? null : 'words'))}
          />
        </div>
        {info === 'words' ? (
          <p className="perf-card__explain" role="note">
            Bars show how many English words were added to your Learn List each
            day, and how many left the list after {mastery} correct uses in
            conversation. Drag the slider right for later months, left for
            earlier ones, back to your first day with Kea.
          </p>
        ) : null}
        <div className="perf-card__legend" aria-hidden="true">
          <span>
            <i className="perf-swatch perf-swatch--added" /> Added
          </span>
          <span>
            <i className="perf-swatch perf-swatch--removed" /> Removed
          </span>
        </div>
        {wordsWindow ? (
          <>
            <WordsChart
              days={wordsWindow.days}
              monthLabel={wordsWindow.label}
              added={wordsWindow.days.map(
                (day) => wordsByDay.get(day)?.added ?? 0,
              )}
              removed={wordsWindow.days.map(
                (day) => wordsByDay.get(day)?.removed ?? 0,
              )}
            />
            <MonthSlider
              months={months}
              index={wordsMonth}
              onChange={setWordsMonth}
              label="Slide words learned by month"
            />
          </>
        ) : (
          <p className="perf-card__empty">No data yet.</p>
        )}
        <div className="perf-stats">
          <p>
            Total days: {wordStats.days}
            <br />
            Words added: {wordStats.added}
          </p>
          <p>
            Words removed: {wordStats.removed}
            <br />
            Mastered total: {wordStats.removed}
          </p>
        </div>
      </section>

      <section className="perf-card" aria-labelledby="perf-chat-title">
        <div className="perf-card__head">
          <div>
            <h2 id="perf-chat-title">Chat time</h2>
            <p className="perf-card__sub">
              Daily usage (minutes) with 7-day moving average
            </p>
          </div>
          <InfoButton
            label="About chat time"
            open={info === 'chat'}
            onToggle={() => setInfo((value) => (value === 'chat' ? null : 'chat'))}
          />
        </div>
        {info === 'chat' ? (
          <p className="perf-card__explain" role="note">
            Light bars are how long you talked with Kea each day in minutes. The
            dark line is the seven-day moving average. Drag the slider right for
            later months, left for earlier ones.
          </p>
        ) : null}
        <div className="perf-card__legend" aria-hidden="true">
          <span>
            <i className="perf-swatch perf-swatch--chat" /> Daily usage
          </span>
          <span>
            <i className="perf-swatch perf-swatch--avg" /> 7-day average
          </span>
        </div>
        {chatWindow ? (
          <>
            <ChatTimeChart
              days={chatWindow.days}
              monthLabel={chatWindow.label}
              minutes={chatWindow.days.map((day) => talkByDay.get(day) ?? 0)}
              averageMinutes={chatWindow.days.map(
                (day) => avgByDay.get(day) ?? 0,
              )}
            />
            <MonthSlider
              months={months}
              index={chatMonth}
              onChange={setChatMonth}
              label="Slide chat time by month"
            />
          </>
        ) : (
          <p className="perf-card__empty">No data yet.</p>
        )}
        <div className="perf-stats">
          <p>
            Total days: {chatStats.days}
            <br />
            Total usage: {minutesLabel(chatStats.total)}
          </p>
          <p>
            Average per day: {minutesLabel(chatStats.average)}
            <br />
            Median per day: {minutesLabel(chatStats.median)}
          </p>
          <p>
            Highest day: {minutesLabel(chatStats.highest)}
            <br />
            Lowest day: {minutesLabel(chatStats.lowest)}
          </p>
        </div>
      </section>
    </>
  )

  if (embedded) {
    return <section className="settings-card settings-card--performance">{body}</section>
  }
  return <div className="performance-page__panel">{body}</div>
}
