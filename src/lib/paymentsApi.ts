/**
 * Frontend bindings for /api/payments. Mirrors functions/api/payments/*.
 * Server is the source of truth for these types; if the schema changes,
 * update functions/api/payments/index.ts first, then mirror here.
 */

import { api } from './api'

export type PaymentKind = 'build' | 'scoping' | 'custodian'
export type CustodianPlan = 'watch' | 'care'
export type PaymentStatus = 'pending' | 'paid' | 'refunded' | 'failed' | 'canceled'
export type CustodianStatus = 'none' | 'active' | 'past_due' | 'canceled' | 'switched_to_tout_a_toi'

export interface PaymentRow {
  id: string
  session_id: string
  kind: PaymentKind
  /** build only: 1-4. null for scoping / custodian. */
  tier: number | null
  /** build only: 1-based leg index and total legs. null otherwise. */
  installment_index: number | null
  installment_of: number | null
  /** custodian only: 'watch' | 'care'. null otherwise. */
  custodian_plan: string | null
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
  /** Cumulative refunded cents. 0 = nothing refunded. = amount_cents on full
   * refund (status flips to 'refunded'). Between = partial refund (status
   * stays 'paid' but UI surfaces the partial amount). */
  refunded_amount_cents: number
}

export type StripeMode = 'test' | 'live' | 'unset'

/** Installment summary for the session's build tier — entirely server-computed
 *  (the client never derives an amount). */
export interface BuildSummary {
  tier: number
  /** Total installment legs (0 while a Tier-4 quote is pending). */
  installmentCount: number
  paidCount: number
  /** 1-based index of the next unpaid leg; null = fully paid OR quote pending. */
  nextIndex: number | null
  /** CAD-cent amount for the next leg — scoping credit already applied to
   *  leg 1. null when nextIndex is null. */
  nextAmountCents: number | null
  /** Tier 4 only: classified but not yet quoted by admin. */
  quotePending: boolean
}

export interface PaymentSummary {
  rows: PaymentRow[]
  custodianStatus: CustodianStatus
  /** Which Stripe environment the server is configured against. Visible in the
   * UI as a "TEST MODE" pill so visitors don't mistake sandbox charges for
   * real ones. 'unset' when STRIPE_SECRET_KEY isn't configured (Checkout 503s). */
  stripeMode: StripeMode
  /** Installment plan + next leg. null when the session has no paid tier
   *  (unclassified, or Tier 0). */
  build: BuildSummary | null
  /** Whether a $250 scoping report has been paid on this session. */
  scoping: { paid: boolean }
}

export function getPaymentSummary(sessionId: string): Promise<PaymentSummary> {
  return api<PaymentSummary>(`/api/payments?sessionId=${encodeURIComponent(sessionId)}`)
}

interface CheckoutResponse {
  url: string
  paymentId: string
}

/**
 * Mint a Checkout session and redirect the browser to Stripe's hosted page.
 * For kind 'build' the server derives which installment is owed — the client
 * sends only the kind. For 'custodian', custodianPlan picks Watch or Care.
 */
export async function startCheckout(args: {
  sessionId: string
  kind: PaymentKind
  custodianPlan?: CustodianPlan
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
 * Throws on 404 (no subscription on this session). Caller redirects to the url.
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
