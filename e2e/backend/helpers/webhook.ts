// Synthesize a Stripe webhook event and POST it to /api/payments/webhook
// with a valid HMAC-SHA256 signature. The portal's webhook handler verifies
// every event via verifyWebhookSignature (functions/_lib/stripe.ts) — we
// reproduce the v1 signing scheme here byte-for-byte so the running server
// accepts our synthetic POSTs.
//
// The handler reads event.data.object.{client_reference_id, metadata, …},
// so the event body must mirror what a real Stripe `checkout.session.completed`
// event would carry for our checkout flow. The unit tests in webhook.test.ts
// drive the same shape — keep them in sync if the handler changes.

import { createHmac } from 'node:crypto'
import { E2E_BASE_URL, E2E_BINDINGS } from '../constants'

const SECRET = E2E_BINDINGS.STRIPE_WEBHOOK_SECRET

function sign(rawBody: string, ts: number): string {
  const signedPayload = `${ts}.${rawBody}`
  const sig = createHmac('sha256', SECRET).update(signedPayload).digest('hex')
  return `t=${ts},v1=${sig}`
}

interface CheckoutCompletedEvent {
  paymentId: string
  sessionId: string
  /** Build (default), scoping, or custodian. */
  kind?: 'build' | 'scoping' | 'custodian'
  tier?: number
  installmentIndex?: number
  installmentOf?: number
  lang?: 'fr' | 'en'
  /** Custodian only. */
  custodianPlan?: 'watch' | 'care'
  /** Optional pre-set subscription / customer ids — useful for custodian flows. */
  subscriptionId?: string | null
  customerId?: string | null
}

/**
 * Build a minimally-valid Stripe `checkout.session.completed` event for the
 * given payment. Only the fields the handler actually reads are populated.
 */
export function makeCheckoutCompletedEvent(args: CheckoutCompletedEvent): Record<string, unknown> {
  const kind = args.kind ?? 'build'
  const metadata: Record<string, string> = {
    payment_id: args.paymentId,
    session_id: args.sessionId,
    kind,
    lang: args.lang ?? 'fr',
  }
  if (kind === 'build') {
    metadata.tier = String(args.tier ?? 1)
    metadata.installment_index = String(args.installmentIndex ?? 1)
    metadata.installment_of = String(args.installmentOf ?? 1)
  }
  if (kind === 'custodian' && args.custodianPlan) {
    metadata.custodian_plan = args.custodianPlan
  }
  return {
    id: `evt_e2e_${args.paymentId}_${Date.now()}`,
    type: 'checkout.session.completed',
    data: {
      object: {
        id: `cs_test_e2e_${args.paymentId}`,
        client_reference_id: args.paymentId,
        customer: args.customerId ?? `cus_test_e2e_${args.paymentId}`,
        subscription: args.subscriptionId ?? null,
        payment_intent: kind === 'custodian' ? null : `pi_test_e2e_${args.paymentId}`,
        metadata,
      },
    },
  }
}

/**
 * POST the synthetic event to the running server's webhook endpoint with a
 * valid Stripe-Signature header. Returns the fetch Response so specs can
 * assert on status if needed (the handler returns 200 on every recoverable
 * failure — anything else is signature mismatch or test bug).
 */
export async function deliverWebhook(event: Record<string, unknown>): Promise<Response> {
  const rawBody = JSON.stringify(event)
  const ts = Math.floor(Date.now() / 1000)
  const signature = sign(rawBody, ts)
  return await fetch(`${E2E_BASE_URL}/api/payments/webhook`, {
    method: 'POST',
    headers: {
      'Stripe-Signature': signature,
      'Content-Type': 'application/json',
    },
    body: rawBody,
  })
}
