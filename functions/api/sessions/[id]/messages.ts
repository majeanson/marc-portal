// GET  /api/sessions/:id/messages — chronological thread for the session.
// POST /api/sessions/:id/messages — append a message. author derived from
//                                    viewer (admin → 'marc', else 'visitor').
// On visitor-posted messages, Marc gets a Resend notification.

import { currentEmail } from '../../../_lib/auth'
import { randomTokenB64url } from '../../../_lib/bytes'
import { sendVisitorMessageNotification } from '../../../_lib/email'
import type { Env } from '../../../_lib/env'
import { isAdmin } from '../../../_lib/env'
import { badRequest, forbidden, notFound, ok, unauthorized } from '../../../_lib/json'
import { canAccessSession, primaryAdminEmail } from '../../../_lib/sessions'
import type { MessageRow, SessionRow } from '../../../_lib/sessions'

const MAX_BODY_LEN = 8000

async function loadSession(env: Env, id: string): Promise<SessionRow | null> {
  return env.DB.prepare(
    `SELECT id, email, intake_json, status, created_at, updated_at
     FROM sessions WHERE id = ?`,
  )
    .bind(id)
    .first<SessionRow>()
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env, params }) => {
  const email = await currentEmail(request, env.SESSION_SECRET)
  if (!email) return unauthorized()
  const id = String(params.id ?? '')
  if (!id) return badRequest('missing id')

  const session = await loadSession(env, id)
  if (!session) return notFound()
  if (!canAccessSession(email, isAdmin(env, email), session)) return forbidden()

  const res = await env.DB.prepare(
    `SELECT id, session_id, author, body, created_at
     FROM messages WHERE session_id = ? ORDER BY created_at ASC`,
  )
    .bind(id)
    .all<MessageRow>()

  return ok({ messages: res.results ?? [] })
}

interface PostBody {
  body?: unknown
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env, params }) => {
  const email = await currentEmail(request, env.SESSION_SECRET)
  if (!email) return unauthorized()
  const id = String(params.id ?? '')
  if (!id) return badRequest('missing id')

  const session = await loadSession(env, id)
  if (!session) return notFound()
  const admin = isAdmin(env, email)
  if (!canAccessSession(email, admin, session)) return forbidden()

  let payload: PostBody
  try {
    payload = (await request.json()) as PostBody
  } catch {
    return badRequest('invalid json')
  }

  const body = typeof payload.body === 'string' ? payload.body.trim() : ''
  if (!body) return badRequest('empty body')
  if (body.length > MAX_BODY_LEN) return badRequest('body too long')

  const messageId = randomTokenB64url(12)
  const now = Math.floor(Date.now() / 1000)
  const author: 'marc' | 'visitor' = admin ? 'marc' : 'visitor'

  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO messages (id, session_id, author, body, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).bind(messageId, id, author, body, now),
    env.DB.prepare(`UPDATE sessions SET updated_at = ? WHERE id = ?`).bind(now, id),
  ])

  // Resend notification to Marc when visitor posts. Failure is logged but
  // does not fail the request — the message is in D1; the notification is a
  // best-effort nudge. Marc-posted messages don't email the visitor (per the
  // 'no notifications other than the magic link' decision).
  if (author === 'visitor') {
    const marc = primaryAdminEmail(env.ADMIN_EMAILS)
    if (marc) {
      const origin = new URL(request.url).origin
      await sendVisitorMessageNotification(
        env.RESEND_API_KEY,
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
