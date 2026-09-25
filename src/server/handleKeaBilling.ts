import type { IncomingMessage, ServerResponse } from 'node:http'

type BillingEnv = {
  STRIPE_SECRET_KEY?: string
}

type CheckoutPayload = {
  planId?: string
  planName?: string
  monthlyPrice?: number
  email?: string
  successUrl?: string
  cancelUrl?: string
  stripePriceId?: string
}

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

function pathOf(req: IncomingMessage) {
  return (req.url ?? '').split('?')[0] ?? ''
}

async function stripeForm(
  apiKey: string,
  path: string,
  body: URLSearchParams,
) {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })
  const data = (await response.json()) as Record<string, unknown>
  return { ok: response.ok, data }
}

async function stripeGet(apiKey: string, path: string) {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  const data = (await response.json()) as Record<string, unknown>
  return { ok: response.ok, data }
}

export async function handleKeaBilling(
  req: IncomingMessage,
  res: ServerResponse,
  env: BillingEnv,
) {
  const path = pathOf(req)
  const key = env.STRIPE_SECRET_KEY?.trim()
  const method = req.method ?? 'GET'

  if (path.endsWith('/webhook') && method === 'POST') {
    const raw = await readBody(req)
    let event: { type?: string; data?: { object?: Record<string, unknown> } }
    try {
      event = JSON.parse(raw.toString('utf8')) as typeof event
    } catch {
      json(res, 400, { error: 'Invalid webhook' })
      return
    }
    json(res, 200, { received: true, type: event.type ?? '' })
    return
  }

  if (!key) {
    json(res, 501, {
      error:
        'Stripe is not configured. Add STRIPE_SECRET_KEY for Kea on Netlify (and in local .env).',
    })
    return
  }

  if (path.endsWith('/checkout') && method === 'POST') {
    let payload: CheckoutPayload
    try {
      payload = JSON.parse((await readBody(req)).toString('utf8')) as CheckoutPayload
    } catch {
      json(res, 400, { error: 'Invalid JSON' })
      return
    }
    const cents = Math.round(Number(payload.monthlyPrice) * 100)
    if (!payload.planId || !Number.isFinite(cents) || cents < 100) {
      json(res, 400, { error: 'Need a plan and a monthly price.' })
      return
    }
    const success =
      payload.successUrl?.trim() ||
      'http://localhost:5173/subscription?checkout=success'
    const cancel =
      payload.cancelUrl?.trim() ||
      'http://localhost:5173/subscription?checkout=cancel'
    const joiner = success.includes('?') ? '&' : '?'
    const form = new URLSearchParams()
    form.set('mode', 'subscription')
    form.set('success_url', `${success}${joiner}session_id={CHECKOUT_SESSION_ID}`)
    form.set('cancel_url', cancel)
    form.set('client_reference_id', payload.planId)
    form.set('metadata[planId]', payload.planId)
    form.set('subscription_data[metadata][planId]', payload.planId)
    if (payload.email?.trim()) form.set('customer_email', payload.email.trim())
    if (payload.stripePriceId?.trim()) {
      form.set('line_items[0][price]', payload.stripePriceId.trim())
      form.set('line_items[0][quantity]', '1')
    } else {
      form.set('line_items[0][quantity]', '1')
      form.set('line_items[0][price_data][currency]', 'usd')
      form.set('line_items[0][price_data][unit_amount]', String(cents))
      form.set('line_items[0][price_data][recurring][interval]', 'month')
      form.set(
        'line_items[0][price_data][product_data][name]',
        `Kea ${payload.planName || payload.planId}`,
      )
    }
    const { ok, data } = await stripeForm(key, 'checkout/sessions', form)
    if (!ok) {
      json(res, 502, {
        error:
          typeof data.error === 'object' &&
          data.error &&
          'message' in data.error
            ? String((data.error as { message?: string }).message)
            : 'Stripe checkout failed',
      })
      return
    }
    json(res, 200, { url: data.url, id: data.id })
    return
  }

  if (path.endsWith('/session') && method === 'GET') {
    const id = new URL(req.url ?? '', 'http://local').searchParams.get('id')
    if (!id) {
      json(res, 400, { error: 'Missing session id' })
      return
    }
    const { ok, data } = await stripeGet(key, `checkout/sessions/${id}`)
    if (!ok) {
      json(res, 502, { error: 'Could not read that Stripe session' })
      return
    }
    const meta = (data.metadata ?? {}) as Record<string, string>
    json(res, 200, {
      paid:
        data.payment_status === 'paid' ||
        data.status === 'complete',
      planId: meta.planId || data.client_reference_id || '',
      customer: data.customer ?? '',
      subscription: data.subscription ?? '',
    })
    return
  }

  if (path.endsWith('/portal') && method === 'POST') {
    let payload: { customerId?: string; returnUrl?: string }
    try {
      payload = JSON.parse((await readBody(req)).toString('utf8')) as typeof payload
    } catch {
      json(res, 400, { error: 'Invalid JSON' })
      return
    }
    if (!payload.customerId) {
      json(res, 400, { error: 'Need a Stripe customer' })
      return
    }
    const form = new URLSearchParams()
    form.set('customer', payload.customerId)
    form.set(
      'return_url',
      payload.returnUrl?.trim() || 'http://localhost:5173/subscription',
    )
    const { ok, data } = await stripeForm(key, 'billing_portal/sessions', form)
    if (!ok) {
      json(res, 502, { error: 'Could not open the billing portal' })
      return
    }
    json(res, 200, { url: data.url })
    return
  }

  json(res, 404, { error: 'Unknown billing route' })
}
