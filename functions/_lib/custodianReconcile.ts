// Custodian-subscription reconciliation (AUDIT / prod-readiness gap #10).
//
// The payment webhook keeps sessions.custodian_status in lockstep with Stripe
// in real time. But a webhook can be MISSED — Stripe delivery fails, or our
// endpoint is briefly down during a deploy — and then our record drifts from
// the truth Stripe holds. This module catches that drift by listing the
// subscriptions Stripe currently reports active and comparing against our own
// custodian rows.
//
// Alert-only by design. Auto-flipping custodian_status here would race the
// webhook (which may deliver the same event moments later) and could silently
// move a paying/lapsed visitor between states without a human glance. Instead
// we write one admin_alerts row describing the discrepancy; Marc reconciles in
// the Stripe Dashboard and resolves the alert. Matches the manual-review shape
// used for refunds.
//
// Runs from the daily digest cron (piggyback housekeeping) — no new auth
// surface, no new schedule to register. A handful of Stripe API calls per day
// at this practice's volume.

import type { Env } from './env'
import { randomTokenB64url } from './bytes'
import { listActiveSubscriptions } from './stripe'

export interface CustodianDbRow {
  id: string // session id
  custodian_subscription_id: string
  custodian_status: string | null
}

export type CustodianDriftKind = 'db_active_not_in_stripe' | 'db_past_due_active_in_stripe'

export interface CustodianDrift {
  sessionId: string
  subscriptionId: string
  dbStatus: string
  kind: CustodianDriftKind
  detail: string
}

/**
 * Compare our custodian rows against the set of subscription ids Stripe reports
 * active. Pure: the IO wrapper supplies both sides. Detects the two drift
 * directions a missed webhook produces:
 *
 *   - db_active_not_in_stripe — we show custodian active, but the sub isn't in
 *     Stripe's active set. We missed a cancellation/lapse; MRR is over-counted
 *     and a visitor who stopped paying is still in custodian mode.
 *   - db_past_due_active_in_stripe — we show past_due, but Stripe has the sub
 *     active again. We missed the invoice.paid after a retry; a paying visitor
 *     is stuck behind a past_due banner.
 *
 * Terminal states (canceled, switched_to_tout_a_toi) and rows without a
 * subscription id are skipped — the caller's query already narrows to
 * active/past_due, but we guard here too so the function is correct standalone.
 */
export function computeCustodianDrift(
  rows: CustodianDbRow[],
  activeSubIds: Set<string>,
): CustodianDrift[] {
  const drift: CustodianDrift[] = []
  for (const r of rows) {
    if (!r.custodian_subscription_id) continue
    const inStripe = activeSubIds.has(r.custodian_subscription_id)
    if (r.custodian_status === 'active' && !inStripe) {
      drift.push({
        sessionId: r.id,
        subscriptionId: r.custodian_subscription_id,
        dbStatus: 'active',
        kind: 'db_active_not_in_stripe',
        detail: `Session ${r.id}: we show custodian active, but Stripe has no active subscription ${r.custodian_subscription_id} (missed cancellation or lapse?).`,
      })
    } else if (r.custodian_status === 'past_due' && inStripe) {
      drift.push({
        sessionId: r.id,
        subscriptionId: r.custodian_subscription_id,
        dbStatus: 'past_due',
        kind: 'db_past_due_active_in_stripe',
        detail: `Session ${r.id}: we show custodian past_due, but Stripe has subscription ${r.custodian_subscription_id} active (missed invoice.paid?).`,
      })
    }
  }
  return drift
}

export interface ReconcileResult {
  /** Set when STRIPE_SECRET_KEY is unconfigured — reconciliation is a no-op,
   *  same graceful-degrade shape as every other optional-binding feature. */
  skipped?: 'no_stripe_key'
  checked: number // custodian rows compared
  activeInStripe: number // subs Stripe reported active
  drift: CustodianDrift[]
  alerted: boolean // whether a fresh admin_alerts row was written this run
}

/**
 * Run the reconciliation: fetch active subs from Stripe, compare against our
 * active/past_due custodian rows, and write a single admin_alerts row when
 * there's drift and no open one already (so a persisting discrepancy doesn't
 * pile a fresh alert on every daily run).
 */
export async function reconcileCustodians(env: Env): Promise<ReconcileResult> {
  if (!env.STRIPE_SECRET_KEY) {
    return { skipped: 'no_stripe_key', checked: 0, activeInStripe: 0, drift: [], alerted: false }
  }

  const subs = await listActiveSubscriptions(env.STRIPE_SECRET_KEY)
  const activeIds = new Set(subs.map((s) => s.id))

  const res = await env.DB.prepare(
    `SELECT id, custodian_subscription_id, custodian_status
       FROM sessions
      WHERE custodian_subscription_id IS NOT NULL
        AND custodian_status IN ('active', 'past_due')
        AND deleted_at IS NULL`,
  ).all<CustodianDbRow>()
  const rows = res.results ?? []

  const drift = computeCustodianDrift(rows, activeIds)
  let alerted = false

  if (drift.length > 0) {
    // One open alert at a time: while the same drift persists, a daily cron
    // would otherwise stack an identical row every 24h. Resolving the alert
    // (after reconciling in Stripe) lets the next run surface fresh drift.
    const existing = await env.DB.prepare(
      `SELECT id FROM admin_alerts WHERE kind = 'custodian-reconcile' AND resolved_at IS NULL LIMIT 1`,
    ).first<{ id: string }>()
    if (!existing) {
      const body = `Custodian reconciliation found ${drift.length} discrepanc${
        drift.length === 1 ? 'y' : 'ies'
      } between our records and Stripe:\n\n${drift
        .map((d) => `• ${d.detail}`)
        .join(
          '\n',
        )}\n\nReview each in the Stripe Dashboard, fix the affected session, then resolve this alert.`
      const id = `alrt_${randomTokenB64url(10)}`
      const now = Math.floor(Date.now() / 1000)
      await env.DB.prepare(
        `INSERT INTO admin_alerts (id, kind, body, created_at) VALUES (?, 'custodian-reconcile', ?, ?)`,
      )
        .bind(id, body, now)
        .run()
      alerted = true
    }
  }

  return { checked: rows.length, activeInStripe: subs.length, drift, alerted }
}
