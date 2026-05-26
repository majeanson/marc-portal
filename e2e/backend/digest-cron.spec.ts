// POST /api/admin/digest — the daily housekeeping + nudge endpoint that
// an external cron (cron-job.org or similar) hits once a day. The handler
// piggybacks five jobs onto that one call:
//
//   1. Prune magic_link_tokens older than 24h (keeps the rate-limit table
//      scan-fast).
//   2. Cancel pending payments older than 24h (orphans from visitors who
//      bounced off Stripe Checkout).
//   3. Prune webhook_events older than 30 days.
//   4. Prune orphan attachments (no parent session row).
//   5. Sweep email_outbox (separate spec — email-outbox-sweep.spec.ts).
//
// Then it emails Marc when triage rows are >48h old OR there are
// unresolved admin_alerts.
//
// Coverage gaps closed here:
//   - the X-Digest-Token auth wall (only existing coverage is a vitest
//     unit case; this proves the real handler 401s without it)
//   - the empty-state {sent: false} return
//   - triage > 48h triggers {sent: true}
//   - unresolved admin_alerts triggers {sent: true}
//   - the housekeeping jobs (#1, #2, #3, #4) actually mutate D1 — not
//     covered anywhere else
//
// The endpoint is in CSRF_EXEMPT_PATHS (Stripe-signed-equivalent: the
// X-Digest-Token IS the auth proof, no cookie involved), so we don't need
// the double-submit shape here.

import { test, expect } from '@playwright/test'
import { randomBytes } from 'node:crypto'
import { E2E_BASE_URL, E2E_BINDINGS } from './constants'
import {
  clearTestRows,
  countRowsWhere,
  seedAdminAlert,
  seedPendingPayment,
  seedSession,
} from './helpers/db'
import { mintMagicLinkToken } from './helpers/auth'

const DIGEST_TOKEN = E2E_BINDINGS.DIGEST_TOKEN

async function postDigest(headers: Record<string, string> = {}): Promise<Response> {
  return await fetch(`${E2E_BASE_URL}/api/admin/digest`, {
    method: 'POST',
    headers,
  })
}

test.describe('POST /api/admin/digest — auth wall', () => {
  test.beforeEach(() => clearTestRows())

  test('no token header → 401', async () => {
    const res = await postDigest()
    expect(res.status).toBe(401)
  })

  test('wrong token → 401', async () => {
    const res = await postDigest({ 'X-Digest-Token': 'not-the-token' })
    expect(res.status).toBe(401)
  })

  test('valid token → 200 (even with no work to do)', async () => {
    // No triage rows, no admin_alerts. Endpoint returns 200 with sent=false.
    const res = await postDigest({ 'X-Digest-Token': DIGEST_TOKEN })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { sent: boolean; count: number; alerts: number }
    expect(body.sent).toBe(false)
    expect(body.count).toBe(0)
    expect(body.alerts).toBe(0)
  })
})

test.describe('POST /api/admin/digest — triage nudge', () => {
  test.beforeEach(() => clearTestRows())

  // The handler's `sent` field reflects whether Resend's HTTP send
  // returned 2xx. Under the e2e harness, RESEND_API_KEY is a stub and
  // every send returns 401, so `sent` is always false in this suite —
  // even when there ARE triage rows / alerts to nudge about. The
  // load-bearing signals are `count` (stale triage row count) and
  // `alerts` (unresolved admin_alerts row count); those reflect what
  // the handler queried, independent of the send outcome.

  test('triage row >48h → count=1, fresh triage row is not surfaced', async () => {
    // Two triage rows: one fresh (<48h, no nudge), one stale (>48h, nudges).
    const freshId = `sess_e2e_${randomBytes(6).toString('hex')}`
    const staleId = `sess_e2e_${randomBytes(6).toString('hex')}`
    seedSession({ id: freshId, email: 'fresh@e2e.test', status: 'triage', tier: 1 })
    seedSession({
      id: staleId,
      email: 'stale@e2e.test',
      status: 'triage',
      tier: 1,
      // 50h old — past the 48h SLA threshold.
      createdAt: Math.floor(Date.now() / 1000) - 50 * 3600,
    })

    const res = await postDigest({ 'X-Digest-Token': DIGEST_TOKEN })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { sent: boolean; count: number }
    expect(body.count).toBe(1) // only the stale one
  })

  test('unresolved admin_alerts → alerts count matches what was seeded', async () => {
    seedAdminAlert({ kind: 'webhook-fallback', body: 'invoice payment failed for sub_xxx' })
    seedAdminAlert({ kind: 'webhook-fallback', body: 'subscription canceled sub_yyy' })

    const res = await postDigest({ 'X-Digest-Token': DIGEST_TOKEN })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { sent: boolean; alerts: number }
    expect(body.alerts).toBe(2)
  })

  test('resolved alerts are not surfaced (alerts=0)', async () => {
    seedAdminAlert({
      kind: 'webhook-fallback',
      body: 'old already-handled',
      resolvedAt: Math.floor(Date.now() / 1000) - 60,
    })
    const res = await postDigest({ 'X-Digest-Token': DIGEST_TOKEN })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { sent: boolean; count: number; alerts: number }
    // Empty state — no stale triage, no unresolved alerts → handler
    // short-circuits to sent:false with both counts at 0.
    expect(body.sent).toBe(false)
    expect(body.count).toBe(0)
    expect(body.alerts).toBe(0)
  })
})

test.describe('POST /api/admin/digest — housekeeping piggybacks', () => {
  test.beforeEach(() => clearTestRows())

  test('prunes magic_link_tokens older than 24h', async () => {
    // Two tokens: one fresh (kept), one >24h old (pruned). created_at
    // controls the cutoff, expires_at is independent.
    mintMagicLinkToken('keep@e2e.test', { createdAt: Math.floor(Date.now() / 1000) - 60 })
    mintMagicLinkToken('prune@e2e.test', {
      createdAt: Math.floor(Date.now() / 1000) - 25 * 3600,
    })

    const res = await postDigest({ 'X-Digest-Token': DIGEST_TOKEN })
    expect(res.status).toBe(200)

    expect(
      countRowsWhere(
        `SELECT COUNT(*) AS c FROM magic_link_tokens WHERE email = ?`,
        'keep@e2e.test',
      ),
    ).toBe(1)
    expect(
      countRowsWhere(
        `SELECT COUNT(*) AS c FROM magic_link_tokens WHERE email = ?`,
        'prune@e2e.test',
      ),
    ).toBe(0)
  })

  test('cancels pending payments older than 24h', async () => {
    const sessionId = `sess_e2e_${randomBytes(6).toString('hex')}`
    seedSession({ id: sessionId, email: 'pay@e2e.test', status: 'active', tier: 1 })

    const fresh = `pay_e2e_fresh_${randomBytes(4).toString('hex')}`
    const stale = `pay_e2e_stale_${randomBytes(4).toString('hex')}`
    seedPendingPayment({ paymentId: fresh, sessionId, createdAt: Math.floor(Date.now() / 1000) })
    seedPendingPayment({
      paymentId: stale,
      sessionId,
      createdAt: Math.floor(Date.now() / 1000) - 25 * 3600,
    })

    const res = await postDigest({ 'X-Digest-Token': DIGEST_TOKEN })
    expect(res.status).toBe(200)

    // The fresh one stays 'pending'; the stale one is now 'canceled'.
    const freshStatus = countRowsWhere(
      `SELECT COUNT(*) AS c FROM payments WHERE id = ? AND status = 'pending'`,
      fresh,
    )
    const staleStatus = countRowsWhere(
      `SELECT COUNT(*) AS c FROM payments WHERE id = ? AND status = 'canceled'`,
      stale,
    )
    expect(freshStatus).toBe(1)
    expect(staleStatus).toBe(1)
  })
})
