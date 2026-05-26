// email_outbox sweep — the durable fallback for Resend send failures
// (AUDIT P1.3). Producers (tier-assigned, refund-notice, installment-
// cleared, status-change, visitor-withdrawal) write to `email_outbox`
// when Resend rejects/times out at the moment of send; the sweep retries
// pending rows on every digest tick. Without coverage, a regression that
// stops calling sweepEmailOutbox would silently let durable notices rot
// in the queue forever.
//
// The sweep runs as a piggyback inside POST /api/admin/digest, so we
// drive it through that endpoint (auth wall covered separately in
// digest-cron.spec.ts).
//
// What's covered:
//   - pending row with attempts < MAX → attempts increments, last_attempt
//     set, sent_at stays null (Resend stub returns 401, so delivery fails
//     by design and the sweeper bumps attempts)
//   - exponential backoff: a row with last_attempt right now does NOT
//     get retried this tick (skip-this-iteration branch)
//   - a row at MAX attempts is no longer retried (the WHERE clause
//     excludes attempts >= MAX)
//   - already-delivered rows (sent_at != null) are not touched
//
// What's NOT here:
//   - the "just hit the ceiling → admin alert" branch — that requires
//     a real Resend success path or a bypass we don't have today; the
//     vitest unit test covers it against a mock send
//   - the prune-old-delivered branch — needs a delivered row older than
//     OUTBOX_DELIVERED_TTL_SECONDS (~7 days); not worth seeding past
//     timestamps for a low-blast-radius cleanup

import { test, expect } from '@playwright/test'
import { E2E_BASE_URL, E2E_BINDINGS } from './constants'
import { clearTestRows, readOutboxRow, seedOutboxRow } from './helpers/db'

const DIGEST_TOKEN = E2E_BINDINGS.DIGEST_TOKEN

async function triggerSweep(): Promise<Response> {
  return await fetch(`${E2E_BASE_URL}/api/admin/digest`, {
    method: 'POST',
    headers: { 'X-Digest-Token': DIGEST_TOKEN },
  })
}

test.describe('email_outbox sweep — driven via the digest cron', () => {
  test.beforeEach(() => clearTestRows())

  test('pending row gets attempts++ and last_attempt set (Resend stub fails)', async () => {
    // Resend in the harness returns 401 ("API key is invalid") because
    // RESEND_API_KEY is a stub. The sweep treats that as a delivery
    // failure: attempts increments, last_error is recorded, sent_at stays
    // null. This is exactly the behavior we want a real Resend 5xx to
    // produce.
    const id = seedOutboxRow({
      toEmail: 'recipient@e2e.test',
      kind: 'tier-assigned',
      attempts: 0,
    })

    const res = await triggerSweep()
    expect(res.status).toBe(200)

    const after = readOutboxRow(id)
    expect(after).toBeDefined()
    expect(after?.attempts).toBe(1)
    expect(after?.last_attempt).not.toBeNull()
    expect(after?.sent_at).toBeNull()
    // last_error captures the stub's response so a future Marc can grep
    // for "API key is invalid" and trace it back to a config issue.
    expect(after?.last_error).toBeTruthy()
  })

  test('row whose last_attempt is recent is skipped (exponential backoff)', async () => {
    // attempts=2 means the next retry waits 2^2 = 4 minutes. With
    // last_attempt set to "30s ago" the backoff guard skips this row
    // entirely; attempts stays at 2.
    const id = seedOutboxRow({
      toEmail: 'backoff@e2e.test',
      attempts: 2,
      lastAttempt: Math.floor(Date.now() / 1000) - 30,
    })

    const res = await triggerSweep()
    expect(res.status).toBe(200)

    const after = readOutboxRow(id)
    expect(after?.attempts).toBe(2) // unchanged
    // last_attempt did not move (it would have if a retry had fired).
    expect(after?.last_attempt).toBeLessThanOrEqual(Math.floor(Date.now() / 1000) - 25)
  })

  test('row at MAX attempts is not retried (WHERE attempts < MAX)', async () => {
    // OUTBOX_MAX_ATTEMPTS is 5 in functions/_lib/email.ts. A row at 5 is
    // stuck — the sweep does not touch it. (The "just-hit-ceiling" alert
    // fires only on the sweep that transitions a row from 4 → 5; once
    // it's already there, the row is dormant.)
    const id = seedOutboxRow({
      toEmail: 'capped@e2e.test',
      attempts: 5,
      lastAttempt: Math.floor(Date.now() / 1000) - 2 * 3600,
    })

    const res = await triggerSweep()
    expect(res.status).toBe(200)

    const after = readOutboxRow(id)
    expect(after?.attempts).toBe(5) // still 5
  })

  test('already-delivered row (sent_at != null) is untouched', async () => {
    const id = seedOutboxRow({
      toEmail: 'delivered@e2e.test',
      attempts: 1,
      sentAt: Math.floor(Date.now() / 1000) - 60,
    })

    const res = await triggerSweep()
    expect(res.status).toBe(200)

    const after = readOutboxRow(id)
    // Untouched — sent_at preserved, attempts unchanged.
    expect(after?.sent_at).not.toBeNull()
    expect(after?.attempts).toBe(1)
  })
})
