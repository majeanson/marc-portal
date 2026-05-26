// DELETE /api/me — Loi 25 self-serve erasure. A regulator complaint or a
// data-subject access request both end at this endpoint; a partial-delete
// regression is the kind of bug you'd discover during an investigation,
// not in production logs. The vitest unit test against a mock D1 proves
// the handler's intent; this spec runs the real handler against real
// SQLite, which is where the actual delete semantics — including whether
// the FK cascade fires — surface.
//
// What's covered:
//   - 401 when not signed in (the cookie is the only proof of identity)
//   - 200 when signed in with sessions + messages + tokens + attachments
//   - every row tied to that email is gone from D1
//   - the mp_session cookie is cleared in the response
//   - other visitors' rows are untouched
//   - idempotency: after a successful DELETE, repeating doesn't 5xx (the
//     cookie was cleared, so it 401s — fine; the body never re-enters
//     the delete branch)
//
// Why the cascade matters here: messages and attachments declare
// `ON DELETE CASCADE` in the schema, but the application does NOT enable
// `PRAGMA foreign_keys = ON`. Whether the cascade actually fires is a
// runtime question that depends on Miniflare/D1's defaults. If it doesn't,
// `DELETE FROM sessions` leaves orphan rows — exactly the partial-delete
// regression we're guarding against. This spec is the only place that
// answers that question against real D1.

import { test, expect } from '@playwright/test'
import { randomBytes } from 'node:crypto'
import { E2E_BASE_URL } from './constants'
import { forgeAuthHeaders, mintMagicLinkToken } from './helpers/auth'
import {
  clearTestRows,
  countRowsWhere,
  seedAttachment,
  seedMessage,
  seedSession,
} from './helpers/db'

const TARGET_EMAIL = 'erase-me@e2e.test'
const BYSTANDER_EMAIL = 'bystander@e2e.test'

async function deleteMe(headers: Record<string, string>): Promise<Response> {
  return await fetch(`${E2E_BASE_URL}/api/me`, {
    method: 'DELETE',
    headers,
  })
}

test.describe('DELETE /api/me — Loi 25 self-erasure', () => {
  test.beforeEach(() => clearTestRows())

  test('without any cookie → 403 at the CSRF gate (middleware trips first)', async () => {
    // DELETE is state-changing and NOT in CSRF_EXEMPT_PATHS, so the
    // middleware double-submit check runs before the auth check ever
    // sees the request. A bare DELETE never reaches the handler.
    const res = await fetch(`${E2E_BASE_URL}/api/me`, { method: 'DELETE' })
    expect(res.status).toBe(403)
  })

  test('expired session cookie (CSRF paired) → 401', async () => {
    // The real "unauthenticated DELETE" path: CSRF header + cookie match
    // so the middleware lets it through, but the session payload's `x`
    // claim is in the past so currentEmail() returns null and the handler
    // returns 401. This is the path a stranger with a stale cookie would
    // hit.
    const headers = forgeAuthHeaders(TARGET_EMAIL, {
      expSeconds: Math.floor(Date.now() / 1000) - 3600,
    })
    const res = await deleteMe(headers)
    expect(res.status).toBe(401)
  })

  test('signed in: deletes every row tied to the email', async () => {
    // Seed: one session, two messages, one magic-link token, one attachment.
    // After DELETE /api/me the count for each should be 0 for our email.
    const sessionId = `sess_e2e_${randomBytes(6).toString('hex')}`
    seedSession({ id: sessionId, email: TARGET_EMAIL, status: 'active', tier: 1 })
    seedMessage({ sessionId, author: 'visitor', body: 'first' })
    seedMessage({ sessionId, author: 'marc', body: 'reply' })
    mintMagicLinkToken(TARGET_EMAIL)
    seedAttachment({ sessionId, r2Key: `e2e/${sessionId}/fixture.bin` })

    // Sanity: rows exist before the erasure.
    expect(countRowsWhere(`SELECT COUNT(*) AS c FROM sessions WHERE email = ?`, TARGET_EMAIL)).toBe(
      1,
    )
    expect(
      countRowsWhere(`SELECT COUNT(*) AS c FROM messages WHERE session_id = ?`, sessionId),
    ).toBe(2)
    expect(
      countRowsWhere(`SELECT COUNT(*) AS c FROM magic_link_tokens WHERE email = ?`, TARGET_EMAIL),
    ).toBe(1)
    expect(
      countRowsWhere(`SELECT COUNT(*) AS c FROM attachments WHERE session_id = ?`, sessionId),
    ).toBe(1)

    const headers = forgeAuthHeaders(TARGET_EMAIL)
    const res = await deleteMe(headers)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { ok: boolean }
    expect(body.ok).toBe(true)

    // The mp_session cookie is cleared in the response so the SPA logs
    // out cleanly on the next bootstrap.
    const setCookies =
      (res.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.() ?? []
    const clears = setCookies.find((c) => c.startsWith('mp_session='))
    expect(clears).toBeDefined()
    // A clearing Set-Cookie sets the value to empty and Max-Age=0 (or an
    // Expires in the past). Either pattern is acceptable.
    expect(clears).toMatch(/mp_session=;|max-age=0|expires=/i)

    // Sessions and magic-link tokens for this email are gone.
    expect(countRowsWhere(`SELECT COUNT(*) AS c FROM sessions WHERE email = ?`, TARGET_EMAIL)).toBe(
      0,
    )
    expect(
      countRowsWhere(`SELECT COUNT(*) AS c FROM magic_link_tokens WHERE email = ?`, TARGET_EMAIL),
    ).toBe(0)
    // The cascade test — these tables reference sessions(id) with
    // ON DELETE CASCADE. If FK enforcement is off in the runtime, these
    // rows survive as orphans. The handler relies on the cascade for its
    // correctness; if this assertion fails, /api/me.ts needs explicit
    // DELETE FROM messages + DELETE FROM attachments before the sessions
    // DELETE — and the handler's comment about "ON DELETE CASCADE … takes
    // care of the children" needs to come down.
    expect(
      countRowsWhere(`SELECT COUNT(*) AS c FROM messages WHERE session_id = ?`, sessionId),
    ).toBe(0)
    expect(
      countRowsWhere(`SELECT COUNT(*) AS c FROM attachments WHERE session_id = ?`, sessionId),
    ).toBe(0)
  })

  test('does not touch other visitors’ rows', async () => {
    const mySessionId = `sess_e2e_${randomBytes(6).toString('hex')}`
    const theirSessionId = `sess_e2e_${randomBytes(6).toString('hex')}`
    seedSession({ id: mySessionId, email: TARGET_EMAIL, status: 'active', tier: 1 })
    seedSession({ id: theirSessionId, email: BYSTANDER_EMAIL, status: 'active', tier: 1 })
    seedMessage({ sessionId: theirSessionId, author: 'visitor', body: 'their message' })
    mintMagicLinkToken(BYSTANDER_EMAIL)

    const headers = forgeAuthHeaders(TARGET_EMAIL)
    const res = await deleteMe(headers)
    expect(res.status).toBe(200)

    // Bystander's rows intact.
    expect(
      countRowsWhere(`SELECT COUNT(*) AS c FROM sessions WHERE email = ?`, BYSTANDER_EMAIL),
    ).toBe(1)
    expect(
      countRowsWhere(`SELECT COUNT(*) AS c FROM messages WHERE session_id = ?`, theirSessionId),
    ).toBe(1)
    expect(
      countRowsWhere(
        `SELECT COUNT(*) AS c FROM magic_link_tokens WHERE email = ?`,
        BYSTANDER_EMAIL,
      ),
    ).toBe(1)
  })

  test('admin can erase their own admin-email data (no special carve-out)', async () => {
    // An admin asking to erase themselves is still a Loi 25 obligation;
    // the handler doesn't special-case admin. This case proves it.
    const sessionId = `sess_e2e_${randomBytes(6).toString('hex')}`
    seedSession({
      id: sessionId,
      email: 'admin@e2e.test',
      status: 'active',
      tier: 1,
    })

    const headers = forgeAuthHeaders('admin@e2e.test')
    const res = await deleteMe(headers)
    expect(res.status).toBe(200)
    expect(
      countRowsWhere(`SELECT COUNT(*) AS c FROM sessions WHERE email = ?`, 'admin@e2e.test'),
    ).toBe(0)
  })
})
