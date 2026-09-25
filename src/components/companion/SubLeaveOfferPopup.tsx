import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { KEA_FLY_SRC } from '../../data/keaAbout'
import {
  offerBackgroundSrc,
  type KeaOffer,
} from '../../data/keaOffers'
import { getMarketingIntroVoice } from '../../architecture/voiceCatalog'
import { applyDiscountCode } from '../../architecture/keaDiscountCodes'
import { speakManagedVoice, speakKeaLine, stopKeaSpeech } from '../../services/keaSpeak'

interface SubLeaveOfferPopupProps {
  offer: KeaOffer
  onClose: () => void
  /** Stay on subscriptions after grabbing the code. */
  onGrab?: () => void
}

function snapToWordEnd(text: string, charIndex: number) {
  if (charIndex <= 0) return ''
  if (charIndex >= text.length) return text
  let end = charIndex
  while (end < text.length && !/\s/.test(text[end]!)) end += 1
  return text.slice(0, end)
}

/** Spoken special offer when leaving Subscriptions without signing up. */
export function SubLeaveOfferPopup({
  offer,
  onClose,
  onGrab,
}: SubLeaveOfferPopupProps) {
  const [line, setLine] = useState('')
  const runId = useRef(0)
  const customBg = offerBackgroundSrc(offer)
  const code = offer.discountCode?.trim() || 'Superlearner'

  useEffect(() => {
    const id = ++runId.current
    stopKeaSpeech()
    setLine('')
    const voice = getMarketingIntroVoice()
    const text = offer.body
    const finish = () => {
      if (id !== runId.current) return
      setLine(text)
    }
    const opts = {
      onCharIndex: (charIndex: number) => {
        if (id !== runId.current) return
        setLine(snapToWordEnd(text, charIndex))
      },
      onend: finish,
      onerror: finish,
    }
    if (voice) void speakManagedVoice(voice, text, opts)
    else void speakKeaLine(text, opts)
    return () => {
      runId.current += 1
      stopKeaSpeech()
    }
  }, [offer.body])

  function grab() {
    try {
      applyDiscountCode(code)
    } catch {
      // Code still shown on the card; Subscriptions can accept it manually.
    }
    stopKeaSpeech()
    if (onGrab) onGrab()
    else onClose()
  }

  const cardStyle = customBg
    ? ({
        '--offer-bg-image': `url("${customBg.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}")`,
      } as CSSProperties)
    : undefined

  return (
    <div
      className="sub-leave-offer"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sub-leave-offer-title"
      onClick={() => {
        stopKeaSpeech()
        onClose()
      }}
    >
      <div
        className={`sub-leave-offer__card${customBg ? ' has-photo' : ''}`}
        style={cardStyle}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="sub-leave-offer__close"
          onClick={() => {
            stopKeaSpeech()
            onClose()
          }}
        >
          Close
        </button>
        <div className="sub-leave-offer__stage" aria-hidden="true">
          <span className="sub-leave-offer__blob sub-leave-offer__blob--a" />
          <span className="sub-leave-offer__blob sub-leave-offer__blob--b" />
          <span className="sub-leave-offer__blob sub-leave-offer__blob--c" />
          <img className="sub-leave-offer__kea" src={KEA_FLY_SRC} alt="" />
        </div>
        <div className="sub-leave-offer__copy">
          {offer.badge ? (
            <p className="sub-leave-offer__badge">{offer.badge}</p>
          ) : null}
          <h2 id="sub-leave-offer-title" className="sub-leave-offer__title">
            {offer.title}
          </h2>
          <p className="sub-leave-offer__body" aria-live="off">
            {line || '…'}
          </p>
          <p className="sub-leave-offer__code">
            Code: <strong>{code}</strong>
          </p>
          <div className="sub-leave-offer__actions">
            <button type="button" className="kea-button" onClick={grab}>
              {offer.ctaLabel}
            </button>
            <button
              type="button"
              className="kea-button kea-button--ghost"
              onClick={() => {
                stopKeaSpeech()
                onClose()
              }}
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
