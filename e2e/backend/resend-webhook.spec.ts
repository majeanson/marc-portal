// POST /api/webhooks/resend — bounce / complaint / unsubscribe events from
// Resend, signed Svix-style. The endpoint activated on prod 8 days ago
// (per project memory: project_resend_webhook_dormant — flipped to active
// after the DNS verification window) but the only existing coverage is the
// vitest unit test against a mock D1. The full middleware → signature
// verify → D1 insert loop has never been exercised end-to-end.
//
// Why that matters: a regression here means bounces stop landing in
// email_events, which means the send-time suppression check
// (functions/_lib/emailSuppression.ts) keeps shipping magic links into a
// dead address. Resend's free tier (100/day) gets drained by retries to
// addresses that already bounced — exactly the failure shape this whole
// webhook was built to prevent.
//
// What's covered:
//   - missing signature headers → 401 ("signature mismatch")
//   - wrong secret signature → 401
//   - stale timestamp (>5 min off) → 401 (replay defense)
//   - valid bounce (Permanent) → 200, email_events row inserted with
//     type='email.bounced' and subtype='permanent'
//   - valid complaint → 200, type='email.complained'
//   - valid delivered → 200, type='email.delivered'
//   - valid email.sent → 200 with ignored:true (informational, no row)
//   - replayed event id → 200 with duplicate:true (idempotent via
//     webhook_events dedupe)
//
// What's NOT here:
//   - the 503 path when RESEND_WEBHOOK_SECRET is unset — the harness
//     always sets it (via E2E_BINDINGS), and unsetting it would require
//     spinning a parallel webServer config. Unit-tested instead.

import { test, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import {
  deliverResendWebhook,
  makeResendBouncedEvent,
  makeResendComplainedEvent,
  makeResendDeliveredEvent,
  makeResendSentEvent,
} from './helpers/resend'
import { clearTestRows, readEmailEvents } from './helpers/db'
import { E2E_BASE_URL } from './constants'

test.describe('POST /api/webhooks/resend — signature gates', () => {
  test.beforeEach(() => clearTestRows())

  test('missing svix headers → 401', async () => {
    const res = await fetch(`${E2E_BASE_URL}/api/webhooks/resend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'email.bounced', data: {} }),
    })
    expect(res.status).toBe(401)
  })

  test('signature signed with the wrong secret → 401', async () => {
    const event = makeResendBouncedEvent({ to: 'bouncer@e2e.test' })
    const res = await deliverResendWebhook(event, {
      badSecret: 'whsec_d3JvbmdfZTJlX3NlY3JldA==', // base64('wrong_e2e_secret')
    })
    expect(res.status).toBe(401)
  })

  test('stale timestamp (>5 min old) → 401 (replay defense)', async () => {
    const event = makeResendBouncedEvent({ to: 'bouncer@e2e.test' })
    const sixMinutesAgo = Math.floor(Date.now() / 1000) - 6 * 60
    const res = await deliverResendWebhook(event, { timestampSeconds: sixMinutesAgo })
    expect(res.status).toBe(401)
  })

  test('future timestamp beyond tolerance → 401 (clock-skew defense)', async () => {
    const event = makeResendBouncedEvent({ to: 'bouncer@e2e.test' })
    const sixMinutesFromNow = Math.floor(Date.now() / 1000) + 6 * 60
    const res = await deliverResendWebhook(event, { timestampSeconds: sixMinutesFromNow })
    expect(res.status).toBe(401)
  })
})

test.describe('POST /api/webhooks/resend — happy-path ingest', () => {
  test.beforeEach(() => clearTestRows())

  test('valid Permanent bounce → 200, email_events row with subtype=permanent', async () => {
    const to = `bouncer-${randomUUID().slice(0, 6)}@e2e.test`
    const event = makeResendBouncedEvent({ to, bounceType: 'Permanent' })
    const res = await deliverResendWebhook(event)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { received: boolean; persisted: boolean; type: string }
    expect(body.received).toBe(true)
    expect(body.persisted).toBe(true)
    expect(body.type).toBe('email.bounced')

    const rows = readEmailEvents(to)
    expect(rows).toHaveLength(1)
    expect(rows[0].type).toBe('email.bounced')
    // extractSubtype lowercases — 'Permanent' → 'permanent' so the
    // suppression check can column-key on it.
    expect(rows[0].subtype).toBe('permanent')
  })

  test('valid Transient bounce → 200, subtype=transient', async () => {
    const to = `transient-${randomUUID().slice(0, 6)}@e2e.test`
    const event = makeResendBouncedEvent({ to, bounceType: 'Transient' })
    const res = await deliverResendWebhook(event)
    expect(res.status).toBe(200)

    const rows = readEmailEvents(to)
    expect(rows[0].subtype).toBe('transient')
  })

  test('valid complaint → 200, type=email.complained', async () => {
    const to = `complainer-${randomUUID().slice(0, 6)}@e2e.test`
    const event = makeResendComplainedEvent({ to })
    const res = await deliverResendWebhook(event)
    expect(res.status).toBe(200)

    const rows = readEmailEvents(to)
    expect(rows).toHaveLength(1)
    expect(rows[0].type).toBe('email.complained')
  })

  test('valid delivered event → 200, row inserted (low-cost telemetry)', async () => {
    const to = `delivered-${randomUUID().slice(0, 6)}@e2e.test`
    const event = makeResendDeliveredEvent({ to })
    const res = await deliverResendWebhook(event)
    expect(res.status).toBe(200)

    const rows = readEmailEvents(to)
    expect(rows).toHaveLength(1)
    expect(rows[0].type).toBe('email.delivered')
  })

  test('email.sent → 200 with ignored:true, NO email_events row', async () => {
    // email.sent is informational (mirror of our own outbound send log) —
    // the handler's INGEST_TYPES whitelist deliberately omits it. We still
    // dedupe via webhook_events, so a 200 is correct; we just don't bloat
    // email_events with one row per outgoing magic link.
    const to = `sent-${randomUUID().slice(0, 6)}@e2e.test`
    const event = makeResendSentEvent({ to })
    const res = await deliverResendWebhook(event)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { received: boolean; ignored: boolean }
    expect(body.received).toBe(true)
    expect(body.ignored).toBe(true)

    expect(readEmailEvents(to)).toHaveLength(0)
  })

  test('replayed event id → 200 with duplicate:true (idempotent dedupe)', async () => {
    const to = `dupe-${randomUUID().slice(0, 6)}@e2e.test`
    const event = makeResendBouncedEvent({ to })
    const dupeId = `msg_${randomUUID()}`

    const first = await deliverResendWebhook(event, { id: dupeId })
    expect(first.status).toBe(200)

    const replay = await deliverResendWebhook(event, { id: dupeId })
    expect(replay.status).toBe(200)
    const body = (await replay.json()) as { duplicate: boolean }
    expect(body.duplicate).toBe(true)

    // Only one row in email_events — the dedupe sat ahead of the insert.
    expect(readEmailEvents(to)).toHaveLength(1)
  })
})
