/** Admin-managed promotional pop-ups (device-stored). */

const STORAGE_KEY = 'kea-offers-v1'
const HOME_DISMISS_KEY = 'kea-offer-home-dismissed'
const SUB_LEAVE_DISMISS_KEY = 'kea-offer-subleave-dismissed'
const SUB_LEAVE_PENDING_KEY = 'kea-offer-subleave-pending'

export type KeaOfferId = 'home' | 'limit' | 'subLeave'

/** Where Pop up 1 (id `home`) may appear. */
export type OfferAppearPage = 'marketing' | 'home' | 'subscriptions'

export const OFFER_APPEAR_PAGES: ReadonlyArray<{
  id: OfferAppearPage
  label: string
}> = [
  { id: 'marketing', label: 'Marketing' },
  { id: 'home', label: 'Home' },
  { id: 'subscriptions', label: 'Subscriptions' },
]

/** Default sunset sky with Kea flying — replaceable per offer in Admin. */
export const DEFAULT_OFFER_BACKGROUND = '/offer-sky-kea.png'

export interface KeaOffer {
  id: KeaOfferId
  enabled: boolean
  /** Short label shown as a badge, e.g. "50% off" */
  badge: string
  title: string
  body: string
  ctaLabel: string
  /** In-app path for the primary button */
  ctaPath: string
  /**
   * Background image URL or data URL.
   * Empty string means the built-in default (sky image or CSS design).
   */
  backgroundImage: string
  /**
   * Pop up 1 only: which screen shows this offer.
   * Ignored for limit / subLeave offers.
   */
  appearOn?: OfferAppearPage
  /** Optional discount code to highlight / apply (e.g. Superlearner). */
  discountCode?: string
}

export const DEFAULT_OFFERS: KeaOffer[] = [
  {
    id: 'home',
    enabled: true,
    badge: '50% off',
    title: 'Talk more with Kea',
    body: 'Welcome home. Take half off your first month and keep the conversation going.',
    ctaLabel: 'Grab Special offer',
    ctaPath: '/subscription',
    backgroundImage: '',
    appearOn: 'marketing',
  },
  {
    id: 'limit',
    enabled: true,
    badge: 'Keep talking',
    title: 'Your free time is up',
    body: 'Today’s allowance or your seven-day trial has ended. Choose a plan and Kea will be ready whenever you are.',
    ctaLabel: 'Go to Subscriptions',
    ctaPath: '/subscription',
    backgroundImage: '',
  },
  {
    id: 'subLeave',
    enabled: true,
    badge: '60% off · Superlearner',
    title: 'Grab this now',
    body: "This special offer won't be here when you come back. Grab Superlearner now for 60% off — once you leave, it's gone.",
    ctaLabel: 'Grab Superlearner now',
    ctaPath: '/subscription',
    backgroundImage: '',
    discountCode: 'Superlearner',
  },
]

function isAppearPage(value: unknown): value is OfferAppearPage {
  return value === 'marketing' || value === 'home' || value === 'subscriptions'
}

function isOfferId(value: unknown): value is KeaOfferId {
  return value === 'home' || value === 'limit' || value === 'subLeave'
}

function isOffer(value: unknown): value is KeaOffer {
  if (!value || typeof value !== 'object') return false
  const item = value as KeaOffer
  return (
    isOfferId(item.id) &&
    typeof item.enabled === 'boolean' &&
    typeof item.badge === 'string' &&
    typeof item.title === 'string' &&
    typeof item.body === 'string' &&
    typeof item.ctaLabel === 'string' &&
    typeof item.ctaPath === 'string'
  )
}

export function offerBackgroundSrc(offer: KeaOffer): string {
  const custom = offer.backgroundImage?.trim()
  if (custom) return custom
  if (offer.id === 'subLeave') return ''
  return DEFAULT_OFFER_BACKGROUND
}

export function getPopup1AppearOn(offer: KeaOffer): OfferAppearPage {
  return isAppearPage(offer.appearOn) ? offer.appearOn : 'marketing'
}

/** Whether Pop up 1 should open on this page (enabled, not dismissed, page matches). */
export function shouldShowPopup1(page: OfferAppearPage): boolean {
  const offer = getOffer('home')
  if (!offer.enabled || isHomeOfferDismissed()) return false
  return getPopup1AppearOn(offer) === page
}

export function loadOffers(): KeaOffer[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return structuredClone(DEFAULT_OFFERS)
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return structuredClone(DEFAULT_OFFERS)
    const byId = new Map(
      parsed.filter(isOffer).map((item) => [item.id, item] as const),
    )
    return DEFAULT_OFFERS.map((base) => {
      const saved = byId.get(base.id)
      if (!saved) return { ...base }
      return {
        ...base,
        ...saved,
        id: base.id,
        badge: saved.badge.trim() || base.badge,
        title: saved.title.trim() || base.title,
        body: saved.body.trim() || base.body,
        ctaLabel:
          !saved.ctaLabel.trim() ||
          saved.ctaLabel.trim().toLowerCase() === 'see subscriptions'
            ? base.ctaLabel
            : saved.ctaLabel.trim(),
        ctaPath: saved.ctaPath.trim() || base.ctaPath,
        backgroundImage:
          typeof saved.backgroundImage === 'string'
            ? saved.backgroundImage
            : '',
        appearOn:
          base.id === 'home'
            ? isAppearPage(saved.appearOn)
              ? saved.appearOn
              : base.appearOn
            : undefined,
        discountCode:
          typeof saved.discountCode === 'string' && saved.discountCode.trim()
            ? saved.discountCode.trim()
            : base.discountCode,
      }
    })
  } catch {
    return structuredClone(DEFAULT_OFFERS)
  }
}

export function saveOffers(offers: KeaOffer[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(offers))
  clearHomeOfferDismiss()
  clearSubLeaveOfferDismiss()
  window.dispatchEvent(new Event('kea-offers-changed'))
}

export function getOffer(id: KeaOfferId): KeaOffer {
  return (
    loadOffers().find((item) => item.id === id) ??
    DEFAULT_OFFERS.find((item) => item.id === id)!
  )
}

export function updateOffer(id: KeaOfferId, patch: Partial<KeaOffer>) {
  const next = loadOffers().map((item) =>
    item.id === id ? { ...item, ...patch, id } : item,
  )
  saveOffers(next)
  return getOffer(id)
}

export function resetOffers() {
  localStorage.removeItem(STORAGE_KEY)
  clearHomeOfferDismiss()
  clearSubLeaveOfferDismiss()
  clearSubLeaveOfferPending()
  window.dispatchEvent(new Event('kea-offers-changed'))
}

export function isHomeOfferDismissed() {
  try {
    return sessionStorage.getItem(HOME_DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

export function clearHomeOfferDismiss() {
  try {
    sessionStorage.removeItem(HOME_DISMISS_KEY)
  } catch {
    // ignore
  }
}

export function dismissHomeOffer() {
  try {
    sessionStorage.setItem(HOME_DISMISS_KEY, '1')
  } catch {
    // ignore
  }
}

export function isSubLeaveOfferDismissed() {
  try {
    return sessionStorage.getItem(SUB_LEAVE_DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

export function clearSubLeaveOfferDismiss() {
  try {
    sessionStorage.removeItem(SUB_LEAVE_DISMISS_KEY)
  } catch {
    // ignore
  }
}

export function dismissSubLeaveOffer() {
  try {
    sessionStorage.setItem(SUB_LEAVE_DISMISS_KEY, '1')
  } catch {
    // ignore
  }
}

export function shouldShowSubLeaveOffer(isPaidSubscriber: boolean): boolean {
  if (isPaidSubscriber) return false
  const offer = getOffer('subLeave')
  if (!offer.enabled || isSubLeaveOfferDismissed()) return false
  return true
}

export function markSubLeaveOfferPending() {
  try {
    sessionStorage.setItem(SUB_LEAVE_PENDING_KEY, '1')
  } catch {
    // ignore
  }
}

export function consumeSubLeaveOfferPending(): boolean {
  try {
    if (sessionStorage.getItem(SUB_LEAVE_PENDING_KEY) !== '1') return false
    sessionStorage.removeItem(SUB_LEAVE_PENDING_KEY)
    return true
  } catch {
    return false
  }
}

export function clearSubLeaveOfferPending() {
  try {
    sessionStorage.removeItem(SUB_LEAVE_PENDING_KEY)
  } catch {
    // ignore
  }
}

/** Compress an uploaded image for localStorage-backed offer backgrounds. */
export function readOfferBackground(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    const url = URL.createObjectURL(file)
    image.onload = () => {
      const max = 960
      const scale = Math.min(1, max / Math.max(image.width, image.height))
      const width = Math.max(1, Math.round(image.width * scale))
      const height = Math.max(1, Math.round(image.height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')
      if (!context) {
        URL.revokeObjectURL(url)
        reject(new Error('Could not read image'))
        return
      }
      context.drawImage(image, 0, 0, width, height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.78))
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read image'))
    }
    image.src = url
  })
}
