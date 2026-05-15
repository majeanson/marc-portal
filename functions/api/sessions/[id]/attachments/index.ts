// POST /api/sessions/:id/attachments — upload one file via multipart/form-data
//                                       under field name "file". Returns the
//                                       attachment row (without message_id;
//                                       linking happens at message-send).
// GET  /api/sessions/:id/attachments — list pre-message (unlinked) uploads
//                                       made by the current actor for this
//                                       session. Useful for resumed flows.

import { currentEmail } from '../../../../_lib/auth'
import type { Env } from '../../../../_lib/env'
import { isAdmin } from '../../../../_lib/env'
import {
  badRequest,
  forbidden,
  notFound,
  ok,
  payloadTooLarge,
  serviceUnavailable,
  tooManyRequests,
  unauthorized,
  unsupportedMediaType,
} from '../../../../_lib/json'
import { rateLimitCheck, rateLimitSweep } from '../../../../_lib/ratelimit'
import { canAccessSession, loadSession } from '../../../../_lib/sessions'
import {
  isAllowedContentType,
  MAX_ATTACHMENT_BYTES_PER_SESSION,
  MAX_ATTACHMENT_SIZE,
  newAttachmentId,
  r2KeyFor,
  safeFilename,
  totalAttachmentBytesForSession,
  type AttachmentRow,
} from '../../../../_lib/attachments'

export const onRequestPost: PagesFunction<Env> = async ({ request, env, params }) => {
  if (!env.MEDIA) {
    return serviceUnavailable('attachments are not enabled on this deployment')
  }
  const email = await currentEmail(request, env.SESSION_SECRET)
  if (!email) return unauthorized()
  const id = String(params.id ?? '')
  if (!id) return badRequest('missing session id')

  const session = await loadSession(env.DB, id)
  if (!session) return notFound()
  if (session.deleted_at) return notFound()
  if (!canAccessSession(email, isAdmin(env, email), session)) return forbidden()

  // Throttle uploads. 30/h per email is plenty for thread-attached docs but
  // tight enough that nobody's bulk-uploading.
  const okEmail = await rateLimitCheck(env, `attachments:upload:email:${email}`, 30, 3600)
  if (!okEmail) return tooManyRequests('too many uploads in the last hour')
  await rateLimitSweep(env)

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return badRequest('expected multipart/form-data')
  }
  // Workers-types doesn't expose `File` as a constructor in some configs;
  // duck-type the FormDataEntryValue (File-like) instead of instanceof.
  const raw = form.get('file')
  if (
    !raw ||
    typeof raw === 'string' ||
    typeof (raw as { stream?: unknown }).stream !== 'function'
  ) {
    return badRequest('missing "file" field')
  }
  const file = raw as {
    name: string
    type: string
    size: number
    stream: () => ReadableStream
  }

  if (file.size === 0) return badRequest('empty file')
  if (file.size > MAX_ATTACHMENT_SIZE) return payloadTooLarge('file exceeds 10 MB limit')
  if (!isAllowedContentType(file.type)) {
    return unsupportedMediaType(`content type not allowed: ${file.type || 'unknown'}`)
  }

  // Per-session storage ceiling. Sum of all existing attachment sizes on
  // this session + the new file mustn't exceed the budget. Cheap COALESCE
  // SUM query — cheaper than scanning R2.
  const existingBytes = await totalAttachmentBytesForSession(env.DB, id)
  if (existingBytes + file.size > MAX_ATTACHMENT_BYTES_PER_SESSION) {
    return payloadTooLarge('session storage budget reached — delete an older file first')
  }

  const attachmentId = newAttachmentId()
  const r2Key = r2KeyFor(id, attachmentId)
  const filename = safeFilename(file.name)
  const now = Math.floor(Date.now() / 1000)

  // Stream to R2. The .body is a ReadableStream — putting it directly avoids
  // pulling the whole file into the worker's memory.
  await env.MEDIA.put(r2Key, file.stream(), {
    httpMetadata: { contentType: file.type },
  })

  try {
    await env.DB.prepare(
      `INSERT INTO attachments
         (id, session_id, message_id, uploaded_by, filename, content_type, size, r2_key, created_at)
       VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(attachmentId, id, email, filename, file.type, file.size, r2Key, now)
      .run()
  } catch (err) {
    // Roll back the R2 object so we don't leak orphans on DB write failures.
    await env.MEDIA.delete(r2Key).catch(() => {})
    throw err
  }

  const row: AttachmentRow = {
    id: attachmentId,
    session_id: id,
    message_id: null,
    uploaded_by: email,
    filename,
    content_type: file.type,
    size: file.size,
    r2_key: r2Key,
    created_at: now,
  }
  return ok({ attachment: row })
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env, params }) => {
  const email = await currentEmail(request, env.SESSION_SECRET)
  if (!email) return unauthorized()
  const id = String(params.id ?? '')
  if (!id) return badRequest('missing session id')

  const session = await loadSession(env.DB, id)
  if (!session) return notFound()
  if (session.deleted_at) return notFound()
  if (!canAccessSession(email, isAdmin(env, email), session)) return forbidden()

  // Pre-message uploads only. Linked attachments come back through the
  // /messages list — no point in showing them twice.
  const res = await env.DB.prepare(
    `SELECT id, session_id, message_id, uploaded_by, filename, content_type,
            size, r2_key, created_at
     FROM attachments
     WHERE session_id = ? AND uploaded_by = ? AND message_id IS NULL
     ORDER BY created_at ASC`,
  )
    .bind(id, email)
    .all<AttachmentRow>()

  return ok({ attachments: res.results ?? [] })
}
