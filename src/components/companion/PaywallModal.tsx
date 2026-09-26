import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getTalkAccess,
  type TalkBlockReason,
} from '../../architecture/keaBilling'
import { getOffer } from '../../data/keaOffers'
import { OfferPopup } from './OfferPopup'

export function PaywallModal({
  reason,
  onClose,
}: {
  reason: TalkBlockReason
  onClose: () => void
}) {
  const offer = getOffer('limit')
  if (offer.enabled) {
    return <OfferPopup offer={offer} tone="limit" onClose={onClose} />
  }

  const expired = reason === 'trial-expired' || reason === 'canceled'
  return (
    <div className="paywall" role="dialog" aria-modal="true" aria-labelledby="paywall-title">
      <div className="paywall__card">
        <h2 id="paywall-title">
          {reason === 'canceled'
            ? 'Subscription ended'
            : expired
              ? 'Your trial has expired'
              : 'That’s all for today'}
        </h2>
        <p>
          {reason === 'canceled'
            ? 'Your Kea subscription is no longer active. Choose a plan to keep talking.'
            : expired
              ? 'Now proceed to Subscriptions to pay, and you can keep talking with Kea.'
              : 'You have used today’s conversation time. Come back tomorrow, or pick a higher plan.'}
        </p>
        <div className="paywall__actions">
          <Link className="kea-button" to="/subscription" onClick={onClose}>
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
    if (access.ok) {
      setBlock(null)
      return
    }
    if (
      access.reason === 'trial-expired' ||
      access.reason === 'daily-limit' ||
      access.reason === 'canceled'
    ) {
      setBlock(access.reason)
    }
  }, [isAdmin])

  function guardStart() {
    const access = getTalkAccess(isAdmin)
    if (!access.ok) {
      setBlock(access.reason)
      return false
    }
    setBlock(null)
    return true
  }

  return { block, setBlock, guardStart }
}
