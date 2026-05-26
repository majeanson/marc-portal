import { beforeEach, describe, expect, it, vi } from 'vitest'
import { type D1Mock, makeMockEnv } from '../../../../../tests/d1-mock'

vi.mock('../../../../_lib/auth', () => ({
  currentEmail: vi.fn(),
}))

import { currentEmail } from '../../../../_lib/auth'
import { onRequestDelete, onRequestGet, onRequestPut } from './notes'

const mockedCurrentEmail = vi.mocked(currentEmail)

function makeCtx(method: 'GET' | 'PUT' | 'DELETE', asEmail: string | null, body?: unknown) {
  const env = makeMockEnv()
  mockedCurrentEmail.mockResolvedValue(asEmail)
  const init: RequestInit = { method }
  if (body !== undefined) {
    init.headers = { 'content-type': 'application/json' }
    init.body = JSON.stringify(body)
  }
  return {
    request: new Request('https://x.test/api/admin/sessions/s1/notes', init),
    env,
    params: { id: 's1' },
  } as Parameters<typeof onRequestGet>[0]
}

function seedSession(db: D1Mock, id = 's1') {
  db.sessions.set(id, {
    id,
    email: 'visitor@x.com',
    intake_json: null,
    status: 'active',
    created_at: 1,
    updated_at: 1,
    deleted_at: null,
    status_history: null,
    showcased_at: null,
    showcase_title: null,
    showcase_tagline: null,
  })
}

beforeEach(() => {
  mockedCurrentEmail.mockReset()
})

describe('GET /api/admin/sessions/:id/notes', () => {
  it('401 when not signed in', async () => {
    const ctx = makeCtx('GET', null)
    seedSession(ctx.env._db as D1Mock)
    const res = await onRequestGet(ctx)
    expect(res.status).toBe(401)
  })

  it('403 for non-admin', async () => {
    const ctx = makeCtx('GET', 'visitor@x.com')
    seedSession(ctx.env._db as D1Mock)
    const res = await onRequestGet(ctx)
    expect(res.status).toBe(403)
  })

  it('404 when session does not exist', async () => {
    const ctx = makeCtx('GET', 'marc@x.com')
    const res = await onRequestGet(ctx)
    expect(res.status).toBe(404)
  })

  it('returns null note when none exists', async () => {
    const ctx = makeCtx('GET', 'marc@x.com')
    seedSession(ctx.env._db as D1Mock)
    const res = await onRequestGet(ctx)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { note: unknown }
    expect(body.note).toBeNull()
  })
})

describe('PUT /api/admin/sessions/:id/notes', () => {
  it('writes the note and returns it', async () => {
    const ctx = makeCtx('PUT', 'marc@x.com', { body: 'remember to push back on tier' })
    seedSession(ctx.env._db as D1Mock)
    const res = await onRequestPut(ctx)
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      note: { sessionId: string; body: string; updatedBy: string }
    }
    expect(body.note.body).toBe('remember to push back on tier')
    expect(body.note.updatedBy).toBe('marc@x.com')

    // GET sees the same row.
    const ctx2 = makeCtx('GET', 'marc@x.com')
    ;(ctx2.env._db as D1Mock).operator_notes = (ctx.env._db as D1Mock).operator_notes
    ;(ctx2.env._db as D1Mock).sessions = (ctx.env._db as D1Mock).sessions
    const r2 = await onRequestGet(ctx2)
    const b2 = (await r2.json()) as { note: { body: string } | null }
    expect(b2.note?.body).toBe('remember to push back on tier')
  })

  it('treats empty body as a delete', async () => {
    const ctx = makeCtx('PUT', 'marc@x.com', { body: '   ' })
    seedSession(ctx.env._db as D1Mock)
    const res = await onRequestPut(ctx)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { note: unknown }
    expect(body.note).toBeNull()
  })

  it('413 when body exceeds 4 KB', async () => {
    const ctx = makeCtx('PUT', 'marc@x.com', { body: 'x'.repeat(5000) })
    seedSession(ctx.env._db as D1Mock)
    const res = await onRequestPut(ctx)
    expect(res.status).toBe(413)
  })

  it('400 when body is not a string', async () => {
    const ctx = makeCtx('PUT', 'marc@x.com', { body: 42 })
    seedSession(ctx.env._db as D1Mock)
    const res = await onRequestPut(ctx)
    expect(res.status).toBe(400)
  })

  it('403 for non-admin even with a valid body', async () => {
    const ctx = makeCtx('PUT', 'visitor@x.com', { body: 'no' })
    seedSession(ctx.env._db as D1Mock)
    const res = await onRequestPut(ctx)
    expect(res.status).toBe(403)
  })
})

describe('DELETE /api/admin/sessions/:id/notes', () => {
  it('removes the note', async () => {
    const ctx = makeCtx('PUT', 'marc@x.com', { body: 'temp' })
    seedSession(ctx.env._db as D1Mock)
    await onRequestPut(ctx)

    const delCtx = {
      ...ctx,
      request: new Request('https://x.test/api/admin/sessions/s1/notes', { method: 'DELETE' }),
    } as Parameters<typeof onRequestDelete>[0]
    const res = await onRequestDelete(delCtx)
    expect(res.status).toBe(200)
    expect((ctx.env._db as D1Mock).operator_notes.size).toBe(0)
  })
})
