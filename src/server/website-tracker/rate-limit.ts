type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

const WINDOW_MS = 60_000
const MAX_REQUESTS = 60
const MAX_EVENTS = 200

export function checkWebsiteTrackerRateLimit(
  key: string,
  eventCount: number,
): { ok: boolean; retryAfterSec?: number } {
  const now = Date.now()
  let bucket = buckets.get(key)
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + WINDOW_MS }
    buckets.set(key, bucket)
  }

  bucket.count += 1
  const eventsKey = `${key}:events`
  let eventsBucket = buckets.get(eventsKey)
  if (!eventsBucket || now >= eventsBucket.resetAt) {
    eventsBucket = { count: 0, resetAt: now + WINDOW_MS }
    buckets.set(eventsKey, eventsBucket)
  }
  eventsBucket.count += Math.max(0, eventCount)

  if (bucket.count > MAX_REQUESTS || eventsBucket.count > MAX_EVENTS) {
    const retryAfterSec = Math.max(
      1,
      Math.ceil((Math.min(bucket.resetAt, eventsBucket.resetAt) - now) / 1000),
    )
    return { ok: false, retryAfterSec }
  }

  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (now >= v.resetAt) buckets.delete(k)
    }
  }

  return { ok: true }
}
