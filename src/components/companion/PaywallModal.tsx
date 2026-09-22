import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getTalkAccess,
  type TalkBlockReason,
} from '../../architecture/keaBilling'

export function PaywallModal({
  reason,
  onClose,
}: {
  reason: TalkBlockReason
  onClose: () => void
}) {
  const expired = reason === 'trial-expired'
  return (
    <div className="paywall" role="dialog" aria-modal="true" aria-labelledby="paywall-title">
      <div className="paywall__card">
        <h2 id="paywall-title">
          {expired ? 'Your trial has expired' : 'That’s all for today'}
        </h2>
        <p>
          {expired
            ? 'Now proceed to Subscriptions to pay, and you can keep talking with Kea.'
            : 'You have used today’s conversation time. Come back tomorrow, or pick a higher plan.'}
        </p>
        <div className="paywall__actions">
          <Link className="kea-button" to="/settings?tab=subscription" onClick={onClose}>
            Go to Subscriptions
          </Link>
          <button type="button" className="kea-button kea-button--ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export function useTalkGate(isAdmin: boolean) {
  const [block, setBlock] = useState<TalkBlockReason | null>(null)

  useEffect(() => {
    const access = getTalkAccess(isAdmin)
    if (access.reason === 'trial-expired') setBlock('trial-expired')
  }, [isAdmin])

  function guardStart() {
    const access = getTalkAccess(isAdmin)
    if (!access.ok) {
      setBlock(access.reason)
      return false
    }
    return true
  }

  return { block, setBlock, guardStart }
}
