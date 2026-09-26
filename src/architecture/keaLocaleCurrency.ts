/** Local presentment currency for Kea plan prices (USD catalog → local display). */

const STORAGE_RATES = 'kea-fx-usd-rates-v1'
const STORAGE_CURRENCY = 'kea-display-currency-v1'
const RATE_TTL_MS = 12 * 60 * 60 * 1000

/** Approximate Stripe Adaptive Pricing presentment fee baked into display. */
const PRESENTMENT_BUFFER = 1.03

const REGION_CURRENCY: Record<string, string> = {
  US: 'USD',
  GB: 'GBP',
  UK: 'GBP',
  IE: 'EUR',
  FR: 'EUR',
  DE: 'EUR',
  ES: 'EUR',
  IT: 'EUR',
  NL: 'EUR',
  BE: 'EUR',
  AT: 'EUR',
  PT: 'EUR',
  FI: 'EUR',
  GR: 'EUR',
  LU: 'EUR',
  MT: 'EUR',
  CY: 'EUR',
  SK: 'EUR',
  SI: 'EUR',
  EE: 'EUR',
  LV: 'EUR',
  LT: 'EUR',
  HR: 'EUR',
  AU: 'AUD',
  NZ: 'NZD',
  CA: 'CAD',
  MX: 'MXN',
  BR: 'BRL',
  JP: 'JPY',
  KR: 'KRW',
  CN: 'CNY',
  HK: 'HKD',
  SG: 'SGD',
  IN: 'INR',
  SE: 'SEK',
  NO: 'NOK',
  DK: 'DKK',
  CH: 'CHF',
  PL: 'PLN',
  CZ: 'CZK',
  HU: 'HUF',
  RO: 'RON',
  TR: 'TRY',
  ZA: 'ZAR',
  AE: 'AED',
  SA: 'SAR',
  IL: 'ILS',
  TH: 'THB',
  MY: 'MYR',
  ID: 'IDR',
  PH: 'PHP',
  VN: 'VND',
  TW: 'TWD',
  AR: 'ARS',
  CL: 'CLP',
  CO: 'COP',
  PE: 'PEN',
}

type RateCache = {
  fetchedAt: number
  rates: Record<string, number>
}

let memoryRates: RateCache | null = null
let memoryCurrency: string | null = null
const listeners = new Set<() => void>()

function emit() {
  for (const fn of listeners) fn()
}

export function subscribeDisplayCurrency(fn: () => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

function readRateCache(): RateCache | null {
  if (memoryRates && Date.now() - memoryRates.fetchedAt < RATE_TTL_MS) {
    return memoryRates
  }
  try {
    const raw = localStorage.getItem(STORAGE_RATES)
    if (!raw) return null
    const parsed = JSON.parse(raw) as RateCache
    if (
      !parsed ||
      typeof parsed.fetchedAt !== 'number' ||
      !parsed.rates ||
      Date.now() - parsed.fetchedAt >= RATE_TTL_MS
    ) {
      return null
    }
    memoryRates = parsed
    return parsed
  } catch {
    return null
  }
}

function writeRateCache(rates: Record<string, number>) {
  const next: RateCache = { fetchedAt: Date.now(), rates }
  memoryRates = next
  try {
    localStorage.setItem(STORAGE_RATES, JSON.stringify(next))
  } catch {
    // ignore
  }
}

/** ISO 4217 from browser locale / region. */
export function detectLocalCurrency(): string {
  if (memoryCurrency) return memoryCurrency
  try {
    const saved = localStorage.getItem(STORAGE_CURRENCY)?.trim().toUpperCase()
    if (saved && /^[A-Z]{3}$/.test(saved)) {
      memoryCurrency = saved
      return saved
    }
  } catch {
    // ignore
  }
  try {
    const base = new Intl.Locale(navigator.language || 'en-US')
    const maximized =
      typeof base.maximize === 'function' ? base.maximize() : base
    const region = (maximized.region || '').toUpperCase()
    const mapped = REGION_CURRENCY[region]
    if (mapped) {
      memoryCurrency = mapped
      return mapped
    }
  } catch {
    // ignore
  }
  memoryCurrency = 'USD'
  return 'USD'
}

export function setDisplayCurrency(code: string) {
  const next = code.trim().toUpperCase()
  if (!/^[A-Z]{3}$/.test(next)) return
  memoryCurrency = next
  try {
    localStorage.setItem(STORAGE_CURRENCY, next)
  } catch {
    // ignore
  }
  emit()
}

export function getDisplayCurrency() {
  return detectLocalCurrency()
}

/** USD major units → local major units (includes Adaptive Pricing-ish buffer). */
export function usdToLocal(amountUsd: number, currency = getDisplayCurrency()) {
  const code = currency.toUpperCase()
  if (code === 'USD' || !Number.isFinite(amountUsd)) return amountUsd
  const cache = readRateCache()
  const rate = cache?.rates[code]
  if (!rate || rate <= 0) return amountUsd
  return amountUsd * rate * PRESENTMENT_BUFFER
}

export function formatMoney(
  amount: number,
  currency = getDisplayCurrency(),
  locale = typeof navigator !== 'undefined' ? navigator.language : 'en-US',
) {
  const code = currency.toUpperCase()
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: code,
      currencyDisplay: 'symbol',
      maximumFractionDigits: code === 'JPY' || code === 'KRW' || code === 'VND' ? 0 : 2,
    }).format(amount)
  } catch {
    return `${code} ${amount.toFixed(2)}`
  }
}

/** Format a USD catalog price in the visitor’s local currency. */
export function formatPlanPrice(amountUsd: number) {
  const currency = getDisplayCurrency()
  if (currency === 'USD') return formatMoney(amountUsd, 'USD', 'en-US')
  const local = usdToLocal(amountUsd, currency)
  // If rates not loaded yet, still show USD so we never invent a number.
  const cache = readRateCache()
  if (!cache?.rates[currency]) return formatMoney(amountUsd, 'USD', 'en-US')
  return formatMoney(local, currency)
}

export function localPricingReady() {
  const currency = getDisplayCurrency()
  if (currency === 'USD') return true
  return Boolean(readRateCache()?.rates[currency])
}

export function localPricingNote() {
  const currency = getDisplayCurrency()
  if (currency === 'USD') return ''
  if (!localPricingReady()) {
    return 'Prices shown in USD until local rates load. Stripe Checkout will show your local currency when available.'
  }
  return `Prices shown in ${currency} (approx.). Final amount is confirmed on Stripe Checkout.`
}

/** Fetch ECB-based USD→local rates (Frankfurter). Safe to call often. */
export async function ensureFxRates(): Promise<void> {
  const currency = getDisplayCurrency()
  if (currency === 'USD') {
    emit()
    return
  }
  const cached = readRateCache()
  if (cached?.rates[currency]) {
    emit()
    return
  }
  try {
    const response = await fetch(
      'https://api.frankfurter.app/latest?from=USD',
    )
    if (!response.ok) return
    const data = (await response.json()) as { rates?: Record<string, number> }
    if (!data.rates) return
    writeRateCache({ ...data.rates, USD: 1 })
    emit()
  } catch {
    // keep USD display
  }
}
