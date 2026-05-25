/**
 * Stateless unsubscribe token tests. The token is HMAC over the lowercased
 * email under SESSION_SECRET; same email → same token (stable), different
 * email → different token, tampered token → reject.
 */

import { describe, expect, it } from 'vitest'
import { signUnsubscribeToken, unsubscribeUrl, verifyUnsubscribeToken } from './unsubscribe'

const SECRET = '0'.repeat(64)

describe('signUnsubscribeToken + verifyUnsubscribeToken', () => {
  it('round-trips for the same email', async () => {
    const t = await signUnsubscribeToken(SECRET, 'v@x.com')
    expect(await verifyUnsubscribeToken(SECRET, 'v@x.com', t)).toBe(true)
  })

  it('is case-insensitive on the email', async () => {
    const t = await signUnsubscribeToken(SECRET, 'V@X.COM')
    expect(await verifyUnsubscribeToken(SECRET, 'v@x.com', t)).toBe(true)
  })

  it('rejects a token signed for a different email', async () => {
    const t = await signUnsubscribeToken(SECRET, 'a@x.com')
    expect(await verifyUnsubscribeToken(SECRET, 'b@x.com', t)).toBe(false)
  })

  it('rejects a token signed with a different secret', async () => {
    const t = await signUnsubscribeToken(SECRET, 'v@x.com')
    const other = '1'.repeat(64)
    expect(await verifyUnsubscribeToken(other, 'v@x.com', t)).toBe(false)
  })

  it('rejects a tampered (truncated / extended) token', async () => {
    const t = await signUnsubscribeToken(SECRET, 'v@x.com')
    expect(await verifyUnsubscribeToken(SECRET, 'v@x.com', t.slice(0, -2))).toBe(false)
    expect(await verifyUnsubscribeToken(SECRET, 'v@x.com', t + 'AA')).toBe(false)
  })

  it('rejects empty inputs', async () => {
    expect(await verifyUnsubscribeToken(SECRET, '', 'something')).toBe(false)
    expect(await verifyUnsubscribeToken(SECRET, 'v@x.com', '')).toBe(false)
  })

  it('rejects malformed base64url tokens without throwing', async () => {
    // Garbage characters that atob would tolerate but produce wrong bytes.
    expect(await verifyUnsubscribeToken(SECRET, 'v@x.com', '!!!not-base64!!!')).toBe(false)
  })

  it('produces a stable token across calls for the same email', async () => {
    const a = await signUnsubscribeToken(SECRET, 'v@x.com')
    const b = await signUnsubscribeToken(SECRET, 'v@x.com')
    expect(a).toBe(b)
  })
})

describe('unsubscribeUrl', () => {
  it('builds a URL with email + token query params, email lowercased', async () => {
    const t = await signUnsubscribeToken(SECRET, 'V@X.COM')
    const url = unsubscribeUrl('https://marcportal.com', 'V@X.COM', t)
    const parsed = new URL(url)
    expect(parsed.origin).toBe('https://marcportal.com')
    expect(parsed.pathname).toBe('/api/unsubscribe')
    expect(parsed.searchParams.get('email')).toBe('v@x.com')
    expect(parsed.searchParams.get('token')).toBe(t)
  })
})
