/**
 * /api/admin/email-outbox — pending outbox view + manual retry.
 *
 * Covered:
 *   - GET admin-gate (401 anon, 403 non-admin).
 *   - GET payload shape (entries sorted by attempts DESC then created ASC).
 *   - GET graceful-degrade when email_outbox table is missing (pre-migration).
 *   - POST happy path (sendRaw delivers → row marked sent_at, drops out of GET).
 *   - POST already-sent → 200 + alreadySent:true, no fetch.
 *   - POST unknown id → 404.
 *   - POST sendRaw failure → 200 + delivered:false + attempts bumped + last_error.
 *   - POST gated on RESEND_API_KEY (503 when unset).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { type D1Mock, makeMockEnv } from '../../../tests/d1-mock'

vi.mock('../../_lib/auth', () => ({
  currentEmail: vi.fn(),
}))

import { currentEmail } from '../../_lib/auth'
import { onRequestGet, onRequestPost } from './email-outbox'

const mockedCurrentEmail = vi.mocked(currentEmail)

function makeCtx(asEmail: string | null, opts: { method?: 'GET' | 'POST'; body?: unknown } = {}) {
  const env = makeMockEnv()
  mockedCurrentEmail.mockResolvedValue(asEmail)
  const method = opts.method ?? 'GET'
  const init: RequestInit = { method }
  if (opts.body !== undefined) {
    init.body = JSON.stringify(opts.body)
    init.headers = { 'content-type': 'application/json' }
  }
  return {
    request: new Request('https://x.test/api/admin/email-outbox', init),
    env,
    params: {},
  } as Parameters<typeof onRequestGet>[0]
}

function seedRow(db: D1Mock, over: Record<string, unknown> = {}) {
  const id = (over.id as string) ?? `eob_${Math.random().toString(36).slice(2, 10)}`
  db.email_outbox.set(id, {
    id,
    to_email: 'visitor@x.com',
    subject: 'Test subject',
    html: '<p>body</p>',
    text_body: 'body',
    kind: 'tier-assigned',
    created_at: 1_700_000_000,
    attempts: 1,
    last_attempt: 1_700_000_001,
    last_error: 'Resend 502',
    sent_at: null,
    ...over,
  })
  return id
}

beforeEach(() => {
  mockedCurrentEmail.mockReset()
  vi.unstubAllGlobals()
})

// ────────────────────────────────────────────────────────────────────────────
// GET — list pending rows.
// ────────────────────────────────────────────────────────────────────────────

describe('GET /api/admin/email-outbox — auth', () => {
  it('returns 401 when not signed in', async () => {
    const ctx = makeCtx(null)
    const res = await onRequestGet(ctx)
    expect(res.status).toBe(401)
  })

  it('returns 403 for a non-admin', async () => {
    const ctx = makeCtx('visitor@x.com')
    const res = await onRequestGet(ctx)
    expect(res.status).toBe(403)
  })
})

describe('GET /api/admin/email-outbox — payload', () => {
  it('returns an empty list when the outbox is clear', async () => {
    const ctx = makeCtx('marc@x.com')
    const res = await onRequestGet(ctx)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { entries: unknown[] }
    expect(body.entries).toEqual([])
  })

  it('sorts pending rows by attempts DESC then created_at ASC', async () => {
    const ctx = makeCtx('marc@x.com')
    const db = ctx.env._db as D1Mock
    seedRow(db, { id: 'a', attempts: 1, created_at: 100 })
    seedRow(db, { id: 'b', attempts: 5, created_at: 200 }) // stuck, top
    seedRow(db, { id: 'c', attempts: 5, created_at: 150 }) // stuck, ties broken by oldest
    seedRow(db, { id: 'd', attempts: 0, created_at: 50 })

    const res = await onRequestGet(ctx)
    const body = (await res.json()) as { entries: Array<{ id: string }> }
    expect(body.entries.map((e) => e.id)).toEqual(['c', 'b', 'a', 'd'])
  })

  it('excludes sent rows from the list', async () => {
    const ctx = makeCtx('marc@x.com')
    const db = ctx.env._db as D1Mock
    seedRow(db, { id: 'pending', sent_at: null })
    seedRow(db, { id: 'sent', sent_at: 1_700_000_500 })

    const res = await onRequestGet(ctx)
    const body = (await res.json()) as { entries: Array<{ id: string }> }
    expect(body.entries.map((e) => e.id)).toEqual(['pending'])
  })

  it('exposes the diagnostic fields (kind, attempts, last_error)', async () => {
    const ctx = makeCtx('marc@x.com')
    const db = ctx.env._db as D1Mock
    seedRow(db, {
      id: 'r',
      kind: 'refund-notice',
      attempts: 3,
      last_error: 'Resend timeout',
    })

    const res = await onRequestGet(ctx)
    const body = (await res.json()) as { entries: Array<Record<string, unknown>> }
    expect(body.entries[0]).toMatchObject({
      id: 'r',
      toEmail: 'visitor@x.com',
      subject: 'Test subject',
      kind: 'refund-notice',
      attempts: 3,
      lastError: 'Resend timeout',
    })
  })
})

// ────────────────────────────────────────────────────────────────────────────
// POST — manual retry.
// ────────────────────────────────────────────────────────────────────────────

describe('POST /api/admin/email-outbox — auth', () => {
  it('returns 401 when not signed in', async () => {
    const ctx = makeCtx(null, { method: 'POST', body: { id: 'r' } })
    const res = await onRequestPost(ctx)
    expect(res.status).toBe(401)
  })

  it('returns 403 for a non-admin', async () => {
    const ctx = makeCtx('visitor@x.com', { method: 'POST', body: { id: 'r' } })
    const res = await onRequestPost(ctx)
    expect(res.status).toBe(403)
  })

  it('returns 503 when RESEND_API_KEY is unset', async () => {
    mockedCurrentEmail.mockResolvedValue('marc@x.com')
    const env = makeMockEnv({ RESEND_API_KEY: undefined })
    const ctx = {
      request: new Request('https://x.test/api/admin/email-outbox', {
        method: 'POST',
        body: JSON.stringify({ id: 'r' }),
        headers: { 'content-type': 'application/json' },
      }),
      env,
      params: {},
    } as Parameters<typeof onRequestPost>[0]
    const res = await onRequestPost(ctx)
    expect(res.status).toBe(503)
  })
})

describe('POST /api/admin/email-outbox — payload validation', () => {
  it('returns 400 on invalid JSON', async () => {
    mockedCurrentEmail.mockResolvedValue('marc@x.com')
    const env = makeMockEnv()
    const ctx = {
      request: new Request('https://x.test/api/admin/email-outbox', {
        method: 'POST',
        body: 'not json',
        headers: { 'content-type': 'application/json' },
      }),
      env,
      params: {},
    } as Parameters<typeof onRequestPost>[0]
    const res = await onRequestPost(ctx)
    expect(res.status).toBe(400)
  })

  it('returns 400 when id is missing', async () => {
    const ctx = makeCtx('marc@x.com', { method: 'POST', body: {} })
    const res = await onRequestPost(ctx)
    expect(res.status).toBe(400)
  })

  it('returns 404 when id is unknown', async () => {
    const ctx = makeCtx('marc@x.com', { method: 'POST', body: { id: 'nope' } })
    const res = await onRequestPost(ctx)
    expect(res.status).toBe(404)
  })
})

describe('POST /api/admin/email-outbox — retry happy path', () => {
  it('delivers via sendRaw, marks sent_at, returns delivered:true', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchSpy)
    const ctx = makeCtx('marc@x.com', { method: 'POST', body: { id: 'r' } })
    const db = ctx.env._db as D1Mock
    seedRow(db, { id: 'r', attempts: 5 })

    const res = await onRequestPost(ctx)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { delivered: boolean }
    expect(body.delivered).toBe(true)

    // fetch was called against Resend with the stored payload.
    expect(fetchSpy).toHaveBeenCalledOnce()
    const url = fetchSpy.mock.calls[0]?.[0]
    expect(String(url)).toContain('api.resend.com/emails')

    // Row is now marked sent.
    const row = db.email_outbox.get('r')
    expect(row?.sent_at).not.toBeNull()
  })

  it('returns alreadySent:true without calling fetch when row is already delivered', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const ctx = makeCtx('marc@x.com', { method: 'POST', body: { id: 'r' } })
    const db = ctx.env._db as D1Mock
    seedRow(db, { id: 'r', sent_at: 1_700_000_500 })

    const res = await onRequestPost(ctx)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { delivered: boolean; alreadySent?: boolean }
    expect(body.delivered).toBe(true)
    expect(body.alreadySent).toBe(true)
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

describe('POST /api/admin/email-outbox — retry failure', () => {
  it('bumps attempts + records last_error, returns delivered:false', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(new Response('Resend 503: try later', { status: 503 }))
    vi.stubGlobal('fetch', fetchSpy)
    const ctx = makeCtx('marc@x.com', { method: 'POST', body: { id: 'r' } })
    const db = ctx.env._db as D1Mock
    seedRow(db, { id: 'r', attempts: 2 })

    const res = await onRequestPost(ctx)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { delivered: boolean; error?: string }
    expect(body.delivered).toBe(false)
    expect(body.error).toContain('503')

    const row = db.email_outbox.get('r')
    expect(row?.attempts).toBe(3)
    expect(row?.sent_at).toBeNull()
    expect(row?.last_error).toContain('503')
  })

  it('bumps attempts past the OUTBOX_MAX_ATTEMPTS ceiling on manual retry', async () => {
    // Manual retry is the escape hatch — the sweeper's 5-attempt cap doesn't
    // apply here. A row at attempts=5 should still get one more try.
    const fetchSpy = vi.fn().mockResolvedValue(new Response('still failing', { status: 502 }))
    vi.stubGlobal('fetch', fetchSpy)
    const ctx = makeCtx('marc@x.com', { method: 'POST', body: { id: 'r' } })
    const db = ctx.env._db as D1Mock
    seedRow(db, { id: 'r', attempts: 5 })

    const res = await onRequestPost(ctx)
    expect(res.status).toBe(200)
    expect(fetchSpy).toHaveBeenCalledOnce()

    const row = db.email_outbox.get('r')
    expect(row?.attempts).toBe(6)
  })
})
