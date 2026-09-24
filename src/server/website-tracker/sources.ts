export type WtSourceBucket =
  | 'google'
  | 'direct'
  | 'x'
  | 'facebook'
  | 'linkedin'
  | 'referral'
  | 'email'
  | 'other'

export function classifyTrafficSource(opts: {
  source?: string | null
  medium?: string | null
  referrer?: string | null
}): WtSourceBucket {
  const source = (opts.source || '').toLowerCase()
  const medium = (opts.medium || '').toLowerCase()
  const ref = (opts.referrer || '').toLowerCase()

  if (medium === 'email' || source === 'email' || source === 'newsletter') return 'email'
  if (
    source.includes('google') ||
    medium === 'organic' ||
    ref.includes('google.') ||
    ref.includes('googleapis')
  ) {
    return 'google'
  }
  if (
    source.includes('facebook') ||
    source === 'fb' ||
    source === 'meta' ||
    ref.includes('facebook.com') ||
    ref.includes('fb.com') ||
    ref.includes('instagram.com')
  ) {
    return 'facebook'
  }
  if (
    source === 'x' ||
    source.includes('twitter') ||
    ref.includes('twitter.com') ||
    ref.includes('x.com') ||
    ref.includes('t.co')
  ) {
    return 'x'
  }
  if (source.includes('linkedin') || ref.includes('linkedin.com')) return 'linkedin'
  if (!source && !medium && !ref) return 'direct'
  if (medium === 'referral' || ref) return 'referral'
  if (!source && !medium) return 'direct'
  return 'other'
}

export const SOURCE_LABELS: Record<WtSourceBucket, string> = {
  google: 'Google',
  direct: 'Direct',
  x: 'X',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  referral: 'Referral',
  email: 'Email',
  other: 'Other',
}
