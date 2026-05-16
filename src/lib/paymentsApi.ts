/**
 * Frontend bindings for /api/payments. Mirrors functions/api/payments/*.
 * Server is the source of truth for these types; if the schema changes,
 * update functions/api/payments/index.ts first, then mirror here.
 */

import { api } from './api'

export type PaymentKind = 'tier1' | 'tier2-deposit' | 'tier2-final' | 'tier3' | 'custodian-sub'
export type PaymentStatus = 'pending' | 'paid' | 'refunded' | 'failed' | 'canceled'
export type CustodianStatus = 'none' | 'active' | 'past_due' | 'canceled' | 'switched_to_tout_a_toi'

export interface PaymentRow {
  id: string
  session_id: string
  kind: PaymentKind
  amount_cents: number
  currency: string
  status: PaymentStatus
  stripe_checkout_session_id: string | null
  stripe_payment_intent_id: string | null
  stripe_subscription_id: string | null
  stripe_invoice_id: string | null
  stripe_customer_id: string | null
  created_at: number
  paid_at: number | null
  refunded_at: number | null
}

export type StripeMode = 'test' | 'live' | 'unset'

export interface PaymentSummary {
  rows: PaymentRow[]
  hasPaidDeposit: boolean
  custodianStatus: CustodianStatus
  /** Which Stripe environment the server is configured against. Visible in the
   * UI as a "TEST MODE" pill so visitors don't mistake sandbox charges for
   * real ones. 'unset' when STRIPE_SECRET_KEY isn't configured (Checkout 503s). */
  stripeMode: StripeMode
}

export function getPaymentSummary(sessionId: string): Promise<PaymentSummary> {
  return api<PaymentSummary>(`/api/payments?sessionId=${encodeURIComponent(sessionId)}`)
}

interface CheckoutResponse {
  url: string
  paymentId: string
}

/**
 * Mint a Checkout session for this session row and redirect the browser to
 * Stripe's hosted page. Returns the response so callers can choose to
 * window.location instead of returning; default is location.assign so the
 * back button takes the visitor back here.
 */
export async function startCheckout(args: {
  sessionId: string
  kind: PaymentKind
  lang?: 'fr' | 'en'
  amountCadOverride?: number
}): Promise<CheckoutResponse> {
  return api<CheckoutResponse>('/api/payments/checkout', {
    method: 'POST',
    body: args,
  })
}

/**
 * Open the Stripe Customer Portal for the visitor's custodian subscription.
 * Throws on 404 (no subscription on this session). Caller redirects to the
 * returned url.
 */
export async function openCustomerPortal(args: {
  sessionId: string
  lang?: 'fr' | 'en'
}): Promise<{ url: string }> {
  return api<{ url: string }>('/api/payments/portal', {
    method: 'POST',
    body: args,
  })
}
