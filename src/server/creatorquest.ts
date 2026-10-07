type Env = {
  CREATORQUEST_EVENTS_URL?: string
  CREATORQUEST_APP_KEY?: string
}

export function readCreatorQuestRef(cookieHeader?: string | null): string | null {
  if (!cookieHeader) return null
  const match = cookieHeader.match(/(?:^|;\s*)cq_ref=([^;]+)/)
  if (!match) return null
  const ref = decodeURIComponent(match[1]).trim().toLowerCase()
  return /^[a-z0-9]{10,16}$/.test(ref) ? ref : null
}

export async function postCreatorQuestEvent(
  env: Env,
  body: Record<string, unknown>,
) {
  const url = env.CREATORQUEST_EVENTS_URL?.trim()
  const key = env.CREATORQUEST_APP_KEY?.trim()
  if (!url || !key) {
    console.warn('[creatorquest] CREATORQUEST_EVENTS_URL / CREATORQUEST_APP_KEY not set')
    return { ok: false as const, skipped: true as const }
  }
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    const json = await response.json().catch(() => ({}))
    if (!response.ok) {
      console.error('[creatorquest] event failed', response.status, json)
      return { ok: false as const, status: response.status, json }
    }
    return { ok: true as const, json }
  } catch (error) {
    console.error('[creatorquest] event error', error)
    return { ok: false as const, error }
  }
}
