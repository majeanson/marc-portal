// Synthesize a Svix-signed Resend webhook delivery and POST it to
// /api/webhooks/resend. The portal's handler verifies every event via
// functions/_lib/resendWebhook.ts (verifyResendSignature) — we reproduce
// the v1 signing scheme byte-for-byte so the running server accepts our
// synthetic POSTs.
//
// Svix signing format:
//   signed = `${svix_id}.${svix_timestamp}.${raw_body}`
//   sig    = base64(hmacSha256(decoded_secret_bytes, signed))
//   header svix-signature = `v1,${sig}` (space-separated list; single v1 sig today)
//
// The secret ships as `whsec_<base64_bytes>`; the prefix is stripped and the
// remainder base64-decoded to get the raw HMAC key. The handler tolerates
// an unprefixed secret too (matches Svix's own behavior).

import { createHmac, randomUUID } from 'node:crypto'
import { E2E_BASE_URL, E2E_BINDINGS } from '../constants'

const SECRET = E2E_BINDINGS.RESEND_WEBHOOK_SECRET

function decodeSecret(secret: string): Buffer {
  const stripped = secret.startsWith('whsec_') ? secret.slice(6) : secret
  return Buffer.from(stripped, 'base64')
}

interface SignOpts {
  /** Override the Svix event id. Defaults to a fresh UUID. */
  id?: string
  /** Override the timestamp (unix seconds). Defaults to now. Pass a
   *  past value > 5 minutes to drive the stale-timestamp rejection. */
  timestampSeconds?: number
  /** Sign with a different secret to drive the signature-mismatch path. */
  badSecret?: string
}

export interface ResendSigned {
  id: string
  timestamp: number
  body: string
  headers: Record<string, string>
}

/**
 * Sign a raw JSON body with the configured (or overridden) secret and
 * return the headers + meta the spec needs. Pass the result's `body` and
 * `headers` to fetch().
 */
export function signResendWebhook(rawBody: string, opts: SignOpts = {}): ResendSigned {
  const id = opts.id ?? `msg_${randomUUID()}`
  const timestamp = opts.timestampSeconds ?? Math.floor(Date.now() / 1000)
  const keyBytes = decodeSecret(opts.badSecret ?? SECRET)
  const signed = `${id}.${timestamp}.${rawBody}`
  const sig = createHmac('sha256', keyBytes).update(signed, 'utf8').digest('base64')
  return {
    id,
    timestamp,
    body: rawBody,
    headers: {
      'Content-Type': 'application/json',
      'svix-id': id,
      'svix-timestamp': String(timestamp),
      'svix-signature': `v1,${sig}`,
    },
  }
}

/**
 * Convenience: build a minimal `email.bounced` event body. Resend nests the
 * bounce subtype inside `data.bounce.type` ('Permanent' | 'Transient') —
 * we mirror that shape so the handler's `extractSubtype` returns 'permanent'
 * by default.
 */
export function makeResendBouncedEvent(args: {
  to: string
  bounceType?: 'Permanent' | 'Transient'
}): Record<string, unknown> {
  return {
    type: 'email.bounced',
    created_at: new Date().toISOString(),
    data: {
      to: [args.to],
      from: 'marc@marcportal.com',
      subject: 'magic link',
      bounce: { type: args.bounceType ?? 'Permanent', message: 'permanent fail' },
    },
  }
}

export function makeResendComplainedEvent(args: { to: string }): Record<string, unknown> {
  return {
    type: 'email.complained',
    created_at: new Date().toISOString(),
    data: { to: [args.to], from: 'marc@marcportal.com', subject: 'magic link' },
  }
}

export function makeResendDeliveredEvent(args: { to: string }): Record<string, unknown> {
  return {
    type: 'email.delivered',
    created_at: new Date().toISOString(),
    data: { to: [args.to], from: 'marc@marcportal.com', subject: 'magic link' },
  }
}

export function makeResendSentEvent(args: { to: string }): Record<string, unknown> {
  return {
    type: 'email.sent',
    created_at: new Date().toISOString(),
    data: { to: [args.to], from: 'marc@marcportal.com', subject: 'magic link' },
  }
}

/** POST a signed event to /api/webhooks/resend. Returns the fetch Response. */
export async function deliverResendWebhook(
  event: Record<string, unknown>,
  opts: SignOpts = {},
): Promise<Response> {
  const body = JSON.stringify(event)
  const signed = signResendWebhook(body, opts)
  return await fetch(`${E2E_BASE_URL}/api/webhooks/resend`, {
    method: 'POST',
    headers: signed.headers,
    body: signed.body,
  })
}
