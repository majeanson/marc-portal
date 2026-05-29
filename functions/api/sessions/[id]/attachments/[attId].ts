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
import { requireSessionAccess } from '../../../../_lib/sessions'
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

type ByteRange = { offset: number; length: number }

/** Parse a single `Range: bytes=…` header against a known object size.
 *  Returns:
 *   - `null`            → no header, or one we deliberately ignore (a non-`bytes`
 *                         unit, or a syntactically broken header) → serve full 200.
 *   - `'unsatisfiable'` → a well-formed range whose start is past the end → 416.
 *   - `{offset,length}` → the resolved window to request from R2.
 *
 *  Why this exists: a MediaRecorder webm/opus voice note has no duration in its
 *  header, so the <audio> element issues a Range request to backfill duration
 *  and to seek. A handler that always answers 200 leaves the clip unseekable —
 *  it plays once and errors on replay. We honour only a single range; a clip is
 *  one request, so multipart/byteranges isn't worth the complexity. */
function parseRangeHeader(header: string | null, size: number): ByteRange | 'unsatisfiable' | null {
  if (!header) return null
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (!match) return null // garbled or non-`bytes` unit: RFC lets us ignore it.
  const [, startStr, endStr] = match
  if (startStr === '' && endStr === '') return null // `bytes=-` is meaningless.

  // Suffix range (`bytes=-N`): the last N bytes.
  if (startStr === '') {
    const suffix = Number(endStr)
    if (suffix <= 0) return null
    const offset = Math.max(0, size - suffix)
    return { offset, length: size - offset }
  }

  const start = Number(startStr)
  if (start >= size) return 'unsatisfiable'
  // Open-ended (`bytes=N-`) runs to the last byte; an explicit end past the
  // object is clamped to the last byte rather than rejected.
  const end = endStr === '' ? size - 1 : Math.min(Number(endStr), size - 1)
  if (end < start) return 'unsatisfiable'
  return { offset: start, length: end - start + 1 }
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env, params }) => {
  if (!env.MEDIA) return serviceUnavailable('attachments are not enabled')
  const email = await currentEmail(request, env.SESSION_SECRET)
  if (!email) return unauthorized()
  const attId = String(params.attId ?? '')
  if (!attId) return badRequest('missing id')

  // Stream reads: visitor sees 404 on deleted session, admin still serves
  // (file recovery via /admin/trash).
  const access = await requireSessionAccess(env.DB, params.id, {
    email,
    isAdmin: isAdmin(env, email),
  })
  if (access instanceof Response) return access
  const sessionId = access.id

  const att = await loadAttachment(env, sessionId, attId)
  if (!att) return notFound()

  const range = parseRangeHeader(request.headers.get('range'), att.size)
  // A start past the end is unsatisfiable: answer 416 with the total size so
  // the client can re-request a valid window. No body, no R2 read.
  if (range === 'unsatisfiable') {
    return new Response(null, {
      status: 416,
      headers: { 'content-range': `bytes */${att.size}`, 'accept-ranges': 'bytes' },
    })
  }

  // Ask R2 for only the requested slice on a range hit, the whole object otherwise.
  const obj = range
    ? await env.MEDIA.get(att.r2_key, { range: { offset: range.offset, length: range.length } })
    : await env.MEDIA.get(att.r2_key)
  if (!obj) return notFound()

  // Inline for the kinds the thread renders in place — images preview,
  // voice notes feed an <audio> element, sketches are fetched as JSON by
  // the canvas. Everything else downloads with its original filename.
  const ct = att.content_type.toLowerCase()
  const inline = ct.startsWith('image/') || att.kind === 'voice' || att.kind === 'sketch'
  const disposition = inline ? 'inline' : 'attachment'
  const headers: Record<string, string> = {
    'content-type': att.content_type,
    'content-disposition': `${disposition}; ${encodeContentDispositionFilename(att.filename)}`,
    // Conservative default — visitor's session cookie is HttpOnly + same-site,
    // so caching shared computers' files is risky. No-store keeps it tight.
    'cache-control': 'private, no-store',
    // Advertise byte-range support even on the full 200 so a media element
    // knows it can seek (see parseRangeHeader for why this matters for voice).
    'accept-ranges': 'bytes',
  }
  if (range) {
    headers['content-range'] =
      `bytes ${range.offset}-${range.offset + range.length - 1}/${att.size}`
    headers['content-length'] = String(range.length)
  } else {
    headers['content-length'] = String(att.size)
  }
  return new Response(obj.body, { status: range ? 206 : 200, headers })
}

export const onRequestDelete: PagesFunction<Env> = async ({ request, env, params }) => {
  if (!env.MEDIA) return serviceUnavailable('attachments are not enabled')
  const email = await currentEmail(request, env.SESSION_SECRET)
  if (!email) return unauthorized()
  const attId = String(params.attId ?? '')
  if (!attId) return badRequest('missing id')

  // Deleting an attachment of a deleted session would be confusing — hide-from-all.
  const admin = isAdmin(env, email)
  const access = await requireSessionAccess(
    env.DB,
    params.id,
    { email, isAdmin: admin },
    { softDeleted: 'hide-from-all' },
  )
  if (access instanceof Response) return access
  const sessionId = access.id

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
