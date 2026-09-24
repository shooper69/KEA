/** Admin-managed subscription discount codes (device-stored catalog). */

const STORAGE_KEY = 'kea-discount-codes-v1'
const APPLIED_KEY = 'kea-applied-discount-v1'

export interface KeaDiscountCode {
  id: string
  /** Admin label, e.g. "Exit popup" */
  title: string
  /** Display / entry code, e.g. "Superlearner" */
  code: string
  /** 0–100 */
  percentOff: number
}

export const DEFAULT_DISCOUNT_CODES: KeaDiscountCode[] = [
  {
    id: 'kea-friend',
    title: "Kea's friend",
    code: "kea's friend",
    percentOff: 100,
  },
  {
    id: 'exit-superlearner',
    title: 'Exit popup',
    code: 'Superlearner',
    percentOff: 60,
  },
]

function normalizeCode(code: string) {
  return code.trim().toLowerCase().replace(/\s+/g, ' ')
}

function isDiscount(value: unknown): value is KeaDiscountCode {
  if (!value || typeof value !== 'object') return false
  const item = value as KeaDiscountCode
  return (
    typeof item.id === 'string' &&
    typeof item.code === 'string' &&
    Number.isFinite(Number(item.percentOff))
  )
}

function normalizeDiscount(item: KeaDiscountCode): KeaDiscountCode {
  return {
    id: item.id || crypto.randomUUID(),
    title: String(item.title ?? '').trim(),
    code: String(item.code).trim() || 'code',
    percentOff: Math.min(100, Math.max(0, Math.round(Number(item.percentOff) || 0))),
  }
}

export function loadDiscountCodes(): KeaDiscountCode[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return structuredClone(DEFAULT_DISCOUNT_CODES)
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return structuredClone(DEFAULT_DISCOUNT_CODES)
    const byId = new Map(
      parsed.filter(isDiscount).map((item) => [item.id, normalizeDiscount(item)]),
    )
    // Keep admin edits, but ensure default codes (e.g. Exit popup) still exist.
    const merged = DEFAULT_DISCOUNT_CODES.map((base) => {
      const saved = byId.get(base.id)
      if (!saved) return { ...base }
      byId.delete(base.id)
      return {
        ...base,
        ...saved,
        id: base.id,
        title: saved.title || base.title,
        code: saved.code || base.code,
      }
    })
    for (const extra of byId.values()) merged.push(extra)
    return merged.length ? merged : structuredClone(DEFAULT_DISCOUNT_CODES)
  } catch {
    return structuredClone(DEFAULT_DISCOUNT_CODES)
  }
}

export function saveDiscountCodes(codes: KeaDiscountCode[]) {
  const next = codes.map((item) => normalizeDiscount(item))
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
}

export function findDiscountCode(entry: string): KeaDiscountCode | null {
  const needle = normalizeCode(entry)
  if (!needle) return null
  return (
    loadDiscountCodes().find((item) => normalizeCode(item.code) === needle) ??
    null
  )
}

export interface AppliedDiscount {
  code: string
  percentOff: number
  appliedAt: string
}

export function getAppliedDiscount(): AppliedDiscount | null {
  try {
    const raw = localStorage.getItem(APPLIED_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<AppliedDiscount>
    if (typeof parsed.code !== 'string' || !parsed.code.trim()) return null
    const percentOff = Math.min(
      100,
      Math.max(0, Math.round(Number(parsed.percentOff) || 0)),
    )
    return {
      code: parsed.code.trim(),
      percentOff,
      appliedAt:
        typeof parsed.appliedAt === 'string'
          ? parsed.appliedAt
          : new Date().toISOString(),
    }
  } catch {
    return null
  }
}

export function applyDiscountCode(entry: string): AppliedDiscount {
  const match = findDiscountCode(entry)
  if (!match) {
    throw new Error('That discount code is not recognised.')
  }
  const applied: AppliedDiscount = {
    code: match.code,
    percentOff: match.percentOff,
    appliedAt: new Date().toISOString(),
  }
  localStorage.setItem(APPLIED_KEY, JSON.stringify(applied))
  return applied
}

export function clearAppliedDiscount() {
  try {
    localStorage.removeItem(APPLIED_KEY)
  } catch {
    // ignore
  }
}

export function discountedPrice(monthlyPrice: number, percentOff: number) {
  const pct = Math.min(100, Math.max(0, percentOff))
  return Math.max(0, Math.round(monthlyPrice * (100 - pct)) / 100)
}

export function newDiscountCode(): KeaDiscountCode {
  return {
    id: crypto.randomUUID(),
    title: '',
    code: '',
    percentOff: 100,
  }
}
