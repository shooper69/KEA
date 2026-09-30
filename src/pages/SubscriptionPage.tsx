import { useEffect, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { CloudAtmosphere } from '../components/companion/CloudAtmosphere'
import { CompanionNav } from '../components/companion/CompanionNav'
import { OfferPopup } from '../components/companion/OfferPopup'
import { SubscriptionPanel } from '../components/companion/SubscriptionPanel'
import { getTalkAccess } from '../architecture/keaBilling'
import { useSession } from '../context/SessionContext'
import {
  dismissHomeOffer,
  getOffer,
  markSubLeaveOfferPending,
  shouldShowPopup1,
  shouldShowSubLeaveOffer,
} from '../data/keaOffers'

export function SubscriptionPage() {
  const [searchParams] = useSearchParams()
  const { email, userId, isAdmin } = useSession()
  const [popup1Open, setPopup1Open] = useState(() =>
    shouldShowPopup1('subscriptions'),
  )

  useEffect(() => {
    function maybeShow() {
      setPopup1Open(shouldShowPopup1('subscriptions'))
    }
    maybeShow()
    window.addEventListener('kea-offers-changed', maybeShow)
    return () => window.removeEventListener('kea-offers-changed', maybeShow)
  }, [])

  useEffect(() => {
    return () => {
      const paid = getTalkAccess(isAdmin).status === 'active'
      if (shouldShowSubLeaveOffer(paid)) {
        markSubLeaveOfferPending()
      }
    }
  }, [isAdmin])

  if (searchParams.get('view') === 'usage') {
    return <Navigate to="/usage" replace />
  }

  return (
    <main
      className={`companion-screen settings-screen${
        popup1Open ? ' has-offer-dock' : ''
      }`}
    >
      <CloudAtmosphere presence="idle" />
      <header className="settings-screen__header">
        <CompanionNav />
      </header>
      <div className="settings-screen__content">
        <div className="settings-title-row">
          <h1>Subscription</h1>
          <Link
            to="/conversation"
            className="settings-close"
            aria-label="Close subscription"
          >
            ×
          </Link>
        </div>
        <SubscriptionPanel email={email} userId={userId} isAdmin={isAdmin} />
      </div>
      {popup1Open ? (
        <OfferPopup
          offer={getOffer('home')}
          tone="home"
          onClose={() => {
            dismissHomeOffer()
            setPopup1Open(false)
          }}
        />
      ) : null}
    </main>
  )
}
