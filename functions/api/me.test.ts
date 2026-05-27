/**
 * Tests for DELETE /api/me — Loi 25 self-erasure.
 *
 * Pinned behavior:
 *   - 401 when not signed in (no side effects).
 *   - Erases sessions + child rows for the signed-in email.
 *   - Erases user_prefs (Loi 25 completeness — pref row outliving the
 *     account would be a compliance gap).
 *   - Clears the session cookie on the response.
 *   - Fires sendErasureReceipt with the captured pre-deletion session
 *     count and a 'fr' fallback when no user_prefs row exists.
 *   - A receipt-send failure does NOT block the response — the data is
 *     already gone by the time send() runs.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { type D1Mock, makeMockEnv } from '../../tests/d1-mock'
import type * as AuthModule from '../_lib/auth'

vi.mock('../_lib/auth', async () => {
  const real = await vi.importActual<typeof AuthModule>('../_lib/auth')
  return {
    ...real,
    currentEmail: vi.fn(),
  }
})

vi.mock('../_lib/email', () => ({
  sendErasureReceipt: vi.fn().mockResolvedValue({ ok: true }),
}))

import { currentEmail } from '../_lib/auth'
import * as email from '../_lib/email'
import { onRequestDelete } from './me'

const mockedCurrentEmail = vi.mocked(currentEmail)

function makeCtx(asEmail: string | null) {
  const env = makeMockEnv()
  mockedCurrentEmail.mockResolvedValue(asEmail)
  return {
    request: new Request('https://x.test/api/me', { method: 'DELETE' }),
    env,
    params: {},
  } as Parameters<typeof onRequestDelete>[0]
}

function seedVisitor(db: D1Mock, email: string, sessionCount: number) {
  for (let i = 0; i < sessionCount; i++) {
    const sid = `s_${email}_${i}`
    db.sessions.set(sid, {
      id: sid,
      email,
      intake_json: null,
      status: 'active',
      created_at: 1_700_000_000,
      updated_at: 1_700_000_000,
      deleted_at: null,
      status_history: null,
      showcased_at: null,
      showcase_title: null,
      showcase_tagline: null,
    })
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('DELETE /api/me — auth', () => {
  it('returns 401 when not signed in', async () => {
    const ctx = makeCtx(null)
    const res = await onRequestDelete(ctx)
    expect(res.status).toBe(401)
    expect(email.sendErasureReceipt).not.toHaveBeenCalled()
  })
})

describe('DELETE /api/me — data cleanup', () => {
  it('deletes the visitor sessions but leaves other visitors alone', async () => {
    const ctx = makeCtx('visitor@x.com')
    const db = ctx.env._db as D1Mock
    seedVisitor(db, 'visitor@x.com', 3)
    seedVisitor(db, 'other@x.com', 2)

    const res = await onRequestDelete(ctx)
    expect(res.status).toBe(200)

    const remaining = [...db.sessions.values()]
    expect(remaining.every((s) => s.email !== 'visitor@x.com')).toBe(true)
    expect(remaining.filter((s) => s.email === 'other@x.com')).toHaveLength(2)
  })

  it('deletes user_prefs for the visitor (Loi 25 completeness)', async () => {
    const ctx = makeCtx('Visitor@X.com')
    const db = ctx.env._db as D1Mock
    db.user_prefs.set('visitor@x.com', {
      email: 'visitor@x.com',
      lang: 'en',
      first_name: 'Test',
      updated_at: 1_700_000_000,
    })
    db.user_prefs.set('other@x.com', {
      email: 'other@x.com',
      lang: 'fr',
      first_name: null,
      updated_at: 1_700_000_000,
    })

    await onRequestDelete(ctx)
    // Lowercased key matches; mixed-case caller email still purges the row.
    expect(db.user_prefs.has('visitor@x.com')).toBe(false)
    expect(db.user_prefs.has('other@x.com')).toBe(true)
  })
})

describe('DELETE /api/me — receipt email', () => {
  it('fires sendErasureReceipt with the captured pre-deletion session count', async () => {
    const ctx = makeCtx('visitor@x.com')
    const db = ctx.env._db as D1Mock
    seedVisitor(db, 'visitor@x.com', 4)

    await onRequestDelete(ctx)

    expect(email.sendErasureReceipt).toHaveBeenCalledOnce()
    const call = (email.sendErasureReceipt as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(call?.[1]).toBe('visitor@x.com') // recipient
    expect(call?.[2]).toBe('https://x.test') // origin
    expect(call?.[3]).toBe('fr') // default lang fallback
    expect(call?.[4]).toEqual({ sessionCount: 4 })
  })

  it('passes sessionCount = 0 when the visitor had no sessions', async () => {
    const ctx = makeCtx('quiet@x.com')
    // Only user_prefs present; no sessions.
    const db = ctx.env._db as D1Mock
    db.user_prefs.set('quiet@x.com', {
      email: 'quiet@x.com',
      lang: 'en',
      first_name: null,
      updated_at: 1_700_000_000,
    })

    await onRequestDelete(ctx)
    const call = (email.sendErasureReceipt as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(call?.[4]).toEqual({ sessionCount: 0 })
  })

  it('does not fail the request when the receipt send throws', async () => {
    ;(email.sendErasureReceipt as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('resend down'),
    )
    const ctx = makeCtx('visitor@x.com')
    seedVisitor(ctx.env._db as D1Mock, 'visitor@x.com', 1)

    const res = await onRequestDelete(ctx)
    expect(res.status).toBe(200)
    // Data still gone — receipt failure cannot block erasure.
    expect([...(ctx.env._db as D1Mock).sessions.values()]).toHaveLength(0)
  })
})
