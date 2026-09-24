import { useRef, useState } from 'react'
import {
  DEFAULT_OFFERS,
  OFFER_APPEAR_PAGES,
  clearHomeOfferDismiss,
  getOffer,
  getPopup1AppearOn,
  loadOffers,
  offerBackgroundSrc,
  readOfferBackground,
  resetOffers,
  saveOffers,
  type KeaOffer,
  type KeaOfferId,
  type OfferAppearPage,
} from '../data/keaOffers'
import { OfferPopup } from '../components/companion/OfferPopup'

const LABELS: Record<KeaOfferId, { heading: string; note: string }> = {
  home: {
    heading: 'Pop up 1',
    note: 'Promotional pop-up. Choose which page it appears on, edit the wording, and optionally upload a sky background.',
  },
  limit: {
    heading: 'Usage & trial offer',
    note: 'Shows when today’s talk allowance is used up, and when the seven-day trial ends.',
  },
}

export function AdminOffersPage() {
  const [offers, setOffers] = useState(() => loadOffers())
  const [saved, setSaved] = useState('')
  const [preview, setPreview] = useState<KeaOfferId | null>(null)
  const [uploadError, setUploadError] = useState('')
  const fileRefs = useRef<Partial<Record<KeaOfferId, HTMLInputElement | null>>>(
    {},
  )

  function patch(id: KeaOfferId, next: Partial<KeaOffer>) {
    setOffers((current) =>
      current.map((item) => (item.id === id ? { ...item, ...next } : item)),
    )
    setSaved('')
  }

  function commit() {
    saveOffers(offers)
    setSaved('Saved.')
  }

  async function onBackground(id: KeaOfferId, file: File | undefined) {
    if (!file) return
    setUploadError('')
    try {
      const dataUrl = await readOfferBackground(file)
      patch(id, { backgroundImage: dataUrl })
    } catch {
      setUploadError('Could not read that image. Try a JPG or PNG under a few MB.')
    }
  }

  const previewOffer =
    preview != null
      ? offers.find((item) => item.id === preview) ?? getOffer(preview)
      : null

  return (
    <>
      <section className="settings-card">
        <h2>Offers</h2>
        <p className="settings-note">
          Special offer pop-ups. Turn each one on or off, edit the wording, and
          optionally upload a sky background. On phones the card sits at the
          bottom; on tablets and PCs it sits top-right so the centre of the
          screen stays usable.
        </p>
      </section>

      {offers.map((offer) => {
        const meta = LABELS[offer.id]
        const previewSrc = offerBackgroundSrc(offer)
        const appearOn = getPopup1AppearOn(offer)
        return (
          <section key={offer.id} className="settings-card">
            <h2>{meta.heading}</h2>
            <p className="settings-note">{meta.note}</p>
            <label className="settings-toggle">
              <input
                type="checkbox"
                checked={offer.enabled}
                onChange={(event) =>
                  patch(offer.id, { enabled: event.target.checked })
                }
              />
              Show this offer (on / off)
            </label>
            {offer.id === 'home' ? (
              <>
                <label className="welcome-field">
                  <span>Appear on</span>
                  <select
                    value={appearOn}
                    onChange={(event) =>
                      patch(offer.id, {
                        appearOn: event.target.value as OfferAppearPage,
                      })
                    }
                  >
                    {OFFER_APPEAR_PAGES.map((page) => (
                      <option key={page.id} value={page.id}>
                        {page.label}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="kea-button kea-button--ghost"
                  onClick={() => {
                    clearHomeOfferDismiss()
                    saveOffers(offers)
                    setSaved('Pop up 1 will show again on the chosen page.')
                  }}
                >
                  Show Pop up 1 again now
                </button>
              </>
            ) : null}
            <label className="welcome-field">
              <span>Badge</span>
              <input
                type="text"
                value={offer.badge}
                onChange={(event) =>
                  patch(offer.id, { badge: event.target.value })
                }
              />
            </label>
            <label className="welcome-field">
              <span>Title</span>
              <input
                type="text"
                value={offer.title}
                onChange={(event) =>
                  patch(offer.id, { title: event.target.value })
                }
              />
            </label>
            <label className="welcome-field">
              <span>Body</span>
              <textarea
                rows={4}
                value={offer.body}
                onChange={(event) =>
                  patch(offer.id, { body: event.target.value })
                }
              />
            </label>
            <label className="welcome-field">
              <span>Button label</span>
              <input
                type="text"
                value={offer.ctaLabel}
                onChange={(event) =>
                  patch(offer.id, { ctaLabel: event.target.value })
                }
              />
            </label>
            <label className="welcome-field">
              <span>Button path</span>
              <input
                type="text"
                value={offer.ctaPath}
                onChange={(event) =>
                  patch(offer.id, { ctaPath: event.target.value })
                }
              />
            </label>
            <div className="welcome-field">
              <span>Background image</span>
              <p className="settings-note">
                Default is a sunset sky with Kea flying. Upload your own photo
                to replace it for this offer.
              </p>
              <div
                className="offer-admin__preview"
                style={{ backgroundImage: `url(${previewSrc})` }}
                aria-hidden="true"
              />
              <input
                ref={(node) => {
                  fileRefs.current[offer.id] = node
                }}
                className="visually-hidden"
                type="file"
                accept="image/*"
                onChange={(event) =>
                  void onBackground(offer.id, event.target.files?.[0])
                }
              />
              <div className="offer-admin__bg-actions">
                <button
                  type="button"
                  className="kea-button"
                  onClick={() => fileRefs.current[offer.id]?.click()}
                >
                  Upload image
                </button>
                {offer.backgroundImage ? (
                  <button
                    type="button"
                    className="kea-button kea-button--ghost"
                    onClick={() => patch(offer.id, { backgroundImage: '' })}
                  >
                    Use default sky
                  </button>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              className="kea-button kea-button--ghost settings-save"
              onClick={() => {
                saveOffers(offers)
                setPreview(offer.id)
              }}
            >
              Preview pop-up
            </button>
          </section>
        )
      })}

      <section className="settings-card">
        {uploadError ? <p className="settings-note">{uploadError}</p> : null}
        {saved ? <p className="settings-note">{saved}</p> : null}
        <button type="button" className="kea-button settings-save" onClick={commit}>
          Save offers
        </button>
        <button
          type="button"
          className="kea-button kea-button--ghost settings-save"
          onClick={() => {
            resetOffers()
            setOffers(structuredClone(DEFAULT_OFFERS))
            setSaved('Restored defaults.')
          }}
        >
          Restore defaults
        </button>
      </section>

      {previewOffer ? (
        <OfferPopup
          offer={previewOffer}
          tone={previewOffer.id}
          onClose={() => setPreview(null)}
        />
      ) : null}
    </>
  )
}
