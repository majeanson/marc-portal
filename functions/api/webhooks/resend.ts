// POST /api/webhooks/resend — Resend → us (AUDIT P1.2).
//
// Auth: Svix-style HMAC over the raw body using RESEND_WEBHOOK_SECRET.
// CSRF-exempt (see _middleware.ts) — the caller is Resend, not a visitor.
//
// Events handled (writes one row to `email_events` per accepted event):
//   email.sent                 — informational, dropped (no row).
//   email.delivered            — log + ingest.
//   email.delivery_delayed     — ingest; future is-bouncing check will tolerate.
//   email.bounced              — ingest; the address-level signal that matters.
//   email.complained           — ingest; spam-complaint, same downstream effect.
//   email.opened, email.clicked — ingest at low cost, never used to gate sends.
//
// Idempotency: the webhook_events table (shared with Stripe) dedupes on the
// Svix event id. A Resend retry of the same event is a no-op.
//
// We return 200 on every non-signature failure so Resend doesn't retry into
// backoff — signature mismatch is the only hard 401 (those would be
// malicious / misconfigured and should NOT retry).
//
// Code-only landing: this handler is callable today but unconfigured. P1.1
// (DNS verification for marcportal.com) is the blocker that unblocks any
// real events flowing in. RUNBOOK §16 covers the Resend Dashboard +
// `wrangler secret put RESEND_WEBHOOK_SECRET` activation step.

import type { Env } from '../../_lib/env'
import { ok, serviceUnavailable, unauthorized } from '../../_lib/json'
import {
  recipientOf,
  verifyResendSignature,
  type ResendWebhookEvent,
} from '../../_lib/resendWebhook'

/** Events we persist a row for. `email.sent` is purely informational
 *  (mirror of our own outbound), so we don't store it. */
const INGEST_TYPES = new Set([
  'email.delivered',
  'email.delivery_delayed',
  'email.bounced',
  'email.complained',
  'email.opened',
  'email.clicked',
])

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.RESEND_WEBHOOK_SECRET) {
    // Endpoint is reachable but un-configured — refuse loudly so a real
    // event doesn't get silently dropped. Same shape as the Stripe webhook.
    return serviceUnavailable('resend webhook secret not configured')
  }

  // Svix signs the EXACT raw body — re-encoded JSON has different whitespace
  // and breaks the HMAC.
  const rawBody = await request.text()
  const now = Math.floor(Date.now() / 1000)
  const ctx = await verifyResendSignature(rawBody, request.headers, env.RESEND_WEBHOOK_SECRET, now)
  if (!ctx) return unauthorized('signature mismatch')

  let event: ResendWebhookEvent
  try {
    event = JSON.parse(rawBody) as ResendWebhookEvent
  } catch {
    // Malformed body but signature matched — log + 200 so Resend doesn't retry.
    console.error('resend webhook: signed body did not parse')
    return ok({ received: true })
  }

  // Event dedupe — the webhook_events table is shared with Stripe; the
  // event-id namespace is large enough that collisions are negligible. INSERT
  // OR IGNORE returns changes=0 on conflict (i.e. a Resend retry of an event
  // we already processed).
  const ins = await env.DB.prepare(
    `INSERT OR IGNORE INTO webhook_events (event_id, event_type, received_at)
     VALUES (?, ?, ?)`,
  )
    .bind(ctx.id, event.type ?? 'unknown', now)
    .run()
  const changes = (ins.meta as { changes?: number }).changes ?? 0
  if (changes === 0) {
    console.log(`resend webhook: duplicate event ${ctx.id} (${event.type}); skipping`)
    return ok({ received: true, duplicate: true })
  }

  // Drop informational events; we don't need a row per sent email (we
  // already log every successful Resend response in send()).
  if (!INGEST_TYPES.has(event.type)) {
    return ok({ received: true, ignored: true })
  }

  const to = recipientOf(event)
  if (!to) {
    console.warn(`resend webhook: event ${ctx.id} (${event.type}) missing recipient`)
    return ok({ received: true, ignored: 'no recipient' })
  }

  // Persist. The full payload rides as a TEXT column so a future audit /
  // analytics layer can mine the structured fields without a re-fetch.
  // Truncate at 16 KB defensively — the Resend payload is typically a few
  // hundred bytes; anything larger is anomalous and not worth bloating
  // the row.
  const payload = rawBody.length > 16_384 ? rawBody.slice(0, 16_384) : rawBody
  const subtype = extractSubtype(event)
  try {
    await env.DB.prepare(
      `INSERT INTO email_events (id, to_email, type, subtype, payload, received_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
      .bind(ctx.id, to, event.type, subtype, payload, now)
      .run()
  } catch (err) {
    // The dedupe already succeeded, so we won't try this row again. Log
    // for forensics — Resend will not retry, the operator finds it via
    // log search if it matters.
    console.error('resend webhook: email_events insert failed', err)
    return ok({ received: true, persisted: false })
  }

  return ok({ received: true, persisted: true, type: event.type, to })
}

/** Resend nests bounce details inside `data.bounce.type` for `email.bounced`.
 *  Extract it as a separate `subtype` column so the operator can filter
 *  "permanent bounces only" without parsing the payload TEXT — and so the
 *  suppression-list check (functions/_lib/emailSuppression.ts) can key on
 *  a column instead of scanning JSON.
 *
 *  Normalized values for bounces: 'permanent' | 'transient'.
 *  Resend's payload shape: `data.bounce = { type: 'Permanent'|'Transient', subType, message }`.
 *  Older / forward-compat keys (`bounce_type`, `reason`, `subtype` at the
 *  data root) are accepted as fallbacks. Returns null when no shape matches. */
function extractSubtype(event: ResendWebhookEvent): string | null {
  const data = event.data
  if (!data || typeof data !== 'object') return null
  // Current shape: data.bounce.type
  const bounce = (data as Record<string, unknown>).bounce
  if (bounce && typeof bounce === 'object') {
    const t = (bounce as Record<string, unknown>).type
    if (typeof t === 'string') return t.toLowerCase()
  }
  // Legacy / forward-compat fallbacks.
  const candidates = ['bounce_type', 'reason', 'subtype'] as const
  for (const key of candidates) {
    const v = (data as Record<string, unknown>)[key]
    if (typeof v === 'string') return v
  }
  return null
}
