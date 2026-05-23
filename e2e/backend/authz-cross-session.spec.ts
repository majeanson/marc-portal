// Cross-session authorization. The visitor cookie for session A must not be
// able to act on session B; admin must be able to act on any session;
// soft-deleted sessions must 404 (visitor and admin alike, because
// loadSession's null + deleted_at check sits before the access gate).
//
// canAccessSession lives in functions/_lib/sessions.ts:
//   - visitor matches when email == session.email
//   - admin matches when ADMIN_EMAILS contains email (regardless of session.email)

import { test, expect } from '@playwright/test'
import { randomBytes } from 'node:crypto'
import { E2E_BASE_URL, E2E_BINDINGS } from './constants'
import { forgeAuthHeaders } from './helpers/auth'
import { clearTestRows, readPayment, seedSession } from './helpers/db'

const ADMIN_EMAIL = E2E_BINDINGS.ADMIN_EMAILS // 'admin@e2e.test' — single admin

async function postCheckout(headers: Record<string, string>, body: object): Promise<Response> {
  return await fetch(`${E2E_BASE_URL}/api/payments/checkout`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
}

test.describe('authz: cross-session + soft-deleted', () => {
  test.beforeEach(() => clearTestRows())

  test("visitor A cannot mint a checkout for visitor B's session → 403", async () => {
    const sessionA = `sess_e2e_${randomBytes(6).toString('hex')}`
    const sessionB = `sess_e2e_${randomBytes(6).toString('hex')}`
    seedSession({ id: sessionA, email: 'a@e2e.test', tier: 1 })
    seedSession({ id: sessionB, email: 'b@e2e.test', tier: 1 })

    const headersA = forgeAuthHeaders('a@e2e.test')
    const res = await postCheckout(headersA, { sessionId: sessionB, kind: 'build' })
    expect(res.status).toBe(403)
  })

  test("admin can mint a checkout for any visitor's session → 200", async () => {
    const sessionB = `sess_e2e_${randomBytes(6).toString('hex')}`
    seedSession({ id: sessionB, email: 'b@e2e.test', tier: 1 })

    const headers = forgeAuthHeaders(ADMIN_EMAIL)
    const res = await postCheckout(headers, { sessionId: sessionB, kind: 'build' })
    expect(res.status).toBe(200)
    const { paymentId } = (await res.json()) as { paymentId: string }
    // Row landed on session B (not on admin's own session — admin doesn't have one).
    const row = readPayment(paymentId)
    expect(row?.session_id).toBe(sessionB)
  })

  test('soft-deleted session → 404 (even for the visitor who owns it)', async () => {
    const sessionId = `sess_e2e_${randomBytes(6).toString('hex')}`
    const email = 'visitor-soft-del@e2e.test'
    seedSession({
      id: sessionId,
      email,
      tier: 1,
      deletedAt: Math.floor(Date.now() / 1000) - 60,
    })

    const headers = forgeAuthHeaders(email)
    const res = await postCheckout(headers, { sessionId, kind: 'build' })
    expect(res.status).toBe(404)
  })

  test('non-existent session id → 404', async () => {
    const headers = forgeAuthHeaders('a@e2e.test')
    const res = await postCheckout(headers, {
      sessionId: 'sess_does_not_exist',
      kind: 'build',
    })
    expect(res.status).toBe(404)
  })
})
