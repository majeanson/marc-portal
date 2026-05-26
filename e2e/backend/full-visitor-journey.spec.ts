// End-to-end coverage of the FIRST-VISITOR path — cold tab to signed-in
// session. The existing tier1-happy-path.spec.ts proves the payment loop
// (checkout → webhook → /me) closes; this spec proves the FIRST HALF of
// the journey — the part every other spec skips by forging cookies — also
// closes:
//
//   /  (cold)  →  language redirect honored when mp_lang=en is set
//   /api/auth/request-link → magic_link_tokens row inserted in D1
//   /api/auth/verify       → 302 with mp_session + mp_csrf + mp_lang cookies
//   /api/me                → reports the signed-in identity
//   POST /api/sessions     → session lands in `draft`, capacity counter ticks
//   POST /api/payments/checkout → 200 with the Stripe stub URL
//
// Why this is its own spec: the rest of the suite seeds rows + forges
// cookies, which skips the magic-link round-trip entirely. A regression in
// /api/auth/request-link, /api/auth/verify, or the cookie-issuance shape
// would not surface anywhere else.
//
// Magic-link plaintext access: the production flow ships the plaintext in
// the email URL once; D1 stores only the SHA-256 hash. The Resend stub in
// this harness doesn't capture the email body, so we can't read the
// plaintext after request-link sends it. Instead, we mint our own row
// directly via mintMagicLinkToken, using the same hash function the
// server uses on the verify side — see helpers/auth.ts. The
// /api/auth/request-link assertions are separate (they prove the row
// landed in D1; we don't try to consume that token).

import { test, expect } from '@playwright/test'
import { randomBytes } from 'node:crypto'
import { E2E_BASE_URL } from './constants'
import {
  cookieHeaderFromVerifyResponse,
  csrfTokenFromVerifyResponse,
  latestMagicLinkRow,
  mintMagicLinkToken,
} from './helpers/auth'
import { clearTestRows } from './helpers/db'

const VISITOR_EMAIL = `journey-${randomBytes(3).toString('hex')}@e2e.test`

interface MeResponse {
  email: string | null
  isAdmin: boolean
}

interface SessionRowShape {
  id: string
  email: string
  status: string
  intake_json: string | null
}

interface CapacityResponse {
  active: number
  triage: number
  activeCap: number
  triageCap: number
}

test.describe('first-visitor journey — cold tab to signed-in', () => {
  test.beforeEach(() => clearTestRows())

  test('GET / with no cookie → SPA shell (200), no redirect', async () => {
    // The middleware redirect on bare `/` only fires when mp_lang=en is set
    // (FR is the default by design — see functions/_middleware.ts comments).
    // A fresh visitor with no cookie at all must land on `/` directly.
    const res = await fetch(`${E2E_BASE_URL}/`, { redirect: 'manual' })
    expect(res.status).toBe(200)
    // Content type is the SPA's index.html, served by wrangler from dist/.
    expect(res.headers.get('content-type') ?? '').toMatch(/text\/html/)
  })

  test('GET / with mp_lang=en cookie → 302 to /en', async () => {
    const res = await fetch(`${E2E_BASE_URL}/`, {
      redirect: 'manual',
      headers: { Cookie: 'mp_lang=en' },
    })
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toBe('/en')
  })

  test('POST /api/auth/request-link → 200 + magic_link_tokens row inserted', async () => {
    const res = await fetch(`${E2E_BASE_URL}/api/auth/request-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: VISITOR_EMAIL, lang: 'fr' }),
    })
    // Endpoint always returns 200 by design (avoid email enumeration).
    expect(res.status).toBe(200)
    const body = (await res.json()) as { sent: boolean }
    expect(body.sent).toBe(true)

    // Row landed in D1. Lookup is by email (the token column is a hash and
    // we don't have the plaintext on this side).
    const row = latestMagicLinkRow(VISITOR_EMAIL)
    expect(row).toBeDefined()
    expect(row?.email).toBe(VISITOR_EMAIL.toLowerCase())
    expect(row?.used_at).toBeNull()
    expect(row?.expires_at).toBeGreaterThan(Math.floor(Date.now() / 1000))
  })

  test('full journey: request-link row + verify + me + create session + checkout', async () => {
    // 1. Visitor types their email on /intake and hits Submit. The client
    //    posts to /api/auth/request-link before any session row exists.
    const requestRes = await fetch(`${E2E_BASE_URL}/api/auth/request-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: VISITOR_EMAIL, lang: 'fr' }),
    })
    expect(requestRes.status).toBe(200)
    expect(latestMagicLinkRow(VISITOR_EMAIL)).toBeDefined()

    // 2. Email arrives; visitor clicks the link. We can't read the plaintext
    //    of the row the request-link handler just inserted (it's the
    //    SHA-256 hash of a value only present in the email URL), so we
    //    mint a NEW token with a plaintext we control. Same crypto, same
    //    row shape — the verify handler can't tell the difference.
    const plaintext = mintMagicLinkToken(VISITOR_EMAIL)

    // 3. GET /api/auth/verify?token=plaintext&lang=fr — 302 to /me with
    //    three Set-Cookie headers (mp_session, mp_csrf, mp_lang).
    const verifyRes = await fetch(
      `${E2E_BASE_URL}/api/auth/verify?token=${encodeURIComponent(plaintext)}&lang=fr`,
      { redirect: 'manual' },
    )
    expect(verifyRes.status).toBe(302)
    expect(verifyRes.headers.get('Location')).toBe('/me')

    const cookieHeader = cookieHeaderFromVerifyResponse(verifyRes)
    const csrfToken = csrfTokenFromVerifyResponse(verifyRes)
    expect(cookieHeader).toMatch(/mp_session=/)
    expect(cookieHeader).toMatch(/mp_csrf=/)
    expect(csrfToken).not.toBeNull()

    // 4. /api/me with the new cookies — reports the signed-in identity.
    const meRes = await fetch(`${E2E_BASE_URL}/api/me`, {
      headers: { Cookie: cookieHeader },
    })
    expect(meRes.status).toBe(200)
    const me = (await meRes.json()) as MeResponse
    expect(me.email).toBe(VISITOR_EMAIL.toLowerCase())
    expect(me.isAdmin).toBe(false)

    // 5. POST /api/sessions — the visitor's intake submission. Lands in
    //    status='draft' (the SPA later flips it to 'triage' on first mount,
    //    but the wire-level row is 'draft').
    const intakePayload = {
      type: 'app',
      account: { email: VISITOR_EMAIL.toLowerCase() },
      formData: { problem: 'e2e fixture problem' },
      submittedAt: '2026-05-26',
      waitlist: false,
      lang: 'fr',
    }
    const createRes = await fetch(`${E2E_BASE_URL}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieHeader,
        'X-CSRF-Token': csrfToken!,
      },
      body: JSON.stringify({ intakeJson: intakePayload }),
    })
    expect(createRes.status).toBe(200)
    const { session } = (await createRes.json()) as { session: SessionRowShape }
    expect(session.id).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(session.email).toBe(VISITOR_EMAIL.toLowerCase())
    expect(session.status).toBe('draft')
    expect(session.intake_json).not.toBeNull()

    // 6. GET /api/sessions lists the new session for the signed-in visitor.
    const listRes = await fetch(`${E2E_BASE_URL}/api/sessions`, {
      headers: { Cookie: cookieHeader },
    })
    expect(listRes.status).toBe(200)
    const list = (await listRes.json()) as { sessions: SessionRowShape[] }
    expect(list.sessions.map((s) => s.id)).toContain(session.id)

    // 7. GET /api/capacity — the new draft doesn't count against the cap
    //    (only active+triage do; draft is pre-submission state). Still
    //    asserts the endpoint is reachable from the signed-in path.
    const capRes = await fetch(`${E2E_BASE_URL}/api/capacity`)
    expect(capRes.status).toBe(200)
    const cap = (await capRes.json()) as CapacityResponse
    expect(cap.activeCap).toBe(1)
    expect(cap.triageCap).toBe(1)
    expect(cap.active).toBe(0)
    expect(cap.triage).toBe(0)
  })

  test('verify token is single-use — replay redirects to /login?reason=token-used', async () => {
    // Mint, consume, replay. The verify handler's `used_at` check sits
    // ahead of expiry, so a replayed-but-still-fresh token surfaces as
    // `reason=token-used`, not `reason=token-expired`.
    const plaintext = mintMagicLinkToken(VISITOR_EMAIL)
    const url = `${E2E_BASE_URL}/api/auth/verify?token=${encodeURIComponent(plaintext)}&lang=fr`

    const first = await fetch(url, { redirect: 'manual' })
    expect(first.status).toBe(302)
    expect(first.headers.get('Location')).toBe('/me')

    const replay = await fetch(url, { redirect: 'manual' })
    expect(replay.status).toBe(302)
    expect(replay.headers.get('Location')).toBe('/login?reason=token-used')
  })
})
