import { useEffect, useState } from 'react'
import { getMonthlyCreditUsage } from '../../architecture/keaBilling'
import { formatDailyMinutes } from '../../architecture/keaPlans'

function minutesLabel(minutes: number) {
  if (minutes < 0.05) return '0 minutes'
  if (minutes < 10) return `${minutes.toFixed(1)} minutes`
  return `${Math.round(minutes)} minutes`
}

export function UsagePanel({ isAdmin }: { isAdmin: boolean }) {
  const [usage, setUsage] = useState(() => getMonthlyCreditUsage(isAdmin))

  useEffect(() => {
    setUsage(getMonthlyCreditUsage(isAdmin))
  }, [isAdmin])

  return (
    <section className="settings-card">
      <h2>Usage</h2>
      {isAdmin ? null : (
        <p className="settings-note">
          Time left to talk this month on your plan.
        </p>
      )}
      <div
        className="usage-meter"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={usage.usedPercent}
        aria-label="Credits used this month"
      >
        <div className="usage-meter__track">
          <div
            className="usage-meter__fill"
            style={{ width: `${usage.usedPercent}%` }}
          />
        </div>
        <p className="usage-meter__labels">
          <span>Used {usage.usedPercent}%</span>
          <span>Remaining {usage.remainingPercent}%</span>
        </p>
      </div>
      {!isAdmin && usage.unlimited ? (
        <p className="settings-note">This plan has no monthly time limit.</p>
      ) : null}
      {!isAdmin && !usage.unlimited ? (
        <p className="settings-note">
          {minutesLabel(usage.minutesLeft)} left this month
          {usage.dailyMinutesAllowed
            ? ` · ${formatDailyMinutes(usage.dailyMinutesAllowed)}.`
            : '.'}
        </p>
      ) : null}
    </section>
  )
}
