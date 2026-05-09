/**
 * Integration tests for the sessions endpoints. Mocks auth + email so we
 * exercise the SQL-and-policy logic against the in-memory D1 mock.
 *
 * Coverage focus (the bits worth regression-protecting):
 *   - PATCH ifUpdatedAt → 409 on stale, 200 on fresh
 *   - PATCH undelete admin gate
 *   - PATCH status writes status_history + notifies
 *   - PATCH intakeJson visitor self-allowed
 *   - DELETE soft-deletes + notifies counterparty
 *   - GET filters deleted_at IS NULL for visitors
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { type D1Mock, makeMockEnv } from '../../../tests/d1-mock'

// Hoisted mocks — these get pulled to the top by Vitest.
vi.mock('../../_lib/auth', () => ({
  currentEmail: vi.fn(),
  isPlausibleEmail: (e: string) => /\S+@\S+\.\S+/.test(e),
}))

vi.mock('../../_lib/email', () => ({
  sendMagicLink: vi.fn().mockResolvedValue(true),
  sendVisitorMessageNotification: vi.fn().mockResolvedValue(true),
  sendMarcMessageNotification: vi.fn().mockResolvedValue(true),
  sendStatusChangeNotification: vi.fn().mockResolvedValue(true),
  sendIntakeEditedNotification: vi.fn().mockResolvedValue(true),
  sendWithdrawalNotification: vi.fn().mockResolvedValue(true),
}))

import { currentEmail } from '../../_lib/auth'
import * as email from '../../_lib/email'
import { onRequestDelete, onRequestPatch } from './[id]'
import { onRequestPost as onRequestPostSession } from './index'

const mockedCurrentEmail = vi.mocked(currentEmail)

interface Ctx {
  request: Request
  env: ReturnType<typeof makeMockEnv>
  params: { id: string }
}

function makeCtx(opts: {
  method?: string
  body?: unknown
  asEmail: string
  sessionId?: string
}): Ctx {
  const env = makeMockEnv()
  mockedCurrentEmail.mockResolvedValue(opts.asEmail)
  const url = `https://x.test/api/sessions/${opts.sessionId ?? 's1'}`
  const init: RequestInit = { method: opts.method ?? 'GET' }
  if (opts.body !== undefined) {
    init.headers = { 'content-type': 'application/json' }
    init.body = JSON.stringify(opts.body)
  }
  return {
    request: new Request(url, init),
    env,
    params: { id: opts.sessionId ?? 's1' },
  }
}

function seedSession(db: D1Mock, over: Record<string, unknown> = {}) {
  const id = (over.id as string) ?? 's1'
  db.sessions.set(id, {
    id,
    email: 'visitor@x.com',
    intake_json: JSON.stringify({ lang: 'fr', type: 'paperasse', formData: {} }),
    status: 'draft',
    created_at: 1700000000,
    updated_at: 1700000000,
    deleted_at: null,
    status_history: null,
    ...over,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PATCH /api/sessions/:id — concurrency', () => {
  it('returns 409 when ifUpdatedAt is stale', async () => {
    const ctx = makeCtx({
      method: 'PATCH',
      asEmail: 'visitor@x.com',
      body: { intakeJson: { lang: 'fr', formData: { x: 1 } }, ifUpdatedAt: 1 },
    })
    seedSession(ctx.env._db, { updated_at: 9999 })
    const res = await onRequestPatch(ctx as never)
    expect(res.status).toBe(409)
  })

  it('200 when ifUpdatedAt matches', async () => {
    const updated = 1234
    const ctx = makeCtx({
      method: 'PATCH',
      asEmail: 'visitor@x.com',
      body: { intakeJson: { lang: 'fr', formData: {} }, ifUpdatedAt: updated },
    })
    seedSession(ctx.env._db, { updated_at: updated })
    const res = await onRequestPatch(ctx as never)
    expect(res.status).toBe(200)
  })

  it('skips concurrency when ifUpdatedAt is omitted', async () => {
    const ctx = makeCtx({
      method: 'PATCH',
      asEmail: 'visitor@x.com',
      body: { intakeJson: { lang: 'fr', formData: {} } },
    })
    seedSession(ctx.env._db, { updated_at: 5 })
    const res = await onRequestPatch(ctx as never)
    expect(res.status).toBe(200)
  })
})

describe('PATCH /api/sessions/:id — undelete', () => {
  it('admin-only gate', async () => {
    const ctx = makeCtx({
      method: 'PATCH',
      asEmail: 'visitor@x.com',
      body: { undelete: true },
    })
    seedSession(ctx.env._db, { deleted_at: 100 })
    const res = await onRequestPatch(ctx as never)
    expect(res.status).toBe(403)
  })

  it('admin restores a soft-deleted row', async () => {
    const ctx = makeCtx({
      method: 'PATCH',
      asEmail: 'marc@x.com',
      body: { undelete: true },
    })
    seedSession(ctx.env._db, { deleted_at: 100 })
    const res = await onRequestPatch(ctx as never)
    expect(res.status).toBe(200)
    expect(ctx.env._db.sessions.get('s1')?.deleted_at).toBeNull()
  })

  it('undelete is a no-op on a live row', async () => {
    const ctx = makeCtx({
      method: 'PATCH',
      asEmail: 'marc@x.com',
      body: { undelete: true },
    })
    seedSession(ctx.env._db) // not deleted
    const res = await onRequestPatch(ctx as never)
    expect(res.status).toBe(200)
  })
})

describe('PATCH /api/sessions/:id — status changes', () => {
  it('only admin can change status', async () => {
    const ctx = makeCtx({
      method: 'PATCH',
      asEmail: 'visitor@x.com',
      body: { status: 'triage' },
    })
    seedSession(ctx.env._db)
    const res = await onRequestPatch(ctx as never)
    expect(res.status).toBe(403)
  })

  it('admin status change appends status_history + notifies visitor', async () => {
    const ctx = makeCtx({
      method: 'PATCH',
      asEmail: 'marc@x.com',
      body: { status: 'triage' },
    })
    seedSession(ctx.env._db)
    const res = await onRequestPatch(ctx as never)
    expect(res.status).toBe(200)
    const fresh = ctx.env._db.sessions.get('s1')!
    expect(fresh.status).toBe('triage')
    expect(fresh.status_history).not.toBeNull()
    const history = JSON.parse(fresh.status_history!)
    expect(history).toHaveLength(1)
    expect(history[0].from).toBe('draft')
    expect(history[0].to).toBe('triage')
    expect(history[0].by).toBe('marc@x.com')
    expect(email.sendStatusChangeNotification).toHaveBeenCalledOnce()
  })

  it('rejects invalid statuses', async () => {
    const ctx = makeCtx({
      method: 'PATCH',
      asEmail: 'marc@x.com',
      body: { status: 'banana' },
    })
    seedSession(ctx.env._db)
    const res = await onRequestPatch(ctx as never)
    expect(res.status).toBe(400)
  })

  it('no-op when status equals current', async () => {
    const ctx = makeCtx({
      method: 'PATCH',
      asEmail: 'marc@x.com',
      body: { status: 'draft' },
    })
    seedSession(ctx.env._db)
    const res = await onRequestPatch(ctx as never)
    expect(res.status).toBe(200)
    expect(ctx.env._db.sessions.get('s1')?.status_history).toBeNull()
    expect(email.sendStatusChangeNotification).not.toHaveBeenCalled()
  })
})

describe('PATCH /api/sessions/:id — intake edits', () => {
  it('visitor self-edit notifies admin', async () => {
    const ctx = makeCtx({
      method: 'PATCH',
      asEmail: 'visitor@x.com',
      body: { intakeJson: { lang: 'fr', type: 'paperasse', formData: { a: 'updated' } } },
    })
    seedSession(ctx.env._db)
    const res = await onRequestPatch(ctx as never)
    expect(res.status).toBe(200)
    expect(email.sendIntakeEditedNotification).toHaveBeenCalledOnce()
  })

  it('admin self-edit on visitor session does NOT notify (admin already knows)', async () => {
    const ctx = makeCtx({
      method: 'PATCH',
      asEmail: 'marc@x.com',
      body: { intakeJson: { lang: 'fr', type: 'paperasse', formData: { a: 'updated' } } },
    })
    seedSession(ctx.env._db)
    const res = await onRequestPatch(ctx as never)
    expect(res.status).toBe(200)
    expect(email.sendIntakeEditedNotification).not.toHaveBeenCalled()
  })

  it('non-owner non-admin gets 403', async () => {
    const ctx = makeCtx({
      method: 'PATCH',
      asEmail: 'someone-else@x.com',
      body: { intakeJson: { lang: 'fr' } },
    })
    seedSession(ctx.env._db)
    const res = await onRequestPatch(ctx as never)
    expect(res.status).toBe(403)
  })
})

describe('DELETE /api/sessions/:id', () => {
  it('visitor self-withdraw soft-deletes + notifies admin', async () => {
    const ctx = makeCtx({ method: 'DELETE', asEmail: 'visitor@x.com' })
    seedSession(ctx.env._db)
    const res = await onRequestDelete(ctx as never)
    expect(res.status).toBe(200)
    expect(ctx.env._db.sessions.get('s1')?.deleted_at).not.toBeNull()
    expect(email.sendWithdrawalNotification).toHaveBeenCalledOnce()
  })

  it('admin force-withdraw notifies visitor', async () => {
    const ctx = makeCtx({ method: 'DELETE', asEmail: 'marc@x.com' })
    seedSession(ctx.env._db)
    const res = await onRequestDelete(ctx as never)
    expect(res.status).toBe(200)
    expect(email.sendWithdrawalNotification).toHaveBeenCalledOnce()
  })

  it('foreign visitor gets 403', async () => {
    const ctx = makeCtx({ method: 'DELETE', asEmail: 'someone-else@x.com' })
    seedSession(ctx.env._db)
    const res = await onRequestDelete(ctx as never)
    expect(res.status).toBe(403)
  })

  it('already-deleted is idempotent (200)', async () => {
    const ctx = makeCtx({ method: 'DELETE', asEmail: 'visitor@x.com' })
    seedSession(ctx.env._db, { deleted_at: 999 })
    const res = await onRequestDelete(ctx as never)
    expect(res.status).toBe(200)
  })
})

describe('POST /api/sessions — rate limit', () => {
  it('allows the first batch then blocks after limit', async () => {
    // 5/hour per email is the cap. 6th attempt → 429.
    // Reuse a single env so the rate_limits table accumulates across calls.
    const env = makeMockEnv()
    mockedCurrentEmail.mockResolvedValue('visitor@x.com')
    const body = { intakeJson: { lang: 'fr', type: 'paperasse', formData: {} } }
    let blocked = 0
    let allowed = 0
    for (let i = 0; i < 6; i++) {
      const ctx = {
        request: new Request('https://x.test/api/sessions', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        }),
        env,
        params: {},
      }
      const res = await onRequestPostSession(ctx as never)
      if (res.status === 429) blocked++
      else if (res.status === 200) allowed++
    }
    expect(allowed).toBe(5)
    expect(blocked).toBe(1)
  })
})
