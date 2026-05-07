// GET  /api/sessions/:id/messages — chronological thread for the session.
// POST /api/sessions/:id/messages — append a message. author derived from
//                                    viewer (operator → 'marc', else 'visitor').
// On visitor-posted messages, the operator gets a Resend notification.
//
// Tenant-scoped: session lookup filters by tenant_id; messages are tagged.

import { currentEmail } from '../../../_lib/auth'
import { randomTokenB64url } from '../../../_lib/bytes'
import { sendVisitorMessageNotification } from '../../../_lib/email'
import type { Env } from '../../../_lib/env'
import { isAdmin } from '../../../_lib/env'
import { badRequest, forbidden, notFound, ok, unauthorized } from '../../../_lib/json'
import { canAccessSession, primaryAdminEmail } from '../../../_lib/sessions'
import type { MessageRow, SessionRow } from '../../../_lib/sessions'
import { requireTenant } from '../../../_lib/tenant'

const MAX_BODY_LEN = 8000

async function loadSession(env: Env, tenantId: string, id: string): Promise<SessionRow | null> {
  return env.DB.prepare(
    `SELECT id, email, intake_json, status, created_at, updated_at
       FROM sessions WHERE id = ? AND tenant_id = ?`,
  )
    .bind(id, tenantId)
    .first<SessionRow>()
}

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const tenant = requireTenant(ctx)
  const email = await currentEmail(ctx.request, ctx.env.SESSION_SECRET)
  if (!email) return unauthorized()
  const id = String(ctx.params.id ?? '')
  if (!id) return badRequest('missing id')

  const session = await loadSession(ctx.env, tenant.id, id)
  if (!session) return notFound()
  const isOperatorView = isAdmin(ctx.env, email) && tenant.flags.isOperator === true
  if (!canAccessSession(email, isOperatorView, session)) return forbidden()

  const res = await ctx.env.DB.prepare(
    `SELECT id, session_id, author, body, created_at
       FROM messages WHERE session_id = ? AND tenant_id = ? ORDER BY created_at ASC`,
  )
    .bind(id, tenant.id)
    .all<MessageRow>()

  return ok({ messages: res.results ?? [] })
}

interface PostBody {
  body?: unknown
}

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const tenant = requireTenant(ctx)
  const email = await currentEmail(ctx.request, ctx.env.SESSION_SECRET)
  if (!email) return unauthorized()
  const id = String(ctx.params.id ?? '')
  if (!id) return badRequest('missing id')

  const session = await loadSession(ctx.env, tenant.id, id)
  if (!session) return notFound()
  const isOperatorView = isAdmin(ctx.env, email) && tenant.flags.isOperator === true
  if (!canAccessSession(email, isOperatorView, session)) return forbidden()

  let payload: PostBody
  try {
    payload = (await ctx.request.json()) as PostBody
  } catch {
    return badRequest('invalid json')
  }

  const body = typeof payload.body === 'string' ? payload.body.trim() : ''
  if (!body) return badRequest('empty body')
  if (body.length > MAX_BODY_LEN) return badRequest('body too long')

  const messageId = randomTokenB64url(12)
  const now = Math.floor(Date.now() / 1000)
  const author: 'marc' | 'visitor' = isOperatorView ? 'marc' : 'visitor'

  await ctx.env.DB.batch([
    ctx.env.DB.prepare(
      `INSERT INTO messages (id, session_id, author, body, created_at, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).bind(messageId, id, author, body, now, tenant.id),
    ctx.env.DB.prepare(
      `UPDATE sessions SET updated_at = ? WHERE id = ? AND tenant_id = ?`,
    ).bind(now, id, tenant.id),
  ])

  // Resend notification to the operator when visitor posts. Failure is logged
  // but does not fail the request — the message is in D1; the notification is
  // a best-effort nudge. Operator-posted messages don't email the visitor.
  if (author === 'visitor') {
    const marc = primaryAdminEmail(ctx.env.ADMIN_EMAILS)
    if (marc) {
      const origin = new URL(ctx.request.url).origin
      await sendVisitorMessageNotification(
        ctx.env.RESEND_API_KEY,
        marc,
        session.email,
        id,
        origin,
        body,
      )
    }
  }

  const message: MessageRow = {
    id: messageId,
    session_id: id,
    author,
    body,
    created_at: now,
  }
  return ok({ message })
}
