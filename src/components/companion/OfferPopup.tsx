import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { applyDiscountCode } from '../../architecture/keaDiscountCodes'
import {
  offerBackgroundSrc,
  type KeaOffer,
} from '../../data/keaOffers'

interface OfferPopupProps {
  offer: KeaOffer
  onClose: () => void
  /** Optional override when trial vs daily limit wording is still needed as fallback. */
  tone?: 'home' | 'limit'
}

export function OfferPopup({ offer, onClose, tone = 'home' }: OfferPopupProps) {
  const background = offerBackgroundSrc(offer)
  const cardStyle = {
    '--offer-bg-image': `url("${background.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}")`,
  } as CSSProperties

  function takeOffer() {
    const code = offer.discountCode?.trim()
    if (code) {
      try {
        applyDiscountCode(code)
      } catch {
        // Still open Subscriptions; user can enter the code shown on the offer.
      }
    }
    onClose()
  }

  return (
    <div
      className={`offer-popup offer-popup--${tone} offer-popup--docked`}
      role="dialog"
      aria-modal="false"
      aria-labelledby="offer-popup-title"
    >
      <div className="offer-popup__card" style={cardStyle}>
        <button type="button" className="offer-popup__close" onClick={onClose}>
          Close
        </button>
        {offer.badge ? (
          <p className="offer-popup__badge">{offer.badge}</p>
        ) : null}
        <h2 id="offer-popup-title" className="offer-popup__title">
          {offer.title}
        </h2>
        <p className="offer-popup__body">{offer.body}</p>
        <div className="offer-popup__actions">
          <Link className="kea-button" to={offer.ctaPath} onClick={takeOffer}>
            {offer.ctaLabel}
          </Link>
          <button
            type="button"
            className="kea-button kea-button--ghost"
            onClick={onClose}
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  )
}
