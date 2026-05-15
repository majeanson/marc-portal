/**
 * HMAC session cookie + SESSION_SECRET boot guard.
 *
 * Coverage:
 *   - sign/verify roundtrip succeeds
 *   - tampered signature → null
 *   - expired payload → null
 *   - empty / missing / too-short SESSION_SECRET → throws (boot guard)
 *   - isPlausibleEmail edges
 */

import { describe, expect, it } from 'vitest'
import {
  SessionSecretMisconfiguredError,
  isPlausibleEmail,
  newCsrfToken,
  requireSessionSecret,
  signSessionCookie,
  verifyCsrf,
  verifySessionCookie,
} from './auth'

const STRONG_SECRET = '0'.repeat(64) // 64 chars satisfies the >= 32 floor

describe('signSessionCookie + verifySessionCookie', () => {
  it('roundtrips an email', async () => {
    const cookie = await signSessionCookie(STRONG_SECRET, 'visitor@x.com')
    const payload = await verifySessionCookie(STRONG_SECRET, cookie)
    expect(payload?.e).toBe('visitor@x.com')
    expect(typeof payload?.x).toBe('number')
  })

  it('lowercases the email on sign', async () => {
    const cookie = await signSessionCookie(STRONG_SECRET, 'Visitor@X.COM')
    const payload = await verifySessionCookie(STRONG_SECRET, cookie)
    expect(payload?.e).toBe('visitor@x.com')
  })

  it('returns null on tampered signature', async () => {
    const cookie = await signSessionCookie(STRONG_SECRET, 'visitor@x.com')
    const [head, sig] = cookie.split('.')
    // Flip the FIRST char of the sig. The last char of a 32-byte HMAC encodes
    // only 4 data bits + 2 padding bits, so an A↔B swap there can decode to
    // identical bytes and the HMAC still verifies. The first char is always
    // 6 data bits, so any change there guarantees different bytes.
    const flipped = (sig![0] === 'A' ? 'B' : 'A') + sig!.slice(1)
    const tampered = `${head}.${flipped}`
    const payload = await verifySessionCookie(STRONG_SECRET, tampered)
    expect(payload).toBeNull()
  })

  it('returns null when verified with a different secret', async () => {
    const cookie = await signSessionCookie(STRONG_SECRET, 'visitor@x.com')
    const wrong = '1'.repeat(64)
    const payload = await verifySessionCookie(wrong, cookie)
    expect(payload).toBeNull()
  })

  it('returns null on malformed cookie shape', async () => {
    expect(await verifySessionCookie(STRONG_SECRET, '')).toBeNull()
    expect(await verifySessionCookie(STRONG_SECRET, 'no-dot-here')).toBeNull()
    expect(await verifySessionCookie(STRONG_SECRET, 'a.b.c')).toBeNull()
  })
})

describe('requireSessionSecret (boot guard)', () => {
  it('passes through a strong secret', () => {
    expect(requireSessionSecret(STRONG_SECRET)).toBe(STRONG_SECRET)
  })

  it('throws on missing secret', () => {
    expect(() => requireSessionSecret(undefined)).toThrowError(SessionSecretMisconfiguredError)
    expect(() => requireSessionSecret(null)).toThrowError(SessionSecretMisconfiguredError)
  })

  it('throws on empty secret', () => {
    expect(() => requireSessionSecret('')).toThrowError(SessionSecretMisconfiguredError)
  })

  it('throws on too-short secret', () => {
    expect(() => requireSessionSecret('short')).toThrowError(SessionSecretMisconfiguredError)
    expect(() => requireSessionSecret('a'.repeat(31))).toThrowError(SessionSecretMisconfiguredError)
  })

  it('signSessionCookie refuses a missing secret', async () => {
    await expect(signSessionCookie('', 'a@b.com')).rejects.toThrow(SessionSecretMisconfiguredError)
  })
})

describe('verifyCsrf (double-submit cookie)', () => {
  // happy-dom strips the `Cookie` header from Request init (forbidden header
  // for fetch in browsers). Stub the .headers.get() surface verifyCsrf reads
  // so the test stays portable across runtimes.
  function reqWith(cookie: string | null, header: string | null): Request {
    return {
      headers: {
        get(name: string) {
          const norm = name.toLowerCase()
          if (norm === 'cookie') return cookie
          if (norm === 'x-csrf-token') return header
          return null
        },
      },
    } as unknown as Request
  }

  it('passes when cookie and header are present and equal', () => {
    const token = newCsrfToken()
    expect(verifyCsrf(reqWith(`mp_csrf=${token}`, token))).toBe(true)
  })

  it('fails on missing header', () => {
    const token = newCsrfToken()
    expect(verifyCsrf(reqWith(`mp_csrf=${token}`, null))).toBe(false)
  })

  it('fails on missing cookie', () => {
    const token = newCsrfToken()
    expect(verifyCsrf(reqWith(null, token))).toBe(false)
  })

  it('fails on mismatched values', () => {
    const a = newCsrfToken()
    const b = newCsrfToken()
    expect(verifyCsrf(reqWith(`mp_csrf=${a}`, b))).toBe(false)
  })

  it('fails on length mismatch (early-exit)', () => {
    expect(verifyCsrf(reqWith('mp_csrf=abc', 'abcd'))).toBe(false)
  })

  it('ignores other cookies', () => {
    const token = newCsrfToken()
    expect(verifyCsrf(reqWith(`mp_session=foo; mp_csrf=${token}; other=x`, token))).toBe(true)
  })
})

describe('isPlausibleEmail', () => {
  it('accepts ordinary addresses', () => {
    expect(isPlausibleEmail('a@b.co')).toBe(true)
    expect(isPlausibleEmail('marc.jeanson@example.com')).toBe(true)
  })
  it('rejects whitespace, missing parts, bare TLDs', () => {
    expect(isPlausibleEmail('a b@c.com')).toBe(false)
    expect(isPlausibleEmail('a@b')).toBe(false)
    expect(isPlausibleEmail('@b.com')).toBe(false)
    expect(isPlausibleEmail('a@.com')).toBe(false)
  })
  it('rejects very long inputs', () => {
    expect(isPlausibleEmail('a'.repeat(255) + '@b.com')).toBe(false)
  })
})
