// POST /api/vouches — anonymous, CSRF-exempt submission of a public-facing
// testimonial. The full-visitor-journey + magic-link flow guard the
// signed-in entry points; this is the one place a stranger can write to
// the DB without ever signing in, which is exactly why it's interesting
// from a security + abuse perspective.
//
// What's covered:
//   - validation per field (name length, email plausibility, body length,
//     relationship enum, link URL scheme, optional session_id existence)
//   - happy path inserts a row with status='pending' (moderation gate)
//   - CSRF-exempt: a POST without CSRF cookie or header still succeeds,
//     since /api/vouches is in CSRF_EXEMPT_PATHS by design
//   - rate-limit: too-many submissions per email returns 429 (the
//     handler tightens to 3/h per email, 5/h per IP — lower than the
//     5/h session-creation cap)
//
// What's NOT here:
//   - the Marc-notification email — Resend is stubbed, the handler
//     swallows the failure intentionally so an outage doesn't block
//     submissions
//   - admin moderation (GET / PATCH /api/admin/vouches) — orthogonal,
//     already has unit-test coverage via vouches-handlers.test.ts

import { test, expect } from '@playwright/test'
import { randomBytes } from 'node:crypto'
import { E2E_BASE_URL } from './constants'
import { clearTestRows, countVouchesFor, readLatestVouchFor, seedSession } from './helpers/db'

interface SubmitBody {
  authorName?: string
  authorEmail?: string
  relationship?: string
  body?: string
  linkUrl?: string | null
  sessionId?: string | null
}

function goodBody(overrides: Partial<SubmitBody> = {}): SubmitBody {
  // Valid baseline that satisfies every validator: name 11 chars, email
  // plausible, body well above the 30-char minimum, relationship in the
  // enum. Overrides flip one field at a time.
  return {
    authorName: 'Real Person',
    authorEmail: `voucher-${randomBytes(3).toString('hex')}@e2e.test`,
    relationship: 'client',
    body: 'Marc shipped my idea in a weekend and the result felt human.',
    ...overrides,
  }
}

async function submit(body: SubmitBody, opts: { csrfHeader?: string } = {}): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  // CSRF-exempt: by default we send NO Cookie + NO X-CSRF-Token to mirror
  // the anonymous-stranger case. Specs that want to assert "even with bogus
  // CSRF, still 200" pass csrfHeader explicitly.
  if (opts.csrfHeader !== undefined) headers['X-CSRF-Token'] = opts.csrfHeader
  return await fetch(`${E2E_BASE_URL}/api/vouches`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
}

test.describe('POST /api/vouches — field validation', () => {
  test.beforeEach(() => clearTestRows())

  test('missing name → 400', async () => {
    const res = await submit(goodBody({ authorName: undefined }))
    expect(res.status).toBe(400)
  })

  test('name too short → 400 (under VOUCH_LIMITS.nameMin = 2)', async () => {
    const res = await submit(goodBody({ authorName: 'X' }))
    expect(res.status).toBe(400)
  })

  test('name too long → 400 (over VOUCH_LIMITS.nameMax = 80)', async () => {
    const res = await submit(goodBody({ authorName: 'a'.repeat(81) }))
    expect(res.status).toBe(400)
  })

  test('invalid email → 400', async () => {
    const res = await submit(goodBody({ authorEmail: 'not-an-email' }))
    expect(res.status).toBe(400)
  })

  test('invalid relationship → 400 (not in client/colleague/friend/other)', async () => {
    const res = await submit(goodBody({ relationship: 'enemy' }))
    expect(res.status).toBe(400)
  })

  test('body too short → 400 (under VOUCH_LIMITS.bodyMin = 30)', async () => {
    const res = await submit(goodBody({ body: 'too short' }))
    expect(res.status).toBe(400)
  })

  test('body too long → 400 (over VOUCH_LIMITS.bodyMax = 600)', async () => {
    const res = await submit(goodBody({ body: 'a'.repeat(601) }))
    expect(res.status).toBe(400)
  })

  test('javascript: URL → 400 (defense vs host-confused renders)', async () => {
    const res = await submit(goodBody({ linkUrl: 'javascript:alert(1)' }))
    expect(res.status).toBe(400)
  })

  test('data: URL → 400', async () => {
    const res = await submit(goodBody({ linkUrl: 'data:text/html,hi' }))
    expect(res.status).toBe(400)
  })

  test('unknown session_id → 400 (soft FK existence check)', async () => {
    const res = await submit(goodBody({ sessionId: 'sess_does_not_exist' }))
    expect(res.status).toBe(400)
  })

  test('soft-deleted session_id → 400 (deleted_at IS NULL filter)', async () => {
    const sessionId = `sess_e2e_${randomBytes(6).toString('hex')}`
    seedSession({
      id: sessionId,
      email: 'soft-del@e2e.test',
      status: 'shipped',
      tier: 1,
      deletedAt: Math.floor(Date.now() / 1000) - 60,
    })
    const res = await submit(goodBody({ sessionId }))
    expect(res.status).toBe(400)
  })
})

test.describe('POST /api/vouches — happy path + moderation', () => {
  test.beforeEach(() => clearTestRows())

  test('valid submission → 200 + row inserted with status=pending', async () => {
    const email = `voucher-${randomBytes(3).toString('hex')}@e2e.test`
    const res = await submit(goodBody({ authorEmail: email }))
    expect(res.status).toBe(200)

    const row = readLatestVouchFor(email)
    expect(row).toBeDefined()
    expect(row?.status).toBe('pending') // moderation gate
    expect(row?.author_name).toBe('Real Person')
    expect(row?.author_email).toBe(email)
    expect(row?.author_relationship).toBe('client')
    expect(row?.approved_at).toBeNull()
    expect(row?.deleted_at).toBeNull()
  })

  test('valid submission with session_id attribution → row carries the id', async () => {
    const sessionId = `sess_e2e_${randomBytes(6).toString('hex')}`
    seedSession({
      id: sessionId,
      email: 'attributed@e2e.test',
      status: 'shipped',
      tier: 1,
    })

    const email = `voucher-${randomBytes(3).toString('hex')}@e2e.test`
    const res = await submit(goodBody({ authorEmail: email, sessionId }))
    expect(res.status).toBe(200)

    const row = readLatestVouchFor(email)
    expect(row?.session_id).toBe(sessionId)
  })

  test('valid https link → row stores it', async () => {
    const email = `voucher-${randomBytes(3).toString('hex')}@e2e.test`
    const res = await submit(
      goodBody({ authorEmail: email, linkUrl: 'https://example.com/portfolio' }),
    )
    expect(res.status).toBe(200)

    const row = readLatestVouchFor(email)
    expect(row?.link_url).toBe('https://example.com/portfolio')
  })
})

test.describe('POST /api/vouches — CSRF + rate limit', () => {
  test.beforeEach(() => clearTestRows())

  test('CSRF-exempt: succeeds with no Cookie + no X-CSRF-Token', async () => {
    // This case proves /api/vouches is in CSRF_EXEMPT_PATHS. If a future
    // tightening moves it out without updating the SPA submitter, this
    // assertion goes red.
    const email = `voucher-${randomBytes(3).toString('hex')}@e2e.test`
    const res = await submit(goodBody({ authorEmail: email }))
    expect(res.status).toBe(200)
    expect(countVouchesFor(email)).toBe(1)
  })

  test('per-email rate limit (3/h): 4th submission → 429', async () => {
    // The handler tightens to 3/h per submitter email. We submit 3 valid
    // payloads with the same email + IP, expecting them to land; the 4th
    // should 429 *and* not write a row.
    const email = `bursty-${randomBytes(3).toString('hex')}@e2e.test`
    for (let i = 0; i < 3; i++) {
      const res = await submit(goodBody({ authorEmail: email }))
      expect(res.status).toBe(200)
    }
    const fourth = await submit(goodBody({ authorEmail: email }))
    expect(fourth.status).toBe(429)
    expect(countVouchesFor(email)).toBe(3) // still 3
  })
})
