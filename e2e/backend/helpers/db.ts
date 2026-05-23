// Direct SQLite access to the local D1 file Miniflare writes under
// .wrangler-e2e/v3/d1/miniflare-D1DatabaseObject/<hash>.sqlite. Uses the
// experimental node:sqlite module shipped with Node 22+ — no native build
// step, no new devDep, no @emnapi platform-lockfile drama.
//
// Two access modes are normally needed:
//   1. Test setup writes a seed row (sessions, user_prefs, …) before the
//      spec drives the browser.
//   2. Test assertions read a row to confirm the loop closed (a payments
//      row arrived at status='paid' after the synthetic webhook).
//
// SQLite is in WAL mode here, so a writer outside Miniflare AND Miniflare's
// reader coexist correctly. Writes commit immediately; the wrangler-side
// reader sees them on next query.

import { readdirSync } from 'node:fs'
import { resolve } from 'node:path'
// @ts-expect-error — node:sqlite is experimental; types not yet shipped.
import { DatabaseSync } from 'node:sqlite'
import { E2E_PERSIST_DIR } from '../constants'

const D1_SUBPATH = 'v3/d1/miniflare-D1DatabaseObject'

/**
 * Resolve the absolute path to the Miniflare-managed D1 SQLite file. The
 * filename is a content-hash chosen by Miniflare — we glob the directory
 * rather than hardcode it, because the hash changes if the binding name
 * or db name ever changes in wrangler.toml.
 */
export function resolveD1Path(): string {
  const dir = resolve(E2E_PERSIST_DIR, D1_SUBPATH)
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch (err) {
    throw new Error(
      `e2e: D1 SQLite dir not found at ${dir} — did you run \`npm run e2e:backend:setup\` first? (${(err as Error).message})`,
    )
  }
  // Skip Miniflare's bookkeeping file (metadata.sqlite) — the real D1 file
  // is the hash-named one alongside it.
  const sqlite = entries.find((name) => name.endsWith('.sqlite') && name !== 'metadata.sqlite')
  if (!sqlite) {
    throw new Error(`e2e: no .sqlite file under ${dir} — migrations may have failed silently`)
  }
  return resolve(dir, sqlite)
}

/**
 * Open a fresh DatabaseSync handle. Callers should close() when done — the
 * handle holds an OS-level file descriptor.
 */
export function openD1(): InstanceType<typeof DatabaseSync> {
  return new DatabaseSync(resolveD1Path())
}

interface SeedSessionOpts {
  id: string
  email: string
  /** 0 (Tier 0 free) through 4. Default 1 — Phase 1 spec's case. */
  tier?: number
  /** Session lifecycle status. Default 'active' (post-triage). */
  status?: 'draft' | 'triage' | 'active' | 'shipped' | 'rejected'
  /** Stored as the JSON column. Default '{}'. */
  intakeJson?: string
  /** Optional showcase title — surfaces in payment line-item labels. */
  showcaseTitle?: string | null
  /** Tier 4 only: persisted admin quote in CAD cents. NULL = unquoted (the
   *  default), which forces checkout.ts to return 409 'tier 4 not quoted yet'
   *  unless an admin override is supplied. */
  tier4AmountCents?: number | null
  /** Tier 3 only: installment split '50-50' (2 legs) or '40-40-20' (3 legs).
   *  NULL defaults to '50-50' on the server side. */
  tier3Split?: '50-50' | '40-40-20' | null
  /** Soft-delete marker (unix seconds). Set to drive the deleted_at-aware
   *  404 path in checkout.ts. */
  deletedAt?: number | null
  /** Cached custodian subscription id — set this when the spec needs the
   *  webhook handlers (renewal, deletion) to find this row via
   *  custodian_subscription_id. */
  custodianSubscriptionId?: string | null
  /** Custodian state. Default 'none'; specs that test renewal/cancel
   *  override to 'active' so transitions are observable. */
  custodianStatus?: 'none' | 'active' | 'past_due' | 'canceled' | 'switched_to_tout_a_toi' | null
}

/**
 * Insert a minimal session row plus the columns later migrations add. Any
 * column not exposed here keeps its schema default — see the migrations
 * under functions/db/migrations/ for the canonical list.
 */
export function seedSession(opts: SeedSessionOpts): void {
  const now = Math.floor(Date.now() / 1000)
  // Base columns are always written; the later-migration columns
  // (tier4_amount_cents, tier3_split) only appear when the caller asks —
  // keeps the SQL stable for the common Tier-1 case and avoids surfacing
  // those columns to specs that don't care.
  const cols = [
    'id',
    'email',
    'intake_json',
    'status',
    'tier',
    'showcase_title',
    'created_at',
    'updated_at',
  ]
  const vals: unknown[] = [
    opts.id,
    opts.email.toLowerCase(),
    opts.intakeJson ?? '{}',
    opts.status ?? 'active',
    opts.tier ?? 1,
    opts.showcaseTitle ?? null,
    now,
    now,
  ]
  if (opts.tier4AmountCents != null) {
    cols.push('tier4_amount_cents')
    vals.push(opts.tier4AmountCents)
  }
  if (opts.tier3Split != null) {
    cols.push('tier3_split')
    vals.push(opts.tier3Split)
  }
  if (opts.deletedAt != null) {
    cols.push('deleted_at')
    vals.push(opts.deletedAt)
  }
  if (opts.custodianSubscriptionId != null) {
    cols.push('custodian_subscription_id')
    vals.push(opts.custodianSubscriptionId)
  }
  if (opts.custodianStatus != null) {
    cols.push('custodian_status')
    vals.push(opts.custodianStatus)
  }
  const db = openD1()
  try {
    const placeholders = cols.map(() => '?').join(', ')
    db.prepare(`INSERT INTO sessions (${cols.join(', ')}) VALUES (${placeholders})`).run(...vals)
  } finally {
    db.close()
  }
}

interface SeedPendingPaymentOpts {
  paymentId: string
  sessionId: string
  kind?: 'build' | 'scoping' | 'custodian'
  tier?: number | null
  installmentIndex?: number | null
  installmentOf?: number | null
  amountCents?: number
}

/**
 * Insert a pending payments row directly, skipping the checkout endpoint. Used
 * by negative-space specs that want to drive the webhook in isolation (e.g.
 * reject a bad signature without first paying the checkout-mint price). The
 * shape mirrors checkout.ts's insertPending() so a row produced here is
 * indistinguishable from one minted through the real flow.
 */
export function seedPendingPayment(opts: SeedPendingPaymentOpts): void {
  const now = Math.floor(Date.now() / 1000)
  const db = openD1()
  try {
    db.prepare(
      `INSERT INTO payments
         (id, session_id, kind, tier, installment_index, installment_of,
          amount_cents, currency, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'cad', 'pending', ?)`,
    ).run(
      opts.paymentId,
      opts.sessionId,
      opts.kind ?? 'build',
      opts.tier ?? 1,
      opts.installmentIndex ?? 1,
      opts.installmentOf ?? 1,
      opts.amountCents ?? 75_000,
      now,
    )
  } finally {
    db.close()
  }
}

/**
 * Returns the row count in webhook_events for a given event_id. Used to assert
 * dedupe behavior (0 = signature rejected before insert; 1 = recorded once).
 */
export function countWebhookEvents(eventId: string): number {
  const db = openD1()
  try {
    const row = db
      .prepare(`SELECT COUNT(*) AS c FROM webhook_events WHERE event_id = ?`)
      .get(eventId) as { c: number } | undefined
    return row?.c ?? 0
  } finally {
    db.close()
  }
}

/**
 * Count pending build-payment rows for a session. Used by the concurrent-
 * checkout spec to assert "two clicks, two rows" before any webhook fires.
 */
export function countPendingBuildPayments(sessionId: string): number {
  const db = openD1()
  try {
    const row = db
      .prepare(
        `SELECT COUNT(*) AS c FROM payments
          WHERE session_id = ? AND kind = 'build' AND status = 'pending'`,
      )
      .get(sessionId) as { c: number } | undefined
    return row?.c ?? 0
  } finally {
    db.close()
  }
}

/**
 * Returns the row currently in the payments table for a given paymentId, or
 * undefined if none. Used by assertions to confirm webhook → DB landed.
 */
export interface PaymentRow {
  id: string
  session_id: string
  kind: string
  status: string
  amount_cents: number
  paid_at: number | null
  refunded_at: number | null
  refunded_amount_cents: number
  installment_index: number | null
  installment_of: number | null
  custodian_plan: string | null
  stripe_checkout_session_id: string | null
  stripe_payment_intent_id: string | null
  stripe_subscription_id: string | null
  stripe_invoice_id: string | null
  stripe_customer_id: string | null
}

const PAYMENT_COLS = `id, session_id, kind, status, amount_cents, paid_at,
                refunded_at, refunded_amount_cents,
                installment_index, installment_of, custodian_plan,
                stripe_checkout_session_id, stripe_payment_intent_id,
                stripe_subscription_id, stripe_invoice_id, stripe_customer_id`

export function readPayment(paymentId: string): PaymentRow | undefined {
  const db = openD1()
  try {
    return db.prepare(`SELECT ${PAYMENT_COLS} FROM payments WHERE id = ?`).get(paymentId) as
      | PaymentRow
      | undefined
  } finally {
    db.close()
  }
}

/**
 * Look up the payments row by Stripe PaymentIntent id. Used by the refund
 * spec to confirm charge.refunded landed on the right row (the handler does
 * the same lookup; this mirrors it).
 */
export function readPaymentByIntentId(paymentIntentId: string): PaymentRow | undefined {
  const db = openD1()
  try {
    return db
      .prepare(`SELECT ${PAYMENT_COLS} FROM payments WHERE stripe_payment_intent_id = ? LIMIT 1`)
      .get(paymentIntentId) as PaymentRow | undefined
  } finally {
    db.close()
  }
}

/**
 * Find the payments row Stripe attached to a given invoice id. Used by the
 * custodian-lifecycle spec to distinguish the initial-invoice row (attached
 * to the existing checkout row) from a renewal row (a freshly inserted row
 * keyed on the renewal invoice).
 */
export function readPaymentByInvoiceId(invoiceId: string): PaymentRow | undefined {
  const db = openD1()
  try {
    return db
      .prepare(`SELECT ${PAYMENT_COLS} FROM payments WHERE stripe_invoice_id = ? LIMIT 1`)
      .get(invoiceId) as PaymentRow | undefined
  } finally {
    db.close()
  }
}

/**
 * Read a single session row. Used by custodian + handoff specs to confirm
 * status transitions land in D1 (active → past_due → switched_to_tout_a_toi).
 */
export interface SessionStateRow {
  id: string
  custodian_status: string | null
  custodian_plan: string | null
  custodian_subscription_id: string | null
}
export function readSessionState(sessionId: string): SessionStateRow | undefined {
  const db = openD1()
  try {
    return db
      .prepare(
        `SELECT id, custodian_status, custodian_plan, custodian_subscription_id
           FROM sessions WHERE id = ?`,
      )
      .get(sessionId) as SessionStateRow | undefined
  } finally {
    db.close()
  }
}

/**
 * Count admin_alerts rows whose body matches a substring. The admin_alerts
 * fallback spec uses this to confirm a Resend failure surfaced a row.
 */
export function countAdminAlertsContaining(bodySubstr: string): number {
  const db = openD1()
  try {
    const row = db
      .prepare(`SELECT COUNT(*) AS c FROM admin_alerts WHERE body LIKE ?`)
      .get(`%${bodySubstr}%`) as { c: number } | undefined
    return row?.c ?? 0
  } finally {
    db.close()
  }
}

/**
 * Best-effort wipe between tests — keeps the schema, drops the data. Useful
 * when a spec runs multiple sub-cases on the same db file. admin_alerts is
 * scoped per-test now that the fallback spec lands rows there.
 */
export function clearTestRows(): void {
  const db = openD1()
  try {
    db.exec(
      `DELETE FROM payments;
       DELETE FROM webhook_events;
       DELETE FROM admin_alerts;
       DELETE FROM sessions;`,
    )
  } finally {
    db.close()
  }
}
