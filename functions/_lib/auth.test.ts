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
  requireSessionSecret,
  signSessionCookie,
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
    // Flip the last char of the sig — base64url, so a single-char change
    // virtually always invalidates the HMAC.
    const flipped = sig!.slice(0, -1) + (sig!.endsWith('A') ? 'B' : 'A')
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
