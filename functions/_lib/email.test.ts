/**
 * Outbox + suppression tests for the send-failure persistence path
 * (AUDIT P1.3) and the bounce/complaint/unsubscribe suppression check
 * (P1.1/P1.2 consumer). Resend is mocked at the fetch layer — no real
 * network call.
 *
 * All sends now go through the env-first API: each public function takes
 * `env: EmailEnv` instead of `apiKey: string`. send() centralizes the
 * suppression check (skip if recipient is on the suppression list),
 * unsubscribe headers (RFC 8058), and the outbox enqueue. The durable
 * opt-in is hardcoded per-function (an OutboxKind passed to send()) — no
 * longer caller-controlled.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { D1Database } from '@cloudflare/workers-types'
import { D1Mock } from '../../tests/d1-mock'
import {
  OUTBOX_MAX_ATTEMPTS,
  sendRefundNotice,
  sendTierAssignedNotification,
  sendMagicLink,
  sweepEmailOutbox,
  type EmailEnv,
} from './email'

function mockResend(status: number, body: string) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(body, { status })),
  )
}

/** Build a fully-fledged EmailEnv from a D1Mock + sensible defaults. */
function envFromMock(db: D1Mock, adminEmails = 'marc@x.com'): EmailEnv {
  return {
    RESEND_API_KEY: 'rk_test',
    SESSION_SECRET: '0'.repeat(64),
    DB: db as unknown as D1Database,
    ADMIN_EMAILS: adminEmails,
  }
}

beforeEach(() => {
  vi.unstubAllGlobals()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// ============================================================================
// Outbox writer (durable opt-in inside send())
// ============================================================================

describe('send-failure outbox — writer', () => {
  it('does NOT write to outbox when Resend succeeds', async () => {
    mockResend(200, JSON.stringify({ id: 'em_ok' }))
    const db = new D1Mock()
    const r = await sendRefundNotice(
      envFromMock(db),
      'v@x.com',
      30_000,
      60_000,
      'https://marcportal.com',
      'fr',
    )
    expect(r.ok).toBe(true)
    expect(db.email_outbox.size).toBe(0)
  })

  it('writes the rendered email to outbox when Resend returns 5xx', async () => {
    mockResend(502, 'bad gateway')
    const db = new D1Mock()
    const r = await sendRefundNotice(
      envFromMock(db),
      'v@x.com',
      30_000,
      60_000,
      'https://marcportal.com',
      'fr',
    )
    expect(r.ok).toBe(false)
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

  it('non-durable sends (e.g. magic-link) do NOT enqueue on Resend failure', async () => {
    mockResend(502, 'bad gateway')
    const db = new D1Mock()
    const r = await sendMagicLink(envFromMock(db), 'v@x.com', 'https://marcportal.com/x', 'fr')
    expect(r.ok).toBe(false)
    expect(db.email_outbox.size).toBe(0)
  })

  it('writes a tier-assigned row when tier-assigned send fails', async () => {
    mockResend(503, 'unavailable')
    const db = new D1Mock()
    await sendTierAssignedNotification(
      envFromMock(db),
      'v@x.com',
      's1',
      2,
      180_000,
      'https://marcportal.com',
      'en',
      false,
    )
    const rows = [...db.email_outbox.values()]
    expect(rows).toHaveLength(1)
    expect(rows[0]?.kind).toBe('tier-assigned')
  })
})

// ============================================================================
// Suppression check (consumes email_events)
// ============================================================================

function seedSuppressionEvent(
  db: D1Mock,
  email: string,
  type: 'email.bounced' | 'email.complained' | 'email.unsubscribed',
  subtype: string | null = null,
): void {
  db.email_events.set(`ev_${db.email_events.size + 1}`, {
    id: `ev_${db.email_events.size + 1}`,
    to_email: email.toLowerCase(),
    type,
    subtype,
    payload: '{}',
    received_at: 100,
  })
}

describe('send — suppression check', () => {
  it('skips Resend entirely + returns suppressed when address has a complaint', async () => {
    let fetchCalled = false
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        fetchCalled = true
        return new Response('{}', { status: 200 })
      }),
    )
    const db = new D1Mock()
    seedSuppressionEvent(db, 'v@x.com', 'email.complained')
    const r = await sendRefundNotice(
      envFromMock(db),
      'v@x.com',
      30_000,
      60_000,
      'https://marcportal.com',
      'fr',
    )
    expect(r.ok).toBe(false)
    expect(r.suppressed).toBe('complaint')
    expect(fetchCalled).toBe(false)
    expect(db.email_outbox.size).toBe(0)
  })

  it('surfaces unsubscribe reason for magic-link (so request-link can hint)', async () => {
    mockResend(200, '{}')
    const db = new D1Mock()
    seedSuppressionEvent(db, 'v@x.com', 'email.unsubscribed')
    const r = await sendMagicLink(envFromMock(db), 'v@x.com', 'https://marcportal.com/x', 'fr')
    expect(r.ok).toBe(false)
    expect(r.suppressed).toBe('unsubscribed')
  })

  it('treats permanent bounce as suppressed; transient bounce is NOT suppressed', async () => {
    mockResend(200, '{}')
    const db = new D1Mock()
    seedSuppressionEvent(db, 'soft@x.com', 'email.bounced', 'transient')
    // Soft bounce → not suppressed, send proceeds.
    const soft = await sendMagicLink(
      envFromMock(db),
      'soft@x.com',
      'https://marcportal.com/x',
      'fr',
    )
    expect(soft.ok).toBe(true)

    const db2 = new D1Mock()
    seedSuppressionEvent(db2, 'hard@x.com', 'email.bounced', 'permanent')
    const hard = await sendMagicLink(
      envFromMock(db2),
      'hard@x.com',
      'https://marcportal.com/x',
      'fr',
    )
    expect(hard.ok).toBe(false)
    expect(hard.suppressed).toBe('hard-bounce')
  })

  it('admin emails are NEVER suppressed regardless of stored events', async () => {
    mockResend(200, '{}')
    const db = new D1Mock()
    // Marc's own address with a complaint event (would be a bizarre dataset
    // but proves the exemption fires before the DB lookup matters).
    seedSuppressionEvent(db, 'marc@x.com', 'email.complained')
    const r = await sendRefundNotice(
      envFromMock(db, 'marc@x.com'),
      'marc@x.com',
      30_000,
      60_000,
      'https://marcportal.com',
      'fr',
    )
    expect(r.ok).toBe(true)
  })
})

// ============================================================================
// Unsubscribe header attachment
// ============================================================================

describe('send — RFC 8058 List-Unsubscribe headers', () => {
  it('attaches List-Unsubscribe + List-Unsubscribe-Post to every outbound', async () => {
    let captured: { headers?: Record<string, string> } | null = null
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        captured = JSON.parse(init.body as string)
        return new Response('{}', { status: 200 })
      }),
    )
    const db = new D1Mock()
    await sendMagicLink(envFromMock(db), 'v@x.com', 'https://marcportal.com/x?token=abc', 'fr')
    expect(captured?.headers?.['List-Unsubscribe']).toMatch(
      /^<https:\/\/marcportal\.com\/api\/unsubscribe\?email=v%40x\.com&token=/,
    )
    expect(captured?.headers?.['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click')
  })
})

// ============================================================================
// Sweeper
// ============================================================================

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
    const out = await sweepEmailOutbox(
      envFromMock(db),
      99_999,
      'marc@x.com',
      'https://marcportal.com',
      'fr',
    )
    expect(out).toMatchObject({ retried: 1, delivered: 1, failed: 0, alerted: 0 })
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
    await sweepEmailOutbox(envFromMock(db), 99_999, 'marc@x.com', 'https://marcportal.com', 'fr')
    const r = db.email_outbox.get('eob_1')!
    expect(r.attempts).toBe(2)
    expect(r.sent_at).toBeNull()
    expect(r.last_error).toMatch(/500/)
  })

  it('respects exponential backoff (skips rows attempted too recently)', async () => {
    mockResend(200, '{}')
    const db = new D1Mock()
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
    const out = await sweepEmailOutbox(
      envFromMock(db),
      1100,
      'marc@x.com',
      'https://marcportal.com',
      'fr',
    )
    expect(out).toMatchObject({ retried: 0, delivered: 0, failed: 0 })
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
    const out = await sweepEmailOutbox(
      envFromMock(db),
      99_999,
      'marc@x.com',
      'https://marcportal.com',
      'fr',
    )
    expect(out.retried).toBe(0)
    expect(db.email_outbox.get('eob_done')?.sent_at).toBeNull()
  })

  it('returns zero counters when the outbox is empty', async () => {
    mockResend(200, '{}')
    const db = new D1Mock()
    const out = await sweepEmailOutbox(
      envFromMock(db),
      99_999,
      'marc@x.com',
      'https://marcportal.com',
      'fr',
    )
    expect(out).toMatchObject({ retried: 0, delivered: 0, failed: 0, alerted: 0, pruned: 0 })
  })

  it('alerts the admin when a row JUST hits OUTBOX_MAX_ATTEMPTS', async () => {
    mockResend(500, 'still down')
    const db = new D1Mock()
    db.email_outbox.set('eob_almost', {
      id: 'eob_almost',
      to_email: 'v@x.com',
      subject: 's',
      html: '',
      text_body: '',
      kind: 'refund-notice',
      created_at: 100,
      attempts: OUTBOX_MAX_ATTEMPTS - 1,
      last_attempt: 100,
      last_error: 'prior',
      sent_at: null,
    })
    const out = await sweepEmailOutbox(
      envFromMock(db),
      99_999,
      'marc@x.com',
      'https://marcportal.com',
      'fr',
    )
    expect(out.failed).toBe(1)
    expect(out.alerted).toBe(1)
    // Next sweep finds the row at attempts === MAX and skips it (no second
    // alert for the same stuck row).
    const out2 = await sweepEmailOutbox(
      envFromMock(db),
      999_999,
      'marc@x.com',
      'https://marcportal.com',
      'fr',
    )
    expect(out2.retried).toBe(0)
    expect(out2.alerted).toBe(0)
  })

  it("does NOT alert when there's no admin email configured (best-effort guard)", async () => {
    mockResend(500, 'down')
    const db = new D1Mock()
    db.email_outbox.set('eob_almost', {
      id: 'eob_almost',
      to_email: 'v@x.com',
      subject: 's',
      html: '',
      text_body: '',
      kind: 'refund-notice',
      created_at: 100,
      attempts: OUTBOX_MAX_ATTEMPTS - 1,
      last_attempt: 100,
      last_error: 'prior',
      sent_at: null,
    })
    const out = await sweepEmailOutbox(
      envFromMock(db),
      99_999,
      null, // no admin
      'https://marcportal.com',
      'fr',
    )
    expect(out.failed).toBe(1)
    expect(out.alerted).toBe(0)
  })

  it('prunes delivered rows past the TTL', async () => {
    mockResend(200, '{}')
    const db = new D1Mock()
    const TTL = 30 * 86_400
    const now = 10_000_000
    const tooOld = now - TTL - 100 // strictly past the cutoff
    const recent = now - 60 // well inside the TTL window
    db.email_outbox.set('old_delivered', {
      id: 'old_delivered',
      to_email: 'v@x.com',
      subject: 's',
      html: '',
      text_body: '',
      kind: 'refund-notice',
      created_at: tooOld,
      attempts: 1,
      last_attempt: tooOld,
      last_error: null,
      sent_at: tooOld,
    })
    db.email_outbox.set('recent_delivered', {
      id: 'recent_delivered',
      to_email: 'v@x.com',
      subject: 's',
      html: '',
      text_body: '',
      kind: 'refund-notice',
      created_at: recent,
      attempts: 1,
      last_attempt: recent,
      last_error: null,
      sent_at: recent,
    })
    db.email_outbox.set('still_pending', {
      id: 'still_pending',
      to_email: 'v@x.com',
      subject: 's',
      html: '',
      text_body: '',
      kind: 'refund-notice',
      created_at: tooOld,
      attempts: 1,
      last_attempt: tooOld,
      last_error: 'pending',
      sent_at: null,
    })
    const out = await sweepEmailOutbox(
      envFromMock(db),
      now,
      'marc@x.com',
      'https://marcportal.com',
      'fr',
    )
    expect(out.pruned).toBe(1)
    expect(db.email_outbox.has('old_delivered')).toBe(false)
    expect(db.email_outbox.has('recent_delivered')).toBe(true)
    // Pending rows are never pruned regardless of age — only delivered ones.
    expect(db.email_outbox.has('still_pending')).toBe(true)
  })
})
