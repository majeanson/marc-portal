// Stripe REST + Web Crypto. No SDK — the @stripe/stripe-node package is Node-
// shaped (https module, EventEmitter) and works on Workers only via shims that
// bloat the bundle. Stripe's REST API is form-urlencoded, paginated by cursor,
// and stable enough that the surface we use here is ~80 lines.
//
// What's here:
//   - createOneTimeCheckoutSession()         — Tier 1 / Tier 2 deposit / etc.
//   - createSubscriptionCheckoutSession()    — Custodian (Watch $120/yr · Care $400/yr)
//   - createBillingPortalSession()           — Customer Portal link for sub mgmt
//   - verifyWebhookSignature()               — Stripe-Signature header check
//
// Nothing here writes to D1; callers do. Nothing here decides authorization;
// callers do. Pure stripe-side IO + crypto.

const STRIPE_API = 'https://api.stripe.com/v1'

// Stripe-Version pin — keep behavior stable across API rollouts. Bump
// intentionally with a code change, not silently. Last reviewed 2026-05-23
// against the changelog; next review by 2027-05-23 or when we touch a
// Stripe-shape thing (new event type, new line-item field). 2025-09-30.clover
// made flexible billing mode the default for new subscriptions —
// transparent for our annual fixed-price custodian use. One constant so
// the pin can't drift between postCheckoutSession + createBillingPortalSession.
const STRIPE_API_VERSION = '2026-04-22.dahlia'

// A payment is one of three kinds. For 'build', the tier (1-4) and the
// installment leg are carried in their own columns + Stripe metadata rather
// than fused into this string — see 0022_pricing_v2.sql.
export type PaymentKind = 'build' | 'scoping' | 'custodian'
export type CustodianPlan = 'watch' | 'care'

export interface CheckoutSessionResult {
  id: string // cs_test_... / cs_live_...
  url: string // the URL we redirect the visitor to
}

interface OneTimeOpts {
  apiKey: string
  amountCents: number
  /** Line-item label shown on the customer's receipt + the Stripe Dashboard.
   *  Built by the caller; truncated to Stripe's 80-char limit here. */
  label: string
  /** Payment row id we minted on our side. Passed as client_reference_id so
   *  the webhook can locate it without scanning. */
  paymentId: string
  visitorEmail: string
  successUrl: string
  cancelUrl: string
  lang: 'fr' | 'en'
  /** Metadata mirrored onto the Checkout session AND the resulting
   *  PaymentIntent — the webhook reads whichever shape it gets. The caller
   *  decides the keys (payment_id, session_id, kind, tier, installment_*,
   *  lang, …). */
  meta: Record<string, string>
}

// Magic API key recognised by the e2e harness. When the runtime is configured
// with this value (via .dev.vars.e2e), the checkout endpoint short-circuits
// Stripe entirely and returns a deterministic stub URL the harness then
// intercepts. Production never sees this value — sk_test_e2e_stub is not a
// valid Stripe key shape, so it cannot accidentally leak past the test
// fixtures into a live deployment.
const E2E_STUB_API_KEY = 'sk_test_e2e_stub'

function makeStubCheckoutResult(paymentId: string): CheckoutSessionResult {
  return {
    id: `cs_test_e2e_${paymentId}`,
    url: `https://e2e-stub.local/checkout/${paymentId}`,
  }
}

export async function createOneTimeCheckoutSession(
  opts: OneTimeOpts,
): Promise<CheckoutSessionResult> {
  if (opts.apiKey === E2E_STUB_API_KEY) return makeStubCheckoutResult(opts.paymentId)
  const form = new URLSearchParams()
  form.set('mode', 'payment')
  // Stripe Checkout supports `fr-CA` but NOT `en-CA` — generic `en` is the
  // only Canadian-English option. Verified against Stripe API reference.
  form.set('locale', opts.lang === 'fr' ? 'fr-CA' : 'en')
  form.set('customer_email', opts.visitorEmail)
  form.set('client_reference_id', opts.paymentId)
  form.set('success_url', opts.successUrl)
  form.set('cancel_url', opts.cancelUrl)
  form.set('line_items[0][price_data][currency]', 'cad')
  form.set('line_items[0][price_data][product_data][name]', opts.label.slice(0, 80))
  form.set('line_items[0][price_data][unit_amount]', String(opts.amountCents))
  form.set('line_items[0][quantity]', '1')
  // Metadata travels with both the Checkout session AND the resulting
  // PaymentIntent — the webhook reads it from either shape.
  for (const [k, v] of Object.entries(opts.meta)) {
    form.set(`metadata[${k}]`, v)
    form.set(`payment_intent_data[metadata][${k}]`, v)
  }

  return await postCheckoutSession(opts.apiKey, form, `checkout-${opts.paymentId}`)
}

interface SubOpts {
  apiKey: string
  priceId: string // price_xxx from Stripe Dashboard
  paymentId: string
  visitorEmail: string
  successUrl: string
  cancelUrl: string
  lang: 'fr' | 'en'
  /** Metadata mirrored onto the Checkout session AND the subscription —
   *  renewal webhook events carry the subscription's metadata, not the
   *  original Checkout's. */
  meta: Record<string, string>
}

export async function createSubscriptionCheckoutSession(
  opts: SubOpts,
): Promise<CheckoutSessionResult> {
  if (opts.apiKey === E2E_STUB_API_KEY) return makeStubCheckoutResult(opts.paymentId)
  const form = new URLSearchParams()
  form.set('mode', 'subscription')
  form.set('locale', opts.lang === 'fr' ? 'fr-CA' : 'en')
  form.set('customer_email', opts.visitorEmail)
  form.set('client_reference_id', opts.paymentId)
  form.set('success_url', opts.successUrl)
  form.set('cancel_url', opts.cancelUrl)
  form.set('line_items[0][price]', opts.priceId)
  form.set('line_items[0][quantity]', '1')
  for (const [k, v] of Object.entries(opts.meta)) {
    form.set(`metadata[${k}]`, v)
    form.set(`subscription_data[metadata][${k}]`, v)
  }

  return await postCheckoutSession(opts.apiKey, form, `checkout-${opts.paymentId}`)
}

async function postCheckoutSession(
  apiKey: string,
  form: URLSearchParams,
  idempotencyKey?: string,
): Promise<CheckoutSessionResult> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/x-www-form-urlencoded',
    'Stripe-Version': STRIPE_API_VERSION,
  }
  // Stripe Idempotency-Key: a repeated POST with the same key returns the
  // original response (Checkout session id + url) instead of creating a new
  // session. Closes the slow-network double-click hole — visitor's browser
  // shows the same Checkout URL on retry, no orphan `pending` payment row.
  // Key derived from our paymentId, which is already unique per click.
  if (idempotencyKey) {
    headers['Idempotency-Key'] = idempotencyKey
  }
  const res = await fetch(`${STRIPE_API}/checkout/sessions`, {
    method: 'POST',
    headers,
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
      'Stripe-Version': STRIPE_API_VERSION,
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

export interface StripeSubscriptionSummary {
  id: string // sub_...
  status: string // active | past_due | canceled | …
  current_period_end: number | null // unix seconds; renewal boundary
  customer: string | null // cus_...
}

/**
 * List Stripe subscriptions in `active` status, cursor-paginated. Read-only —
 * the custodian reconciliation cross-checks this against our own
 * `custodian_status` to catch a billing webhook we never received (Stripe
 * delivery failure or our endpoint being down): a lapsed sub we still show
 * active, or a recovered sub we still show past_due. Never writes; the caller
 * decides what to do with the drift.
 *
 * Stub-aware: the e2e sentinel key returns an empty list so the harness never
 * reaches the live API.
 */
export async function listActiveSubscriptions(
  apiKey: string,
): Promise<StripeSubscriptionSummary[]> {
  if (apiKey === E2E_STUB_API_KEY) return []
  const out: StripeSubscriptionSummary[] = []
  let startingAfter: string | undefined
  // Cursor-paginate. The page cap is a runaway guard (100/page × 20 = 2000
  // active subs), far past this practice's scale — if it ever trips, the
  // reconciliation under-reports rather than looping forever.
  for (let page = 0; page < 20; page++) {
    const qs = new URLSearchParams({ status: 'active', limit: '100' })
    if (startingAfter) qs.set('starting_after', startingAfter)
    const res = await fetch(`${STRIPE_API}/subscriptions?${qs.toString()}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Stripe-Version': STRIPE_API_VERSION,
      },
    })
    const text = await res.text()
    if (!res.ok) {
      throw new Error(`stripe subscriptions list failed: ${res.status} ${text}`)
    }
    const data = JSON.parse(text) as {
      data: Array<{
        id: string
        status: string
        current_period_end?: number | null
        customer?: string | null
      }>
      has_more?: boolean
    }
    for (const s of data.data) {
      out.push({
        id: s.id,
        status: s.status,
        current_period_end: s.current_period_end ?? null,
        customer: typeof s.customer === 'string' ? s.customer : null,
      })
    }
    const last = data.data[data.data.length - 1]
    if (!data.has_more || !last) break
    startingAfter = last.id
  }
  return out
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
