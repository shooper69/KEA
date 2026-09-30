import { createHmac, timingSafeEqual } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import {
  isKeaPlanId,
  normalizeSubscriptionStatus,
  planFromSubscriptionObject,
  planIdFromPriceId,
  priceIdForPlan,
  readProfileBilling,
  serverDiscountForCode,
  upsertBillingProfile,
  type KeaPlanId,
} from './keaStripeBilling.ts'
import { requireKeaUser } from './keaUserAuth.ts'

type BillingEnv = {
  STRIPE_SECRET_KEY?: string
  STRIPE_WEBHOOK_SECRET?: string
  SUPABASE_URL?: string
  SUPABASE_SERVICE_ROLE_KEY?: string
}

type CheckoutPayload = {
  planId?: string
  email?: string
  successUrl?: string
  cancelUrl?: string
  discountCode?: string
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

function header(req: IncomingMessage, name: string) {
  const raw = req.headers[name.toLowerCase()]
  return Array.isArray(raw) ? raw[0] : raw
}

function reqHeaders(req: IncomingMessage): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {}
  for (const [key, value] of Object.entries(req.headers)) {
    out[key] = Array.isArray(value) ? value[0] : value
  }
  return out
}

function keaOriginUrl(candidate: string | undefined, fallback: string) {
  const raw = (candidate || '').trim() || fallback
  try {
    const url = new URL(raw)
    const host = url.hostname.toLowerCase()
    if (
      host === 'kea.chat' ||
      host === 'www.kea.chat' ||
      host === 'localhost' ||
      host === '127.0.0.1'
    ) {
      return url.toString()
    }
  } catch {
    // fall through
  }
  return fallback
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

function couponIdFromCode(code: string, percentOff: number) {
  const slug = code
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 36)
  return `kea_${slug || 'offer'}_${percentOff}`
}

/** Ensure a percent-off coupon exists in Stripe (first invoice / move-fast offers). */
async function ensurePercentOffCoupon(
  apiKey: string,
  code: string,
  percentOff: number,
) {
  const id = couponIdFromCode(code, percentOff)
  const existing = await stripeGet(apiKey, `coupons/${id}`)
  if (existing.ok) return id
  const form = new URLSearchParams()
  form.set('id', id)
  form.set('name', `Kea ${code.trim()} · ${percentOff}% off`)
  form.set('percent_off', String(percentOff))
  form.set('duration', 'once')
  form.set('metadata[kea_discount_code]', code.trim())
  const created = await stripeForm(apiKey, 'coupons', form)
  if (!created.ok) {
    throw new Error(
      stripeErrorMessage(created.data) || 'Could not create Stripe coupon',
    )
  }
  return id
}

function verifyStripeWebhook(
  rawBody: Buffer,
  signatureHeader: string | undefined,
  secret: string,
) {
  if (!signatureHeader || !secret) return false
  const parts = signatureHeader.split(',').map((piece) => piece.trim())
  const stamp = parts.find((piece) => piece.startsWith('t='))?.slice(2)
  const v1 = parts.find((piece) => piece.startsWith('v1='))?.slice(3)
  if (!stamp || !v1) return false
  const age = Math.abs(Date.now() / 1000 - Number(stamp))
  if (!Number.isFinite(age) || age > 300) return false
  const expected = createHmac('sha256', secret)
    .update(`${stamp}.${rawBody.toString('utf8')}`)
    .digest('hex')
  try {
    const a = Buffer.from(expected, 'utf8')
    const b = Buffer.from(v1, 'utf8')
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

function stripeErrorMessage(data: Record<string, unknown>) {
  if (
    typeof data.error === 'object' &&
    data.error &&
    'message' in data.error
  ) {
    return String((data.error as { message?: string }).message)
  }
  return ''
}

async function applySubscriptionToProfile(
  env: BillingEnv,
  sub: Record<string, unknown>,
  extras: { customerId?: string | null; email?: string | null; userId?: string | null } = {},
) {
  const parsed = planFromSubscriptionObject(sub)
  return upsertBillingProfile(env, {
    userId: extras.userId || parsed.userId,
    customerId: extras.customerId || parsed.customerId,
    subscriptionId: parsed.subscriptionId,
    planId: parsed.planId,
    status: parsed.status,
    currentPeriodEnd: parsed.currentPeriodEnd,
    email: extras.email,
  })
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
    const secret = env.STRIPE_WEBHOOK_SECRET?.trim()
    if (!secret) {
      json(res, 501, {
        error: 'STRIPE_WEBHOOK_SECRET is not set for Kea.',
      })
      return
    }
    const signature = header(req, 'stripe-signature')
    if (!verifyStripeWebhook(raw, signature, secret)) {
      json(res, 400, { error: 'Invalid Stripe signature' })
      return
    }
    let event: {
      type?: string
      data?: { object?: Record<string, unknown> }
    }
    try {
      event = JSON.parse(raw.toString('utf8')) as typeof event
    } catch {
      json(res, 400, { error: 'Invalid webhook JSON' })
      return
    }
    const type = event.type ?? ''
    const object = event.data?.object ?? {}

    try {
      if (type === 'checkout.session.completed') {
        const session = object
        const meta = (session.metadata ?? {}) as Record<string, string>
        const planId = isKeaPlanId(meta.planId)
          ? meta.planId
          : isKeaPlanId(session.client_reference_id)
            ? (session.client_reference_id as KeaPlanId)
            : null
        const userId =
          (typeof meta.userId === 'string' && meta.userId) ||
          (typeof session.client_reference_id === 'string' &&
          !isKeaPlanId(session.client_reference_id)
            ? session.client_reference_id
            : null)
        const customerId =
          typeof session.customer === 'string' ? session.customer : null
        const subscriptionId =
          typeof session.subscription === 'string' ? session.subscription : null
        const email =
          typeof session.customer_email === 'string'
            ? session.customer_email
            : typeof session.customer_details === 'object' &&
                session.customer_details &&
                typeof (session.customer_details as { email?: string }).email ===
                  'string'
              ? (session.customer_details as { email: string }).email
              : null

        let resolvedPlan = planId
        let status = normalizeSubscriptionStatus('active')
        let periodEnd: string | null = null
        if (subscriptionId && key) {
          const { ok, data } = await stripeGet(key, `subscriptions/${subscriptionId}`)
          if (ok) {
            const parsed = planFromSubscriptionObject(data)
            resolvedPlan = parsed.planId || resolvedPlan
            status = parsed.status
            periodEnd = parsed.currentPeriodEnd
          }
        }
        await upsertBillingProfile(env, {
          userId,
          customerId,
          subscriptionId,
          planId: resolvedPlan,
          status,
          currentPeriodEnd: periodEnd,
          email,
        })
      } else if (
        type === 'customer.subscription.updated' ||
        type === 'customer.subscription.created' ||
        type === 'customer.subscription.deleted'
      ) {
        const parsed = planFromSubscriptionObject(object)
        const status =
          type === 'customer.subscription.deleted'
            ? normalizeSubscriptionStatus('canceled')
            : parsed.status
        await upsertBillingProfile(env, {
          userId: parsed.userId,
          customerId: parsed.customerId,
          subscriptionId: parsed.subscriptionId,
          planId: parsed.planId,
          status,
          currentPeriodEnd: parsed.currentPeriodEnd,
        })
      } else if (type === 'invoice.payment_failed') {
        const invoice = object
        const customerId =
          typeof invoice.customer === 'string' ? invoice.customer : null
        const subscriptionId =
          typeof invoice.subscription === 'string' ? invoice.subscription : null
        let planId: KeaPlanId | null = null
        if (subscriptionId && key) {
          const { ok, data } = await stripeGet(key, `subscriptions/${subscriptionId}`)
          if (ok) {
            const parsed = planFromSubscriptionObject(data)
            planId = parsed.planId
            await applySubscriptionToProfile(env, {
              ...data,
              status: 'past_due',
            }, { customerId })
            json(res, 200, { received: true, type })
            return
          }
        }
        await upsertBillingProfile(env, {
          customerId,
          subscriptionId,
          planId,
          status: 'past_due',
        })
      } else if (type === 'invoice.paid') {
        const invoice = object
        const subscriptionId =
          typeof invoice.subscription === 'string' ? invoice.subscription : null
        if (subscriptionId && key) {
          const { ok, data } = await stripeGet(key, `subscriptions/${subscriptionId}`)
          if (ok) await applySubscriptionToProfile(env, data)
        }
      }
    } catch (caught) {
      json(res, 500, {
        error: caught instanceof Error ? caught.message : 'Webhook handler failed',
      })
      return
    }

    json(res, 200, { received: true, type })
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
    const auth = await requireKeaUser(reqHeaders(req))
    if (!auth.ok) {
      json(res, auth.status, { error: auth.error })
      return
    }

    let payload: CheckoutPayload
    try {
      payload = JSON.parse((await readBody(req)).toString('utf8')) as CheckoutPayload
    } catch {
      json(res, 400, { error: 'Invalid JSON' })
      return
    }
    if (!isKeaPlanId(payload.planId)) {
      json(res, 400, { error: 'Unknown Kea plan.' })
      return
    }
    const planId = payload.planId
    const stripePriceId = priceIdForPlan(planId)
    const discount = serverDiscountForCode(String(payload.discountCode ?? ''))
    let couponId: string | null = null
    if (discount && discount.percentOff > 0 && discount.percentOff < 100) {
      try {
        couponId = await ensurePercentOffCoupon(
          key,
          discount.code,
          discount.percentOff,
        )
      } catch (caught) {
        json(res, 502, {
          error:
            caught instanceof Error
              ? caught.message
              : 'Could not prepare Stripe discount',
        })
        return
      }
    }
    // 100% off: still create a coupon so Checkout can zero the first invoice.
    if (discount && discount.percentOff >= 100) {
      try {
        couponId = await ensurePercentOffCoupon(key, discount.code, 100)
      } catch (caught) {
        json(res, 502, {
          error:
            caught instanceof Error
              ? caught.message
              : 'Could not prepare Stripe discount',
        })
        return
      }
    }

    const success = keaOriginUrl(
      payload.successUrl,
      'https://kea.chat/subscription?checkout=success',
    )
    const cancel = keaOriginUrl(
      payload.cancelUrl,
      'https://kea.chat/subscription?checkout=cancel',
    )
    const joiner = success.includes('?') ? '&' : '?'
    const form = new URLSearchParams()
    form.set('ui_mode', 'hosted_page')
    form.set('mode', 'subscription')
    form.set('billing_address_collection', 'auto')
    form.set('phone_number_collection[enabled]', 'false')
    form.set('automatic_tax[enabled]', 'false')
    form.set('payment_method_collection', 'always')
    form.set('submit_type', 'auto')
    form.set('saved_payment_method_options[payment_method_save]', 'enabled')
    form.set('integration_identifier', 'hosted_web_0001')
    form.set('origin_context', 'web')
    form.set('adaptive_pricing[enabled]', 'true')
    form.set('success_url', `${success}${joiner}session_id={CHECKOUT_SESSION_ID}`)
    form.set('cancel_url', cancel)
    form.set('metadata[planId]', planId)
    form.set('subscription_data[metadata][planId]', planId)
    form.set('client_reference_id', auth.userId)
    form.set('metadata[userId]', auth.userId)
    form.set('subscription_data[metadata][userId]', auth.userId)
    if (auth.email) form.set('customer_email', auth.email)
    else if (payload.email?.trim()) {
      form.set('customer_email', payload.email.trim().toLowerCase())
    }
    form.set('line_items[0][price]', stripePriceId)
    form.set('line_items[0][quantity]', '1')
    if (discount) {
      form.set('metadata[kea_discount_code]', discount.code)
      form.set('subscription_data[metadata][kea_discount_code]', discount.code)
      form.set('metadata[kea_discount_percent]', String(discount.percentOff))
      form.set(
        'subscription_data[metadata][kea_discount_percent]',
        String(discount.percentOff),
      )
    }
    if (couponId) {
      form.set('discounts[0][coupon]', couponId)
    }
    const { ok, data } = await stripeForm(key, 'checkout/sessions', form)
    if (!ok) {
      json(res, 502, {
        error: stripeErrorMessage(data) || 'Stripe checkout failed',
      })
      return
    }
    json(res, 200, { url: data.url, id: data.id })
    return
  }

  if (path.endsWith('/session') && method === 'GET') {
    const auth = await requireKeaUser(reqHeaders(req))
    if (!auth.ok) {
      json(res, auth.status, { error: auth.error })
      return
    }
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
    const sessionUserId =
      typeof meta.userId === 'string' && meta.userId
        ? meta.userId
        : typeof data.client_reference_id === 'string' &&
            !isKeaPlanId(data.client_reference_id)
          ? data.client_reference_id
          : ''
    if (sessionUserId && sessionUserId !== auth.userId) {
      json(res, 403, { error: 'This checkout belongs to another account.' })
      return
    }
    let planId =
      (isKeaPlanId(meta.planId) && meta.planId) ||
      (isKeaPlanId(data.client_reference_id) ? data.client_reference_id : '')
    const subscriptionId =
      typeof data.subscription === 'string' ? data.subscription : ''
    let subscriptionStatus = ''
    let currentPeriodEnd: string | null = null
    if (subscriptionId) {
      const sub = await stripeGet(key, `subscriptions/${subscriptionId}`)
      if (sub.ok) {
        const parsed = planFromSubscriptionObject(sub.data)
        if (parsed.planId) planId = parsed.planId
        subscriptionStatus = parsed.status
        currentPeriodEnd = parsed.currentPeriodEnd
        const linePrice =
          (
            sub.data.items as
              | { data?: Array<{ price?: { id?: string } }> }
              | undefined
          )?.data?.[0]?.price?.id ?? ''
        if (!planId) planId = planIdFromPriceId(linePrice) || ''
      }
    }
    const paid =
      data.payment_status === 'paid' ||
      data.status === 'complete' ||
      subscriptionStatus === 'active' ||
      subscriptionStatus === 'trialing'

    if (paid) {
      await upsertBillingProfile(env, {
        userId: auth.userId,
        customerId: typeof data.customer === 'string' ? data.customer : null,
        subscriptionId: subscriptionId || null,
        planId: isKeaPlanId(planId) ? planId : null,
        status: normalizeSubscriptionStatus(subscriptionStatus || 'active'),
        currentPeriodEnd,
        email: auth.email || null,
      })
    }

    json(res, 200, {
      paid,
      planId,
      customer: data.customer ?? '',
      subscription: subscriptionId,
      subscriptionStatus: subscriptionStatus || (paid ? 'active' : ''),
      currentPeriodEnd,
      userId: auth.userId,
    })
    return
  }

  if (path.endsWith('/portal') && method === 'POST') {
    const auth = await requireKeaUser(reqHeaders(req))
    if (!auth.ok) {
      json(res, auth.status, { error: auth.error })
      return
    }
    let payload: { returnUrl?: string }
    try {
      payload = JSON.parse((await readBody(req)).toString('utf8')) as typeof payload
    } catch {
      json(res, 400, { error: 'Invalid JSON' })
      return
    }
    const profile = await readProfileBilling(env, auth.userId)
    const customerId = profile?.customerId
    if (!customerId) {
      json(res, 400, {
        error: 'No Stripe customer on this account yet. Subscribe first.',
      })
      return
    }
    const form = new URLSearchParams()
    form.set('customer', customerId)
    form.set(
      'return_url',
      keaOriginUrl(payload.returnUrl, 'https://kea.chat/subscription'),
    )
    const { ok, data } = await stripeForm(key, 'billing_portal/sessions', form)
    if (!ok) {
      json(res, 502, {
        error: stripeErrorMessage(data) || 'Could not open the billing portal',
      })
      return
    }
    json(res, 200, { url: data.url })
    return
  }

  json(res, 404, { error: 'Unknown billing route' })
}
