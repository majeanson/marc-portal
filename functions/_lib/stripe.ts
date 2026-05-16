// Stripe REST + Web Crypto. No SDK — the @stripe/stripe-node package is Node-
// shaped (https module, EventEmitter) and works on Workers only via shims that
// bloat the bundle. Stripe's REST API is form-urlencoded, paginated by cursor,
// and stable enough that the surface we use here is ~80 lines.
//
// What's here:
//   - createOneTimeCheckoutSession()         — Tier 1 / Tier 2 deposit / etc.
//   - createSubscriptionCheckoutSession()    — Custodian mode $200/yr
//   - createBillingPortalSession()           — Customer Portal link for sub mgmt
//   - verifyWebhookSignature()               — Stripe-Signature header check
//
// Nothing here writes to D1; callers do. Nothing here decides authorization;
// callers do. Pure stripe-side IO + crypto.

const STRIPE_API = 'https://api.stripe.com/v1'

export type PaymentKind = 'tier1' | 'tier2-deposit' | 'tier2-final' | 'tier3' | 'custodian-sub'

/**
 * Map a kind to a human label that shows up on the customer's receipt + the
 * Stripe Dashboard. Kept stable; visitors actually read these.
 */
const KIND_LABELS: Record<Exclude<PaymentKind, 'custodian-sub'>, { fr: string; en: string }> = {
  tier1: { fr: 'Tier 1 — petit projet', en: 'Tier 1 — small project' },
  'tier2-deposit': { fr: 'Tier 2 — dépôt (50 %)', en: 'Tier 2 — deposit (50%)' },
  'tier2-final': { fr: 'Tier 2 — solde final (50 %)', en: 'Tier 2 — final balance (50%)' },
  tier3: { fr: 'Tier 3 — projet sur devis', en: 'Tier 3 — quoted project' },
}

export interface CheckoutSessionResult {
  id: string // cs_test_... / cs_live_...
  url: string // the URL we redirect the visitor to
}

interface OneTimeOpts {
  apiKey: string
  amountCents: number
  kind: Exclude<PaymentKind, 'custodian-sub'>
  /** Payment row id we minted on our side. Passed as client_reference_id so
   *  the webhook can locate it without scanning. */
  paymentId: string
  sessionId: string
  visitorEmail: string
  successUrl: string
  cancelUrl: string
  lang: 'fr' | 'en'
  /** Suffix appended to the line-item label, e.g. the project's showcase title.
   *  Kept ≤ 80 chars by Stripe. */
  projectLabel?: string
}

export async function createOneTimeCheckoutSession(opts: OneTimeOpts): Promise<CheckoutSessionResult> {
  const baseLabel = KIND_LABELS[opts.kind][opts.lang]
  const label = opts.projectLabel ? `${baseLabel} — ${opts.projectLabel}`.slice(0, 80) : baseLabel

  const form = new URLSearchParams()
  form.set('mode', 'payment')
  form.set('locale', opts.lang === 'fr' ? 'fr-CA' : 'en')
  form.set('customer_email', opts.visitorEmail)
  form.set('client_reference_id', opts.paymentId)
  form.set('success_url', opts.successUrl)
  form.set('cancel_url', opts.cancelUrl)
  form.set('line_items[0][price_data][currency]', 'cad')
  form.set('line_items[0][price_data][product_data][name]', label)
  form.set('line_items[0][price_data][unit_amount]', String(opts.amountCents))
  form.set('line_items[0][quantity]', '1')
  // Metadata travels with both the Checkout session AND the resulting
  // PaymentIntent — the webhook reads it from either shape.
  form.set('metadata[payment_id]', opts.paymentId)
  form.set('metadata[session_id]', opts.sessionId)
  form.set('metadata[kind]', opts.kind)
  form.set('payment_intent_data[metadata][payment_id]', opts.paymentId)
  form.set('payment_intent_data[metadata][session_id]', opts.sessionId)
  form.set('payment_intent_data[metadata][kind]', opts.kind)

  return await postCheckoutSession(opts.apiKey, form)
}

interface SubOpts {
  apiKey: string
  priceId: string // price_xxx from Stripe Dashboard
  paymentId: string
  sessionId: string
  visitorEmail: string
  successUrl: string
  cancelUrl: string
  lang: 'fr' | 'en'
}

export async function createSubscriptionCheckoutSession(opts: SubOpts): Promise<CheckoutSessionResult> {
  const form = new URLSearchParams()
  form.set('mode', 'subscription')
  form.set('locale', opts.lang === 'fr' ? 'fr-CA' : 'en')
  form.set('customer_email', opts.visitorEmail)
  form.set('client_reference_id', opts.paymentId)
  form.set('success_url', opts.successUrl)
  form.set('cancel_url', opts.cancelUrl)
  form.set('line_items[0][price]', opts.priceId)
  form.set('line_items[0][quantity]', '1')
  form.set('metadata[payment_id]', opts.paymentId)
  form.set('metadata[session_id]', opts.sessionId)
  form.set('metadata[kind]', 'custodian-sub')
  // Mirror onto the subscription itself; webhook events for renewals carry
  // the subscription's metadata, not the original Checkout's.
  form.set('subscription_data[metadata][payment_id]', opts.paymentId)
  form.set('subscription_data[metadata][session_id]', opts.sessionId)
  form.set('subscription_data[metadata][kind]', 'custodian-sub')

  return await postCheckoutSession(opts.apiKey, form)
}

async function postCheckoutSession(apiKey: string, form: URLSearchParams): Promise<CheckoutSessionResult> {
  const res = await fetch(`${STRIPE_API}/checkout/sessions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      // Stripe-Version pin — keep behavior stable across API rollouts. Bump
      // intentionally with a code change, not silently.
      'Stripe-Version': '2024-11-20.acacia',
    },
    body: form.toString(),
  })
  const text = await res.text()
  if (!res.ok) {
    throw new Error(`stripe checkout create failed: ${res.status} ${text}`)
  }
  const data = JSON.parse(text) as { id: string; url: string }
  return { id: data.id, url: data.url }
}

interface PortalOpts {
  apiKey: string
  customerId: string
  returnUrl: string
  lang: 'fr' | 'en'
}

export async function createBillingPortalSession(opts: PortalOpts): Promise<{ url: string }> {
  const form = new URLSearchParams()
  form.set('customer', opts.customerId)
  form.set('return_url', opts.returnUrl)
  form.set('locale', opts.lang === 'fr' ? 'fr-CA' : 'en')

  const res = await fetch(`${STRIPE_API}/billing_portal/sessions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Stripe-Version': '2024-11-20.acacia',
    },
    body: form.toString(),
  })
  const text = await res.text()
  if (!res.ok) {
    throw new Error(`stripe portal create failed: ${res.status} ${text}`)
  }
  const data = JSON.parse(text) as { url: string }
  return { url: data.url }
}

/**
 * Verify a Stripe-Signature header against the raw request body. Implements
 * Stripe's v1 signing scheme: `signed = ${timestamp}.${rawBody}`, HMAC-SHA256
 * with the endpoint signing secret, hex-encoded compared to the v1 entry in
 * the header. Replay protection: events older than 5 min are rejected.
 *
 * Returns true on valid, false on every kind of failure (missing pieces,
 * timestamp drift, signature mismatch). Caller responds 401 on false.
 */
export async function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
  toleranceSeconds = 300,
): Promise<boolean> {
  if (!signatureHeader) return false
  const parts: Record<string, string[]> = {}
  for (const item of signatureHeader.split(',')) {
    const eq = item.indexOf('=')
    if (eq < 0) continue
    const k = item.slice(0, eq).trim()
    const v = item.slice(eq + 1).trim()
    if (!parts[k]) parts[k] = []
    parts[k].push(v)
  }
  const ts = parts['t']?.[0]
  const sigs = parts['v1'] ?? []
  if (!ts || sigs.length === 0) return false
  const tsNum = parseInt(ts, 10)
  if (!Number.isFinite(tsNum)) return false
  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - tsNum) > toleranceSeconds) return false

  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signed = `${ts}.${rawBody}`
  const sigBytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(signed)))
  const expectedHex = Array.from(sigBytes, (b) => b.toString(16).padStart(2, '0')).join('')

  // Constant-time compare across all v1 entries (Stripe may include the
  // previous signing-secret's value during rotation; any match passes).
  for (const candidate of sigs) {
    if (candidate.length === expectedHex.length) {
      let diff = 0
      for (let i = 0; i < expectedHex.length; i++) {
        diff |= expectedHex.charCodeAt(i) ^ candidate.charCodeAt(i)
      }
      if (diff === 0) return true
    }
  }
  return false
}

/**
 * Narrow Stripe event shape — we touch only the fields we use. The full
 * Stripe.Event type is hundreds of lines; this is what we need.
 */
export interface StripeEvent {
  id: string
  type: string
  data: {
    object: StripeObject
  }
  created: number
}

export interface StripeObject {
  id: string
  object: string
  // checkout.session fields
  client_reference_id?: string | null
  payment_intent?: string | null
  subscription?: string | null
  customer?: string | null
  amount_total?: number | null
  amount_subtotal?: number | null
  currency?: string | null
  customer_email?: string | null
  customer_details?: { email?: string | null } | null
  metadata?: Record<string, string> | null
  // invoice fields
  amount_paid?: number | null
  status?: string | null
  // charge fields
  amount_refunded?: number | null
  // subscription fields
  current_period_end?: number | null
  cancel_at_period_end?: boolean | null
}
