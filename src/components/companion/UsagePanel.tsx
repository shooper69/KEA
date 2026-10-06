import { useEffect, useState } from 'react'
import { getMonthlyCreditUsage } from '../../architecture/keaBilling'
import {
  formatMonthlyAllowance,
  formatSoftDailyPace,
} from '../../architecture/keaPlans'

function minutesLabel(minutes: number) {
  if (minutes < 0.05) return '0 minutes'
  if (minutes < 60) {
    if (minutes < 10) return `${minutes.toFixed(1)} minutes`
    return `${Math.round(minutes)} minutes`
  }
  const hours = Math.round((minutes / 60) * 10) / 10
  return `${hours} hour${hours === 1 ? '' : 's'}`
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
          Your plan’s talk time is a monthly allowance. The daily figure is only
          a soft pace to help you spread it out.
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
        <>
          <p className="settings-note">
            {minutesLabel(usage.minutesLeft)} left this month of{' '}
            {formatMonthlyAllowance(usage.dailyMinutesAllowed)}.
          </p>
          {usage.dailyMinutesAllowed > 0 ? (
            <p className="settings-note">
              Soft pace: {formatSoftDailyPace(usage.dailyMinutesAllowed)}.
            </p>
          ) : null}
        </>
      ) : null}
    </section>
  )
}
