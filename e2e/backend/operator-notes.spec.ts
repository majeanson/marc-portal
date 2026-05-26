// End-to-end coverage of the operator-notes CRUD endpoints:
//   GET    /api/admin/sessions/:id/notes
//   PUT    /api/admin/sessions/:id/notes
//   DELETE /api/admin/sessions/:id/notes
//
// Vitest unit tests (functions/api/admin/sessions/[id]/notes.test.ts) cover
// the per-method branches against a mock D1. This spec runs the real
// handlers behind wrangler pages dev + ephemeral D1 with migration 0028
// applied — proving:
//
//   - admin-only at every method (401 unauthenticated, 403 visitor)
//   - PUT/DELETE pass through the standard CSRF gate (NOT exempt — see
//     functions/_middleware.ts CSRF_EXEMPT_PATHS)
//   - body cap is enforced as bytes (4 KB), not characters
//   - empty-string PUT folds into a delete (operator UX: select-all + save)
//   - DELETE is idempotent
//   - the row round-trips into D1 — the GET reads what PUT wrote

import { test, expect } from '@playwright/test'
import { randomBytes } from 'node:crypto'
import { E2E_BASE_URL, E2E_BINDINGS } from './constants'
import { forgeAuthHeaders } from './helpers/auth'
import { clearTestRows, readOperatorNote, seedOperatorNote, seedSession } from './helpers/db'

const ADMIN_EMAIL = E2E_BINDINGS.ADMIN_EMAILS // 'admin@e2e.test'
const VISITOR_EMAIL = 'visitor-notes@e2e.test'

interface NoteResponseShape {
  note: { sessionId: string; body: string; updatedAt: number; updatedBy: string } | null
}

function notesUrl(sessionId: string): string {
  return `${E2E_BASE_URL}/api/admin/sessions/${sessionId}/notes`
}

async function getNote(sessionId: string, headers: Record<string, string>): Promise<Response> {
  return await fetch(notesUrl(sessionId), { method: 'GET', headers })
}

async function putNote(
  sessionId: string,
  body: string,
  headers: Record<string, string>,
): Promise<Response> {
  return await fetch(notesUrl(sessionId), {
    method: 'PUT',
    headers,
    body: JSON.stringify({ body }),
  })
}

async function deleteNote(sessionId: string, headers: Record<string, string>): Promise<Response> {
  return await fetch(notesUrl(sessionId), { method: 'DELETE', headers })
}

test.describe('operator notes — auth wall', () => {
  test.beforeEach(() => clearTestRows())

  test('GET without cookie → 401', async () => {
    const sessionId = `sess_e2e_${randomBytes(6).toString('hex')}`
    seedSession({ id: sessionId, email: VISITOR_EMAIL, tier: 1 })

    const res = await getNote(sessionId, {})
    expect(res.status).toBe(401)
  })

  test('GET as visitor → 403', async () => {
    const sessionId = `sess_e2e_${randomBytes(6).toString('hex')}`
    seedSession({ id: sessionId, email: VISITOR_EMAIL, tier: 1 })

    const headers = forgeAuthHeaders(VISITOR_EMAIL)
    const res = await getNote(sessionId, headers)
    expect(res.status).toBe(403)
  })

  test('PUT as visitor → 403 (even of own session)', async () => {
    const sessionId = `sess_e2e_${randomBytes(6).toString('hex')}`
    seedSession({ id: sessionId, email: VISITOR_EMAIL, tier: 1 })

    const headers = forgeAuthHeaders(VISITOR_EMAIL)
    const res = await putNote(sessionId, 'hello', headers)
    expect(res.status).toBe(403)
  })

  test('PUT without CSRF header → 403 at the middleware CSRF gate', async () => {
    const sessionId = `sess_e2e_${randomBytes(6).toString('hex')}`
    seedSession({ id: sessionId, email: VISITOR_EMAIL, tier: 1 })

    // omitCsrf strips both the mp_csrf cookie and the X-CSRF-Token header.
    // The notes endpoint is NOT in CSRF_EXEMPT_PATHS, so the middleware
    // rejects before the admin gate runs. Status must be 403 (not 401) so
    // a regression that moves the auth check ahead of the CSRF gate
    // surfaces here.
    const headers = forgeAuthHeaders(ADMIN_EMAIL, { omitCsrf: true })
    const res = await putNote(sessionId, 'hello', headers)
    expect(res.status).toBe(403)
  })
})

test.describe('operator notes — GET round-trip', () => {
  test.beforeEach(() => clearTestRows())

  test('admin GET on session with no note → 200 + {note: null}', async () => {
    const sessionId = `sess_e2e_${randomBytes(6).toString('hex')}`
    seedSession({ id: sessionId, email: VISITOR_EMAIL, tier: 1 })

    const headers = forgeAuthHeaders(ADMIN_EMAIL)
    const res = await getNote(sessionId, headers)
    expect(res.status).toBe(200)
    const body = (await res.json()) as NoteResponseShape
    expect(body.note).toBeNull()
  })

  test('admin GET on a missing session → 404', async () => {
    const headers = forgeAuthHeaders(ADMIN_EMAIL)
    const res = await getNote('sess_does_not_exist', headers)
    expect(res.status).toBe(404)
  })

  test('admin GET on a seeded note → 200 + body+stamp', async () => {
    const sessionId = `sess_e2e_${randomBytes(6).toString('hex')}`
    seedSession({ id: sessionId, email: VISITOR_EMAIL, tier: 1 })
    seedOperatorNote({ sessionId, body: 'remember to push back on scope' })

    const headers = forgeAuthHeaders(ADMIN_EMAIL)
    const res = await getNote(sessionId, headers)
    expect(res.status).toBe(200)
    const body = (await res.json()) as NoteResponseShape
    expect(body.note).not.toBeNull()
    expect(body.note?.sessionId).toBe(sessionId)
    expect(body.note?.body).toBe('remember to push back on scope')
    expect(body.note?.updatedBy).toBe('admin@e2e.test')
    expect(body.note?.updatedAt).toBeGreaterThan(0)
  })
})

test.describe('operator notes — PUT upsert', () => {
  test.beforeEach(() => clearTestRows())

  test('admin PUT writes the body and GET reads it back', async () => {
    const sessionId = `sess_e2e_${randomBytes(6).toString('hex')}`
    seedSession({ id: sessionId, email: VISITOR_EMAIL, tier: 1 })

    const headers = forgeAuthHeaders(ADMIN_EMAIL)
    const putRes = await putNote(sessionId, 'first take', headers)
    expect(putRes.status).toBe(200)
    const putBody = (await putRes.json()) as NoteResponseShape
    expect(putBody.note?.body).toBe('first take')

    const getRes = await getNote(sessionId, headers)
    const getBody = (await getRes.json()) as NoteResponseShape
    expect(getBody.note?.body).toBe('first take')

    // Direct DB read confirms the row landed under the right session.
    const row = readOperatorNote(sessionId)
    expect(row?.body).toBe('first take')
    expect(row?.updated_by).toBe('admin@e2e.test')
  })

  test('PUT on an existing note overwrites the body', async () => {
    const sessionId = `sess_e2e_${randomBytes(6).toString('hex')}`
    seedSession({ id: sessionId, email: VISITOR_EMAIL, tier: 1 })
    seedOperatorNote({ sessionId, body: 'old version' })

    const headers = forgeAuthHeaders(ADMIN_EMAIL)
    const res = await putNote(sessionId, 'new version', headers)
    expect(res.status).toBe(200)
    expect(readOperatorNote(sessionId)?.body).toBe('new version')
  })

  test('empty-string PUT folds into a delete', async () => {
    const sessionId = `sess_e2e_${randomBytes(6).toString('hex')}`
    seedSession({ id: sessionId, email: VISITOR_EMAIL, tier: 1 })
    seedOperatorNote({ sessionId, body: 'will be cleared' })

    const headers = forgeAuthHeaders(ADMIN_EMAIL)
    const res = await putNote(sessionId, '   ', headers) // whitespace only
    expect(res.status).toBe(200)
    const body = (await res.json()) as NoteResponseShape
    expect(body.note).toBeNull()
    expect(readOperatorNote(sessionId)).toBeUndefined()
  })

  test('PUT with >4 KB body → 413', async () => {
    const sessionId = `sess_e2e_${randomBytes(6).toString('hex')}`
    seedSession({ id: sessionId, email: VISITOR_EMAIL, tier: 1 })

    // 4097 ASCII bytes — one byte over the 4096 cap.
    const bigBody = 'x'.repeat(4097)
    const headers = forgeAuthHeaders(ADMIN_EMAIL)
    const res = await putNote(sessionId, bigBody, headers)
    expect(res.status).toBe(413)
    // No row should have landed.
    expect(readOperatorNote(sessionId)).toBeUndefined()
  })

  test('PUT with non-string body → 400', async () => {
    const sessionId = `sess_e2e_${randomBytes(6).toString('hex')}`
    seedSession({ id: sessionId, email: VISITOR_EMAIL, tier: 1 })

    const headers = forgeAuthHeaders(ADMIN_EMAIL)
    const res = await fetch(notesUrl(sessionId), {
      method: 'PUT',
      headers,
      body: JSON.stringify({ body: 123 }),
    })
    expect(res.status).toBe(400)
  })
})

test.describe('operator notes — DELETE', () => {
  test.beforeEach(() => clearTestRows())

  test('admin DELETE on a present note → 200 + row gone', async () => {
    const sessionId = `sess_e2e_${randomBytes(6).toString('hex')}`
    seedSession({ id: sessionId, email: VISITOR_EMAIL, tier: 1 })
    seedOperatorNote({ sessionId, body: 'about to be removed' })

    const headers = forgeAuthHeaders(ADMIN_EMAIL)
    const res = await deleteNote(sessionId, headers)
    expect(res.status).toBe(200)
    const body = (await res.json()) as NoteResponseShape
    expect(body.note).toBeNull()
    expect(readOperatorNote(sessionId)).toBeUndefined()
  })

  test('admin DELETE is idempotent (no note → still 200)', async () => {
    const sessionId = `sess_e2e_${randomBytes(6).toString('hex')}`
    seedSession({ id: sessionId, email: VISITOR_EMAIL, tier: 1 })

    const headers = forgeAuthHeaders(ADMIN_EMAIL)
    const res = await deleteNote(sessionId, headers)
    expect(res.status).toBe(200)
    const body = (await res.json()) as NoteResponseShape
    expect(body.note).toBeNull()
  })
})
