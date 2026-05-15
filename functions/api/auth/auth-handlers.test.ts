/**
 * Magic-link request + verify flow.
 *
 * Coverage:
 *   - request-link stores SHA-256(token), not plaintext (anti at-rest leak)
 *   - verify hashes the URL token before lookup → roundtrip works
 *   - used token cannot be replayed (used_at gate)
 *   - expired token redirects to login with reason=token-expired
 *   - unknown token redirects to login with reason=unknown-token
 *   - rate-limit: 5/h per email is the cap; 6th is silently dropped (still 200)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sha256B64url } from '../../_lib/bytes'
import { makeMockEnv } from '../../../tests/d1-mock'

vi.mock('../../_lib/email', () => ({
  sendMagicLink: vi.fn().mockResolvedValue(true),
}))

import * as email from '../../_lib/email'
import { onRequestPost as requestLink } from './request-link'
import { onRequestGet as verify } from './verify'

beforeEach(() => {
  vi.clearAllMocks()
})

function postJson(url: string, body: unknown): Request {
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'CF-Connecting-IP': '203.0.113.1' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/auth/request-link', () => {
  it('returns sent:true and stores ONLY the SHA-256 hash of the token', async () => {
    const env = makeMockEnv()
    const ctx = {
      request: postJson('https://x.test/api/auth/request-link', {
        email: 'visitor@x.com',
        lang: 'fr',
      }),
      env,
      params: {},
    }
    const res = await requestLink(ctx as never)
    expect(res.status).toBe(200)
    const data = (await res.json()) as { sent: boolean }
    expect(data.sent).toBe(true)

    expect(email.sendMagicLink).toHaveBeenCalledOnce()
    // The plaintext token only travels in the email URL — pull it back out.
    const verifyUrl = (email.sendMagicLink as ReturnType<typeof vi.fn>).mock.calls[0]![2] as string
    const plaintext = new URL(verifyUrl).searchParams.get('token')!
    expect(plaintext).toBeTruthy()

    const stored = [...env._db.magic_link_tokens.values()]
    expect(stored).toHaveLength(1)
    // Critical invariant: the DB has the HASH, not the plaintext.
    expect(stored[0]!.token).not.toBe(plaintext)
    expect(stored[0]!.token).toBe(await sha256B64url(plaintext))
  })

  it('still 200 on bad email (no enumeration leak), no row inserted', async () => {
    const env = makeMockEnv()
    const ctx = {
      request: postJson('https://x.test/api/auth/request-link', {
        email: 'not-an-email',
        lang: 'fr',
      }),
      env,
      params: {},
    }
    const res = await requestLink(ctx as never)
    expect(res.status).toBe(200)
    expect(env._db.magic_link_tokens.size).toBe(0)
    expect(email.sendMagicLink).not.toHaveBeenCalled()
  })

  it('rate-limit: 5/h per email; 6th is silently dropped (still 200, no email)', async () => {
    const env = makeMockEnv()
    for (let i = 0; i < 6; i++) {
      const ctx = {
        request: postJson('https://x.test/api/auth/request-link', {
          email: 'visitor@x.com',
          lang: 'fr',
        }),
        env,
        params: {},
      }
      const res = await requestLink(ctx as never)
      expect(res.status).toBe(200)
    }
    // 5 emails went out; the 6th was silently dropped.
    expect((email.sendMagicLink as ReturnType<typeof vi.fn>).mock.calls.length).toBe(5)
  })

  it('rate-limit: 20/h per IP catches rotating-email attacker', async () => {
    // Same IP, different email each request. Stays under the 5/h email cap
    // but should still trip the 20/h IP ceiling on request 21.
    const env = makeMockEnv()
    for (let i = 0; i < 21; i++) {
      const ctx = {
        request: postJson('https://x.test/api/auth/request-link', {
          email: `attacker-${i}@x.com`,
          lang: 'fr',
        }),
        env,
        params: {},
      }
      const res = await requestLink(ctx as never)
      expect(res.status).toBe(200)
    }
    // 20 emails went out; the 21st was silently dropped by the IP ceiling.
    expect((email.sendMagicLink as ReturnType<typeof vi.fn>).mock.calls.length).toBe(20)
  })
})

describe('GET /api/auth/verify', () => {
  async function seedToken(
    env: ReturnType<typeof makeMockEnv>,
    over: { plaintext?: string; expires_at?: number; used_at?: number | null; email?: string } = {},
  ): Promise<string> {
    const plaintext = over.plaintext ?? 'fresh-token-abc'
    const hash = await sha256B64url(plaintext)
    const now = Math.floor(Date.now() / 1000)
    env._db.magic_link_tokens.set(hash, {
      token: hash,
      email: over.email ?? 'visitor@x.com',
      expires_at: over.expires_at ?? now + 600,
      used_at: over.used_at ?? null,
      created_at: now,
      ip: '203.0.113.1',
    })
    return plaintext
  }

  function getCtx(token: string, env: ReturnType<typeof makeMockEnv>) {
    return {
      request: new Request(
        `https://x.test/api/auth/verify?token=${encodeURIComponent(token)}&lang=fr`,
      ),
      env,
      params: {},
    }
  }

  it('happy path: 302 to /me and marks token used', async () => {
    const env = makeMockEnv()
    const plaintext = await seedToken(env)

    const res = await verify(getCtx(plaintext, env) as never)
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toBe('/me')
    // The token row is now used. (Cookie issuance is exercised in auth.test.ts;
    // happy-dom filters Set-Cookie from Response.headers so we don't assert here.)
    const hash = await sha256B64url(plaintext)
    expect(env._db.magic_link_tokens.get(hash)?.used_at).toBeTypeOf('number')
  })

  it('admin email lands on /admin/inbox', async () => {
    const env = makeMockEnv()
    const plaintext = await seedToken(env, { email: 'marc@x.com' })

    const res = await verify(getCtx(plaintext, env) as never)
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toBe('/admin/inbox')
  })

  it('used token cannot be replayed', async () => {
    const env = makeMockEnv()
    const plaintext = await seedToken(env, { used_at: 1 })

    const res = await verify(getCtx(plaintext, env) as never)
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toBe('/login?reason=token-used')
    expect(res.headers.get('Set-Cookie')).toBeNull()
  })

  it('expired token redirects with reason=token-expired', async () => {
    const env = makeMockEnv()
    const plaintext = await seedToken(env, { expires_at: 1 })

    const res = await verify(getCtx(plaintext, env) as never)
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toBe('/login?reason=token-expired')
  })

  it('unknown token redirects with reason=unknown-token', async () => {
    const env = makeMockEnv()

    const res = await verify(getCtx('never-issued', env) as never)
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toBe('/login?reason=unknown-token')
  })

  it('missing token redirects with reason=missing-token', async () => {
    const env = makeMockEnv()
    const ctx = {
      request: new Request('https://x.test/api/auth/verify?lang=fr'),
      env,
      params: {},
    }
    const res = await verify(ctx as never)
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toBe('/login?reason=missing-token')
  })
})
