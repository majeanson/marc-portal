/**
 * Outbox tests for the send-failure persistence path (AUDIT P1.3). The
 * send() core writes to email_outbox when Resend fails AND a durable
 * context is provided. sweepEmailOutbox retries pending rows with
 * exponential backoff and respects the OUTBOX_MAX_ATTEMPTS ceiling.
 *
 * Resend itself is mocked at the fetch layer — no real network call.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { D1Database } from '@cloudflare/workers-types'
import { D1Mock } from '../../tests/d1-mock'
import {
  OUTBOX_MAX_ATTEMPTS,
  sendRefundNotice,
  sendTierAssignedNotification,
  sweepEmailOutbox,
} from './email'

function mockResend(status: number, body: string) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(body, { status })),
  )
}

beforeEach(() => {
  vi.unstubAllGlobals()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('send-failure outbox — writer', () => {
  it('does NOT write to outbox when Resend succeeds', async () => {
    mockResend(200, JSON.stringify({ id: 'em_ok' }))
    const db = new D1Mock()
    const ok = await sendRefundNotice(
      'rk_test',
      'v@x.com',
      30_000,
      60_000,
      'https://marcportal.com',
      'fr',
      db as unknown as D1Database,
    )
    expect(ok).toBe(true)
    expect(db.email_outbox.size).toBe(0)
  })

  it('writes the rendered email to outbox when Resend returns 5xx', async () => {
    mockResend(502, 'bad gateway')
    const db = new D1Mock()
    const ok = await sendRefundNotice(
      'rk_test',
      'v@x.com',
      30_000,
      60_000,
      'https://marcportal.com',
      'fr',
      db as unknown as D1Database,
    )
    expect(ok).toBe(false)
    expect(db.email_outbox.size).toBe(1)
    const row = [...db.email_outbox.values()][0]!
    expect(row.to_email).toBe('v@x.com')
    expect(row.kind).toBe('refund-notice')
    expect(row.attempts).toBe(1)
    expect(row.sent_at).toBeNull()
    expect(row.last_error).toMatch(/502/)
    // The rendered HTML carries the localized headline.
    expect(row.html).toContain('remboursement')
  })

  it('does NOT write to outbox when no durable context is provided', async () => {
    mockResend(502, 'bad gateway')
    const db = new D1Mock()
    // No outboxDb argument — non-durable call.
    const ok = await sendRefundNotice(
      'rk_test',
      'v@x.com',
      30_000,
      60_000,
      'https://marcportal.com',
      'fr',
    )
    expect(ok).toBe(false)
    expect(db.email_outbox.size).toBe(0)
  })

  it('writes a tier-assigned row when tier-assigned send fails', async () => {
    mockResend(503, 'unavailable')
    const db = new D1Mock()
    await sendTierAssignedNotification(
      'rk_test',
      'v@x.com',
      's1',
      2,
      180_000,
      'https://marcportal.com',
      'en',
      false,
      db as unknown as D1Database,
    )
    const rows = [...db.email_outbox.values()]
    expect(rows).toHaveLength(1)
    expect(rows[0]?.kind).toBe('tier-assigned')
  })
})

describe('sweepEmailOutbox — sweeper', () => {
  it('retries pending rows and marks delivered ones sent_at', async () => {
    mockResend(200, JSON.stringify({ id: 'em_ok' }))
    const db = new D1Mock()
    db.email_outbox.set('eob_1', {
      id: 'eob_1',
      to_email: 'v@x.com',
      subject: 'subject',
      html: '<p>hi</p>',
      text_body: 'hi',
      kind: 'refund-notice',
      created_at: 100,
      attempts: 1,
      // Make the row eligible right now (last_attempt was a while ago).
      last_attempt: 100,
      last_error: '502: bad gateway',
      sent_at: null,
    })
    const out = await sweepEmailOutbox('rk_test', db as unknown as D1Database, 99_999)
    expect(out).toEqual({ retried: 1, delivered: 1, failed: 0 })
    expect(db.email_outbox.get('eob_1')?.sent_at).toBe(99_999)
  })

  it('bumps attempts + last_error when Resend still 5xx', async () => {
    mockResend(500, 'oops')
    const db = new D1Mock()
    db.email_outbox.set('eob_1', {
      id: 'eob_1',
      to_email: 'v@x.com',
      subject: 's',
      html: '',
      text_body: '',
      kind: 'refund-notice',
      created_at: 100,
      attempts: 1,
      last_attempt: 100,
      last_error: 'prior',
      sent_at: null,
    })
    await sweepEmailOutbox('rk_test', db as unknown as D1Database, 99_999)
    const r = db.email_outbox.get('eob_1')!
    expect(r.attempts).toBe(2)
    expect(r.sent_at).toBeNull()
    expect(r.last_error).toMatch(/500/)
  })

  it('respects exponential backoff (skips rows attempted too recently)', async () => {
    mockResend(200, '{}')
    const db = new D1Mock()
    // attempts=2 → minWait = 2^2*60 = 240s. last_attempt at 1000; now at 1100
    // → only 100s elapsed, sweeper must skip.
    db.email_outbox.set('eob_1', {
      id: 'eob_1',
      to_email: 'v@x.com',
      subject: 's',
      html: '',
      text_body: '',
      kind: 'refund-notice',
      created_at: 100,
      attempts: 2,
      last_attempt: 1000,
      last_error: 'transient',
      sent_at: null,
    })
    const out = await sweepEmailOutbox('rk_test', db as unknown as D1Database, 1100)
    expect(out).toEqual({ retried: 0, delivered: 0, failed: 0 })
    expect(db.email_outbox.get('eob_1')?.sent_at).toBeNull()
  })

  it('stops retrying once attempts hits OUTBOX_MAX_ATTEMPTS', async () => {
    mockResend(200, '{}')
    const db = new D1Mock()
    db.email_outbox.set('eob_done', {
      id: 'eob_done',
      to_email: 'v@x.com',
      subject: 's',
      html: '',
      text_body: '',
      kind: 'refund-notice',
      created_at: 100,
      attempts: OUTBOX_MAX_ATTEMPTS,
      last_attempt: 100,
      last_error: 'too many tries',
      sent_at: null,
    })
    const out = await sweepEmailOutbox('rk_test', db as unknown as D1Database, 99_999)
    expect(out.retried).toBe(0)
    // Row stays in the table for an operator to inspect; sweeper just leaves
    // it alone.
    expect(db.email_outbox.get('eob_done')?.sent_at).toBeNull()
  })

  it('returns zero counters when the outbox is empty', async () => {
    mockResend(200, '{}')
    const db = new D1Mock()
    const out = await sweepEmailOutbox('rk_test', db as unknown as D1Database, 99_999)
    expect(out).toEqual({ retried: 0, delivered: 0, failed: 0 })
  })
})
