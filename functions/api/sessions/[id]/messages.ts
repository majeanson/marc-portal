// GET  /api/sessions/:id/messages — chronological thread for the session.
// POST /api/sessions/:id/messages — append a message. author derived from
//                                    viewer (admin → 'marc', else 'visitor').
// On visitor-posted messages, Marc gets a Resend notification.

import { currentEmail } from '../../../_lib/auth'
import { randomTokenB64url } from '../../../_lib/bytes'
import { sendMarcMessageNotification, sendVisitorMessageNotification } from '../../../_lib/email'
import type { Env } from '../../../_lib/env'
import { isAdmin } from '../../../_lib/env'
import {
  badRequest,
  forbidden,
  notFound,
  ok,
  tooManyRequests,
  unauthorized,
} from '../../../_lib/json'
import { rateLimitCheck, rateLimitSweep } from '../../../_lib/ratelimit'
import { canAccessSession, loadSession, primaryAdminEmail } from '../../../_lib/sessions'
import { getLang } from '../../../_lib/userPrefs'
import type { MessageRow } from '../../../_lib/sessions'
import {
  listAttachmentsForMessages,
  MAX_ATTACHMENTS_PER_MESSAGE,
  type AttachmentRow,
} from '../../../_lib/attachments'

const MAX_BODY_LEN = 8000

export const onRequestGet: PagesFunction<Env> = async ({ request, env, params }) => {
  const email = await currentEmail(request, env.SESSION_SECRET)
  if (!email) return unauthorized()
  const id = String(params.id ?? '')
  if (!id) return badRequest('missing id')

  const session = await loadSession(env.DB, id)
  if (!session) return notFound()
  const adminGet = isAdmin(env, email)
  if (!canAccessSession(email, adminGet, session)) return forbidden()
  // Soft-deleted: visitor sees 404, admin still has read access by id.
  if (session.deleted_at && !adminGet) return notFound()

  const res = await env.DB.prepare(
    `SELECT id, session_id, author, body, created_at
     FROM messages WHERE session_id = ? ORDER BY created_at ASC`,
  )
    .bind(id)
    .all<MessageRow>()

  const messages = res.results ?? []
  const byMessage = await listAttachmentsForMessages(
    env.DB,
    messages.map((m) => m.id),
  )

  // Annotate each message with its attachments. Empty array if none — the
  // frontend can rely on the property always being present.
  const enriched = messages.map((m) => ({
    ...m,
    attachments: byMessage[m.id] ?? [],
  }))

  return ok({ messages: enriched })
}

interface PostBody {
  body?: unknown
  /** IDs of pre-uploaded attachments to link to this message. */
  attachmentIds?: unknown
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env, params }) => {
  const email = await currentEmail(request, env.SESSION_SECRET)
  if (!email) return unauthorized()
  const id = String(params.id ?? '')
  if (!id) return badRequest('missing id')

  const session = await loadSession(env.DB, id)
  if (!session) return notFound()
  if (session.deleted_at) return notFound()
  const admin = isAdmin(env, email)
  if (!canAccessSession(email, admin, session)) return forbidden()

  // Throttle messaging: 60/h per actor email. Generous enough that real
  // back-and-forth never trips it; tight enough that nobody's hammering.
  const okMsg = await rateLimitCheck(env, `messages:post:email:${email}`, 60, 3600)
  if (!okMsg) return tooManyRequests('too many messages in the last hour')
  await rateLimitSweep(env)

  let payload: PostBody
  try {
    payload = (await request.json()) as PostBody
  } catch {
    return badRequest('invalid json')
  }

  const body = typeof payload.body === 'string' ? payload.body.trim() : ''
  const rawIds = Array.isArray(payload.attachmentIds) ? payload.attachmentIds : []
  const attachmentIds = rawIds
    .filter((v): v is string => typeof v === 'string' && v.length > 0)
    .slice(0, MAX_ATTACHMENTS_PER_MESSAGE)
  // Allow attachment-only messages (no body) so the visitor can drop a file
  // without typing. But require at least one of body/attachments.
  if (!body && attachmentIds.length === 0) return badRequest('empty message')
  if (body.length > MAX_BODY_LEN) return badRequest('body too long')

  const messageId = randomTokenB64url(12)
  const now = Math.floor(Date.now() / 1000)
  const author: 'marc' | 'visitor' = admin ? 'marc' : 'visitor'

  // Insert message + bump session updated_at + (atomically) link any
  // pending attachments. Linker is constrained to (a) the same session,
  // (b) currently unlinked, (c) uploaded by the actor sending the message —
  // an admin can't accidentally link a visitor's pending file, nor vice
  // versa.
  const ops = [
    env.DB.prepare(
      `INSERT INTO messages (id, session_id, author, body, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).bind(messageId, id, author, body, now),
    env.DB.prepare(`UPDATE sessions SET updated_at = ? WHERE id = ?`).bind(now, id),
  ]
  if (attachmentIds.length > 0) {
    const placeholders = attachmentIds.map(() => '?').join(',')
    ops.push(
      env.DB.prepare(
        `UPDATE attachments SET message_id = ?
         WHERE id IN (${placeholders})
           AND session_id = ?
           AND uploaded_by = ?
           AND message_id IS NULL`,
      ).bind(messageId, ...attachmentIds, id, email),
    )
  }
  await env.DB.batch(ops)

  // Re-fetch the linked attachments for this message — only the ones the
  // linker actually claimed (filtering on the same conditions).
  let linkedAttachments: AttachmentRow[] = []
  if (attachmentIds.length > 0) {
    const placeholders = attachmentIds.map(() => '?').join(',')
    const r = await env.DB.prepare(
      `SELECT id, session_id, message_id, uploaded_by, filename, content_type,
              size, r2_key, created_at
       FROM attachments WHERE message_id = ? AND id IN (${placeholders})
       ORDER BY created_at ASC`,
    )
      .bind(messageId, ...attachmentIds)
      .all<AttachmentRow>()
    linkedAttachments = r.results ?? []
  }

  // Resend notifications. Failures are logged but don't fail the request —
  // the message is already in D1; emails are best-effort nudges.
  const origin = new URL(request.url).origin
  if (author === 'visitor') {
    const marc = primaryAdminEmail(env.ADMIN_EMAILS)
    if (marc) {
      const marcLang = await getLang(env.DB, marc)
      await sendVisitorMessageNotification(
        env.RESEND_API_KEY,
        marc,
        session.email,
        id,
        origin,
        body,
        marcLang,
      )
    }
  } else {
    // author === 'marc' → email the visitor with the preview + link.
    const visitorPrefLang = await getLang(env.DB, session.email)
    await sendMarcMessageNotification(
      env.RESEND_API_KEY,
      session.email,
      id,
      origin,
      body,
      visitorPrefLang,
    )
  }

  const message: MessageRow & { attachments: AttachmentRow[] } = {
    id: messageId,
    session_id: id,
    author,
    body,
    created_at: now,
    attachments: linkedAttachments,
  }
  return ok({ message })
}
