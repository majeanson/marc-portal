// POST /api/sessions/:id/attachments — upload one item via multipart/form-data
//                                       under field name "file". Returns the
//                                       attachment row (without message_id;
//                                       linking happens at message-send).
//
//   Three upload kinds, decided from the content type:
//     file   — a document. Streamed straight to R2 (memory-thin).
//     voice  — an audio recording. Buffered, magic-byte checked, transcribed
//              at the edge (Whisper), then stored. transcript persists on the
//              row; null when Workers AI is unavailable (graceful degrade).
//     sketch — an Excalidraw scene (JSON). Buffered, parsed + shape-checked,
//              then stored. Re-openable and replayable in-thread.
//
// GET  /api/sessions/:id/attachments — list pre-message (unlinked) uploads
//                                       made by the current actor for this
//                                       session. Useful for resumed flows.

import { currentEmail } from '../../../../_lib/auth'
import type { Env } from '../../../../_lib/env'
import { isAdmin } from '../../../../_lib/env'
import {
  badRequest,
  conflict,
  ok,
  payloadTooLarge,
  serviceUnavailable,
  tooManyRequests,
  unauthorized,
  unsupportedMediaType,
} from '../../../../_lib/json'
import { rateLimitCheck, rateLimitSweep } from '../../../../_lib/ratelimit'
import { requireSessionAccess } from '../../../../_lib/sessions'
import { transcribeAudio } from '../../../../_lib/transcribe'
import {
  ATTACHMENT_COLUMNS,
  attachmentKind,
  findNapkinForSession,
  isAllowedContentType,
  MAX_ATTACHMENT_BYTES_PER_SESSION,
  MAX_ATTACHMENT_SIZE,
  MAX_NAPKIN_SIZE,
  MAX_SKETCH_SIZE,
  MAX_VOICE_SIZE,
  newAttachmentId,
  r2KeyFor,
  safeFilename,
  totalAttachmentBytesForSession,
  verifyMagicBytesBuffer,
  type AttachmentKind,
  type AttachmentRow,
} from '../../../../_lib/attachments'

/** Largest accepted upload, by kind. The voice + sketch paths buffer the
 *  whole payload in memory, so they sit below the streamed-file ceiling. */
function sizeCapFor(kind: AttachmentKind): number {
  if (kind === 'voice') return MAX_VOICE_SIZE
  if (kind === 'sketch') return MAX_SKETCH_SIZE
  if (kind === 'napkin') return MAX_NAPKIN_SIZE
  return MAX_ATTACHMENT_SIZE
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env, params }) => {
  if (!env.MEDIA) {
    return serviceUnavailable('attachments are not enabled on this deployment')
  }
  const email = await currentEmail(request, env.SESSION_SECRET)
  if (!email) return unauthorized()

  // Uploads onto a deleted session don't make sense — hide-from-all.
  const access = await requireSessionAccess(
    env.DB,
    params.id,
    { email, isAdmin: isAdmin(env, email) },
    { softDeleted: 'hide-from-all' },
  )
  if (access instanceof Response) return access
  const id = access.id

  // Throttle uploads. 30/h per email is plenty for thread-attached docs,
  // voice notes and sketches but tight enough that nobody's bulk-uploading.
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
  if (!isAllowedContentType(file.type)) {
    return unsupportedMediaType(`content type not allowed: ${file.type || 'unknown'}`)
  }

  // `?kind=napkin` opts into the intake-time napkin path: the PNG snapshot
  // of the visitor's Excalidraw sketch, attached at session-creation. The
  // sniffer would otherwise classify image/png as `'file'` — napkin needs an
  // explicit caller to mean "this is THE napkin, enforce one-per-session".
  // Every other kind (file/voice/sketch) is derived from the content type.
  const url = new URL(request.url)
  const requestedKind = url.searchParams.get('kind')
  let kind: AttachmentKind
  if (requestedKind === 'napkin') {
    if (file.type !== 'image/png') {
      return unsupportedMediaType('napkin must be image/png')
    }
    // One napkin per session — the intake serializes a single sketch. A
    // re-submit / re-upload story doesn't exist in v1, so a second POST
    // would silently shadow the first; refuse with 409 instead. The
    // visitor can delete the existing one (admin-gated) if a redo is
    // really needed.
    const existing = await findNapkinForSession(env.DB, id)
    if (existing) return conflict('napkin already exists for this session')
    kind = 'napkin'
  } else if (requestedKind && requestedKind !== 'file') {
    return badRequest(`unknown kind: ${requestedKind}`)
  } else {
    kind = attachmentKind(file.type)
  }

  if (file.size > sizeCapFor(kind)) {
    return payloadTooLarge(
      `file exceeds the ${Math.round(sizeCapFor(kind) / 1024 / 1024)} MB limit`,
    )
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

  // One shape for all four kinds: buffer the upload into an ArrayBuffer,
  // magic-byte check the bytes, run any kind-specific validation, then
  // R2.put the buffer. R2 needs a known content-length, and a buffer
  // gives that for free. Memory is bounded by the per-kind size cap
  // (10 MB for file, lower for the others) — well inside the 128 MB
  // Worker budget. The previous streaming variant for `kind='file'`
  // worked in production (Workers R2 was lenient on the magic-byte
  // verifier's wrapped stream) but failed under Miniflare's stricter
  // emulator — see AUDIT P1.10.
  const buffer = await new Response(file.stream()).arrayBuffer()
  const bytes = new Uint8Array(buffer)
  if (!verifyMagicBytesBuffer(file.type, bytes)) {
    return unsupportedMediaType('file contents do not match declared type')
  }
  if (kind === 'sketch') {
    // A sketch must be a JSON object carrying an `elements` array — the
    // shape SketchCanvas / NapkinReplay hydrate from. Anything else is a
    // malformed or hostile payload.
    try {
      const parsed = JSON.parse(new TextDecoder().decode(bytes)) as { elements?: unknown }
      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.elements)) {
        return badRequest('sketch must be a JSON scene with an elements array')
      }
    } catch {
      return badRequest('sketch is not valid JSON')
    }
  }
  let transcript: string | null = null
  if (kind === 'voice') {
    // Transcribe at the edge. Best-effort: a null transcript (Workers AI
    // off, or Whisper hiccup) still leaves a playable voice note.
    transcript = await transcribeAudio(env, buffer)
  }
  const r2Body: ArrayBuffer = buffer

  // Stream/put to R2.
  await env.MEDIA.put(r2Key, r2Body, {
    httpMetadata: { contentType: file.type },
  })

  try {
    await env.DB.prepare(
      `INSERT INTO attachments
         (id, session_id, message_id, uploaded_by, filename, content_type, size,
          r2_key, created_at, kind, transcript)
       VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(attachmentId, id, email, filename, file.type, file.size, r2Key, now, kind, transcript)
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
    kind,
    transcript,
  }
  return ok({ attachment: row })
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env, params }) => {
  const email = await currentEmail(request, env.SESSION_SECRET)
  if (!email) return unauthorized()

  // Listing uploads on a deleted session is pointless — hide-from-all.
  const access = await requireSessionAccess(
    env.DB,
    params.id,
    { email, isAdmin: isAdmin(env, email) },
    { softDeleted: 'hide-from-all' },
  )
  if (access instanceof Response) return access
  const id = access.id

  // Pre-message uploads only. Linked attachments come back through the
  // /messages list — no point in showing them twice.
  const res = await env.DB.prepare(
    `SELECT ${ATTACHMENT_COLUMNS}
     FROM attachments
     WHERE session_id = ? AND uploaded_by = ? AND message_id IS NULL
     ORDER BY created_at ASC`,
  )
    .bind(id, email)
    .all<AttachmentRow>()

  return ok({ attachments: res.results ?? [] })
}
