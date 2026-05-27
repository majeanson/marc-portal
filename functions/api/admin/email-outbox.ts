// GET  /api/admin/email-outbox      — pending + stuck outbox rows for /admin/email-outbox.
// POST /api/admin/email-outbox      — { id } manually retry one row.
//
// The daily digest's sweepEmailOutbox sweeps these automatically with
// exponential backoff up to OUTBOX_MAX_ATTEMPTS. After that, rows sit
// silently until someone investigates. This endpoint is the operator's
// hands-on path: list the stuck rows, retry one with the cap bypassed.
// Manual retry is an explicit intent — we don't honor the backoff window
// or the attempt ceiling here.

import { currentEmail } from '../../_lib/auth'
import { sendRaw } from '../../_lib/email'
import type { Env } from '../../_lib/env'
import { isAdmin } from '../../_lib/env'
import {
  badRequest,
  forbidden,
  notFound,
  ok,
  serviceUnavailable,
  unauthorized,
} from '../../_lib/json'

interface OutboxRow {
  id: string
  to_email: string
  subject: string
  kind: string
  created_at: number
  attempts: number
  last_attempt: number | null
  last_error: string | null
}

interface OutboxEntry {
  id: string
  toEmail: string
  subject: string
  kind: string
  createdAt: number
  attempts: number
  lastAttempt: number | null
  lastError: string | null
}

const LIST_LIMIT = 100

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const email = await currentEmail(request, env.SESSION_SECRET)
  if (!email) return unauthorized()
  if (!isAdmin(env, email)) return forbidden()

  // Pending rows only. Stuck rows (attempts >= MAX) surface in the same
  // list — the page can flag them visually, the server just returns the
  // raw row state. Order: stuck first (attempts DESC), then oldest first
  // so a backlog reads in arrival order.
  try {
    const r = await env.DB.prepare(
      `SELECT id, to_email, subject, kind, created_at, attempts, last_attempt, last_error
         FROM email_outbox
        WHERE sent_at IS NULL
        ORDER BY attempts DESC, created_at ASC
        LIMIT ?`,
    )
      .bind(LIST_LIMIT)
      .all<OutboxRow>()
    const entries: OutboxEntry[] = (r.results ?? []).map((row) => ({
      id: row.id,
      toEmail: row.to_email,
      subject: row.subject,
      kind: row.kind,
      createdAt: row.created_at,
      attempts: row.attempts,
      lastAttempt: row.last_attempt,
      lastError: row.last_error,
    }))
    return ok({ entries })
  } catch (err) {
    // email_outbox is migration 0026 — graceful degrade on a half-migrated
    // env (mirrors the operator_notes pattern in today.ts). The empty
    // payload keeps the UI's empty state showing instead of an error.
    const msg = err instanceof Error ? err.message : String(err)
    if (/no such table/.test(msg)) return ok({ entries: [] })
    throw err
  }
}

interface OutboxRetryRow extends OutboxRow {
  html: string
  text_body: string
  sent_at: number | null
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const email = await currentEmail(request, env.SESSION_SECRET)
  if (!email) return unauthorized()
  if (!isAdmin(env, email)) return forbidden()
  if (!env.RESEND_API_KEY) {
    // Without Resend configured the retry can't possibly succeed. Surface
    // the cause instead of pretending the row's gone through.
    return serviceUnavailable('resend not configured')
  }

  let body: { id?: unknown }
  try {
    body = (await request.json()) as { id?: unknown }
  } catch {
    return badRequest('invalid json')
  }
  const id = typeof body.id === 'string' ? body.id : ''
  if (!id) return badRequest('id required')

  const row = await env.DB.prepare(
    `SELECT id, to_email, subject, html, text_body, kind, created_at,
            attempts, last_attempt, last_error, sent_at
       FROM email_outbox
      WHERE id = ?
      LIMIT 1`,
  )
    .bind(id)
    .first<OutboxRetryRow>()
  if (!row) return notFound('outbox row not found')
  if (row.sent_at != null) {
    // Already delivered. Returning 200 with delivered:true is the same
    // shape the success path uses, so the client doesn't need a
    // second case for "you clicked retry on a row that just sent."
    return ok({ delivered: true, alreadySent: true })
  }

  const now = Math.floor(Date.now() / 1000)
  const result = await sendRaw(env.RESEND_API_KEY, {
    from: 'Marc <noreply@marcportal.com>',
    to: row.to_email,
    subject: row.subject,
    html: row.html,
    text: row.text_body,
  })

  if (result.delivered) {
    await env.DB.prepare(`UPDATE email_outbox SET sent_at = ?, last_attempt = ? WHERE id = ?`)
      .bind(now, now, id)
      .run()
    return ok({ delivered: true })
  }

  // Manual retry bumps attempts so the failure history is honest, but
  // doesn't itself gate future retries — the sweeper honors the cap
  // independently. The UI surfaces the new last_error on next load.
  await env.DB.prepare(
    `UPDATE email_outbox
        SET attempts = attempts + 1, last_attempt = ?, last_error = ?
      WHERE id = ?`,
  )
    .bind(now, result.error ?? 'unknown', id)
    .run()
  return ok({ delivered: false, error: result.error ?? 'unknown' })
}
