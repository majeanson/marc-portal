// GET    /api/sessions/:id/attachments/:attId — stream the file from R2.
//                                                Auth: same as the parent
//                                                session (visitor self or admin).
// DELETE /api/sessions/:id/attachments/:attId — soft-removes the row + R2
//                                                object. Allowed to: the
//                                                uploader (only while still
//                                                unlinked) or admin (any time).

import { currentEmail } from '../../../../_lib/auth'
import type { Env } from '../../../../_lib/env'
import { isAdmin } from '../../../../_lib/env'
import {
  badRequest,
  forbidden,
  notFound,
  ok,
  serviceUnavailable,
  unauthorized,
} from '../../../../_lib/json'
import { canAccessSession, loadSession } from '../../../../_lib/sessions'
import { ATTACHMENT_COLUMNS, type AttachmentRow } from '../../../../_lib/attachments'

async function loadAttachment(
  env: Env,
  sessionId: string,
  attId: string,
): Promise<AttachmentRow | null> {
  return env.DB.prepare(
    `SELECT ${ATTACHMENT_COLUMNS}
     FROM attachments WHERE id = ? AND session_id = ?`,
  )
    .bind(attId, sessionId)
    .first<AttachmentRow>()
}

/** RFC 5987 encode for Content-Disposition filename* parameter. */
function encodeContentDispositionFilename(name: string): string {
  return `filename*=UTF-8''${encodeURIComponent(name)}`
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env, params }) => {
  if (!env.MEDIA) return serviceUnavailable('attachments are not enabled')
  const email = await currentEmail(request, env.SESSION_SECRET)
  if (!email) return unauthorized()
  const sessionId = String(params.id ?? '')
  const attId = String(params.attId ?? '')
  if (!sessionId || !attId) return badRequest('missing id')

  const session = await loadSession(env.DB, sessionId)
  if (!session) return notFound()
  if (session.deleted_at && !isAdmin(env, email)) return notFound()
  if (!canAccessSession(email, isAdmin(env, email), session)) return forbidden()

  const att = await loadAttachment(env, sessionId, attId)
  if (!att) return notFound()

  const obj = await env.MEDIA.get(att.r2_key)
  if (!obj) return notFound()

  // Inline for the kinds the thread renders in place — images preview,
  // voice notes feed an <audio> element, sketches are fetched as JSON by
  // the canvas. Everything else downloads with its original filename.
  const ct = att.content_type.toLowerCase()
  const inline = ct.startsWith('image/') || att.kind === 'voice' || att.kind === 'sketch'
  const disposition = inline ? 'inline' : 'attachment'
  return new Response(obj.body, {
    headers: {
      'content-type': att.content_type,
      'content-length': String(att.size),
      'content-disposition': `${disposition}; ${encodeContentDispositionFilename(att.filename)}`,
      // Conservative default — visitor's session cookie is HttpOnly + same-site,
      // so caching shared computers' files is risky. No-store keeps it tight.
      'cache-control': 'private, no-store',
    },
  })
}

export const onRequestDelete: PagesFunction<Env> = async ({ request, env, params }) => {
  if (!env.MEDIA) return serviceUnavailable('attachments are not enabled')
  const email = await currentEmail(request, env.SESSION_SECRET)
  if (!email) return unauthorized()
  const sessionId = String(params.id ?? '')
  const attId = String(params.attId ?? '')
  if (!sessionId || !attId) return badRequest('missing id')

  const session = await loadSession(env.DB, sessionId)
  if (!session) return notFound()
  if (session.deleted_at) return notFound()

  const admin = isAdmin(env, email)
  if (!canAccessSession(email, admin, session)) return forbidden()

  const att = await loadAttachment(env, sessionId, attId)
  if (!att) return ok({ ok: true })

  // Once attached to a sent message, only admin can prune. Pre-message
  // uploads are fair game for the uploader.
  const isUploader = att.uploaded_by.toLowerCase() === email.toLowerCase()
  const allowed = admin || (isUploader && att.message_id === null)
  if (!allowed) return forbidden('cannot delete attached file')

  await env.MEDIA.delete(att.r2_key).catch(() => {})
  await env.DB.prepare(`DELETE FROM attachments WHERE id = ?`).bind(attId).run()

  return ok({ ok: true })
}
