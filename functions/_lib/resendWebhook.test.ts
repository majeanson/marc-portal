/**
 * Svix-style signature verifier tests (AUDIT P1.2 — Resend bounce webhooks).
 * No real Resend call; we sign payloads with a known secret and confirm
 * the verifier accepts the matching sig, rejects forgeries, and enforces
 * the timestamp tolerance.
 */

import { describe, expect, it } from 'vitest'
import { recipientOf, verifyResendSignature, type ResendWebhookEvent } from './resendWebhook'

// Known good base64 key + secret used by every test. Standard base64 (not
// URL-safe), the same encoding Svix accepts after stripping `whsec_`.
const KNOWN_KEY = 'c2VjcmV0LWZvci10ZXN0LWVtYWlsLWV2ZW50cy12ZXJpZmllcg=='
const WHSEC_KEY = `whsec_${KNOWN_KEY}`

/** Build a valid Svix-style signature header for the given payload + id +
 *  timestamp + secret. Mirrors what Resend's outbound signer does. */
async function signFixture(
  id: string,
  timestamp: number,
  body: string,
  secret: string,
): Promise<string> {
  const rawSecret = secret.startsWith('whsec_') ? secret.slice(6) : secret
  const keyBytes = Uint8Array.from(atob(rawSecret), (c) => c.charCodeAt(0))
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    new TextEncoder().encode(`${id}.${timestamp}.${body}`),
  )
  let binary = ''
  const bytes = new Uint8Array(sig)
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!)
  return `v1,${btoa(binary)}`
}

describe('verifyResendSignature', () => {
  it('accepts a fresh, correctly-signed payload', async () => {
    const id = 'msg_abc123'
    const ts = 1_700_000_000
    const body = JSON.stringify({ type: 'email.bounced', data: { to: 'v@x.com' } })
    const sig = await signFixture(id, ts, body, WHSEC_KEY)
    const headers = new Headers({
      'svix-id': id,
      'svix-timestamp': String(ts),
      'svix-signature': sig,
    })
    const ctx = await verifyResendSignature(body, headers, WHSEC_KEY, ts)
    expect(ctx).toEqual({ id, timestamp: ts })
  })

  it('accepts the secret without the whsec_ prefix too', async () => {
    const id = 'msg_no_prefix'
    const ts = 1_700_000_000
    const body = '{}'
    const sig = await signFixture(id, ts, body, KNOWN_KEY)
    const headers = new Headers({
      'svix-id': id,
      'svix-timestamp': String(ts),
      'svix-signature': sig,
    })
    expect(await verifyResendSignature(body, headers, KNOWN_KEY, ts)).toEqual({ id, timestamp: ts })
  })

  it('rejects a tampered body', async () => {
    const id = 'msg_tamper'
    const ts = 1_700_000_000
    const sig = await signFixture(id, ts, '{"original":true}', WHSEC_KEY)
    const headers = new Headers({
      'svix-id': id,
      'svix-timestamp': String(ts),
      'svix-signature': sig,
    })
    // Body bytes don't match what we signed.
    expect(await verifyResendSignature('{"changed":true}', headers, WHSEC_KEY, ts)).toBeNull()
  })

  it('rejects a wrong secret', async () => {
    const id = 'msg_wrong'
    const ts = 1_700_000_000
    const body = '{}'
    const sig = await signFixture(id, ts, body, WHSEC_KEY)
    const headers = new Headers({
      'svix-id': id,
      'svix-timestamp': String(ts),
      'svix-signature': sig,
    })
    const otherSecret = `whsec_${btoa('a-different-secret-of-some-length')}`
    expect(await verifyResendSignature(body, headers, otherSecret, ts)).toBeNull()
  })

  it('rejects a stale timestamp (replay attack outside the 5-minute window)', async () => {
    const id = 'msg_stale'
    const tsSigned = 1_700_000_000
    const body = '{}'
    const sig = await signFixture(id, tsSigned, body, WHSEC_KEY)
    const headers = new Headers({
      'svix-id': id,
      'svix-timestamp': String(tsSigned),
      'svix-signature': sig,
    })
    // Verifier asked at "now" 10 minutes after the signed timestamp.
    const tsNow = tsSigned + 10 * 60
    expect(await verifyResendSignature(body, headers, WHSEC_KEY, tsNow)).toBeNull()
  })

  it('rejects when required headers are missing', async () => {
    const empty = new Headers()
    expect(await verifyResendSignature('{}', empty, WHSEC_KEY, 1_700_000_000)).toBeNull()
  })

  it('accepts a rotated header that carries multiple v1 sigs (any-match)', async () => {
    const id = 'msg_rot'
    const ts = 1_700_000_000
    const body = '{}'
    const goodSig = await signFixture(id, ts, body, WHSEC_KEY)
    // Pretend an old-key sig also rides on the header.
    const headerWithRotation = `v1,not-the-right-base64-sig= ${goodSig}`
    const headers = new Headers({
      'svix-id': id,
      'svix-timestamp': String(ts),
      'svix-signature': headerWithRotation,
    })
    expect(await verifyResendSignature(body, headers, WHSEC_KEY, ts)).toEqual({ id, timestamp: ts })
  })
})

describe('recipientOf', () => {
  it('extracts a string-shaped to', () => {
    const e: ResendWebhookEvent = { type: 'email.bounced', data: { to: 'v@x.com' } }
    expect(recipientOf(e)).toBe('v@x.com')
  })
  it('extracts the first entry of an array-shaped to', () => {
    const e: ResendWebhookEvent = { type: 'email.bounced', data: { to: ['v@x.com', 'extra@x'] } }
    expect(recipientOf(e)).toBe('v@x.com')
  })
  it('returns null when data or to is missing', () => {
    expect(recipientOf({ type: 'email.bounced' })).toBeNull()
    expect(recipientOf({ type: 'email.bounced', data: {} })).toBeNull()
    expect(recipientOf({ type: 'email.bounced', data: { to: [] } })).toBeNull()
  })
})
