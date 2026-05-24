// Attachments domain logic. Validation, R2 key generation, persistence
// helpers. Endpoints stay thin and delegate here.

import { randomTokenB64url } from './bytes'

/**
 * What an attachment *is*, decided once at upload time from its content type.
 *   file   — a document the visitor picked (image, PDF, Office, …). The
 *            original feat-message-attachments behaviour.
 *   voice  — an audio recording. Carries a `transcript` (Whisper at the edge).
 *   sketch — an Excalidraw scene (JSON). Re-openable + replayable in-thread.
 *   napkin — the intake-time PNG snapshot of the visitor's sketch. Session-
 *            scoped (never linked to a message); rendered in NapkinSection.
 *            Distinct from `sketch` so the orphan sweep can skip it (it's
 *            intentionally always message_id=NULL — see digest.ts), and so
 *            the one-per-session invariant has a kind to key on.
 * Stored explicitly rather than re-derived per render so the thread UI and
 * the orphan sweep don't each re-sniff MIME.
 */
export type AttachmentKind = 'file' | 'voice' | 'sketch' | 'napkin'

export interface AttachmentRow {
  id: string
  session_id: string
  message_id: string | null
  uploaded_by: string
  filename: string
  content_type: string
  size: number
  r2_key: string
  created_at: number
  /** 'file' | 'voice' | 'sketch'. Pre-feat-message-media rows read 'file'
   *  via the column DEFAULT. */
  kind: AttachmentKind
  /** Voice notes only: the edge-transcribed text. NULL otherwise, and NULL
   *  for a voice note uploaded while Workers AI was unavailable. */
  transcript: string | null
}

/** The full attachment column list, shared by every SELECT (here and in the
 *  endpoint handlers) so the row shape stays in lockstep with AttachmentRow. */
export const ATTACHMENT_COLUMNS = `id, session_id, message_id, uploaded_by, filename,
        content_type, size, r2_key, created_at, kind, transcript`

/** Content type for an Excalidraw scene attachment. Excalidraw's own
 *  vendor MIME — distinct from a generic application/json upload, so a
 *  sketch is never confused with a data file. */
export const EXCALIDRAW_CONTENT_TYPE = 'application/vnd.excalidraw+json'

/** Per-file ceiling. Pages Functions cap request bodies at 25 MiB on the
 * free tier and 100 MiB on Workers Paid; 10 MB is comfortable on both and
 * matches what visitors realistically attach (screenshots, scanned PDFs). */
export const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024

/** Per-voice-note ceiling. The recorder caps a clip at ~2 min; Opus at that
 *  length is well under 8 MB. Tighter than MAX_ATTACHMENT_SIZE because the
 *  voice path buffers the whole clip in memory (to feed Whisper) instead of
 *  streaming it straight to R2. */
export const MAX_VOICE_SIZE = 8 * 1024 * 1024

/** Per-sketch ceiling. An Excalidraw scene is JSON — even a busy napkin is a
 *  few hundred KB. 2 MB is generous headroom; the cap just stops a pathological
 *  payload from being buffered + parsed. */
export const MAX_SKETCH_SIZE = 2 * 1024 * 1024

/** Per-napkin ceiling. An Excalidraw-exported PNG at the canvas's natural
 *  resolution is comfortably under 2 MB; 4 MB gives us headroom for retina /
 *  very busy sketches without inviting full-resolution photos as "napkins". */
export const MAX_NAPKIN_SIZE = 4 * 1024 * 1024

/** Per-message ceiling. Server-enforced via the linker. */
export const MAX_ATTACHMENTS_PER_MESSAGE = 5

/** Per-session storage ceiling. Sum of all live attachments on a session
 * (linked or pre-message) can't exceed this. Roughly "a project's worth of
 * documents" — generous enough that no real flow hits it, tight enough that
 * a misbehaving client / compromised account can't burn R2 storage. */
export const MAX_ATTACHMENT_BYTES_PER_SESSION = 100 * 1024 * 1024

export async function totalAttachmentBytesForSession(
  db: D1Database,
  sessionId: string,
): Promise<number> {
  const row = await db
    .prepare(`SELECT COALESCE(SUM(size), 0) AS total FROM attachments WHERE session_id = ?`)
    .bind(sessionId)
    .first<{ total: number }>()
  return row?.total ?? 0
}

/**
 * Allow-list of MIME types. Block executables and shell scripts; everything
 * a small business is likely to share (images, PDFs, Word/Excel, plain text)
 * is welcome. Conservative by default — extend as needs surface.
 */
const ALLOWED_PREFIXES = ['image/', 'text/', 'audio/']
const ALLOWED_EXACT = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip',
  'application/json',
  EXCALIDRAW_CONTENT_TYPE,
])

/** Normalize a content type: lowercase, strip the `;codecs=…` / `;charset=…`
 *  parameter. MediaRecorder hands back e.g. `audio/webm;codecs=opus`. */
export function baseContentType(contentType: string): string {
  return contentType.toLowerCase().split(';')[0]?.trim() ?? ''
}

export function isAllowedContentType(contentType: string): boolean {
  const ct = baseContentType(contentType)
  if (!ct) return false
  if (ALLOWED_EXACT.has(ct)) return true
  return ALLOWED_PREFIXES.some((p) => ct.startsWith(p))
}

/**
 * Classify an attachment by its content type. The result is persisted in the
 * `kind` column so the thread renderer and the orphan sweep never re-sniff.
 *
 * `napkin` is intentionally NOT returned here — a napkin PNG looks like any
 * other image/png to the sniffer. The upload handler asks for it explicitly
 * via `?kind=napkin` (one per session, intake submission path).
 */
export function attachmentKind(contentType: string): AttachmentKind {
  const ct = baseContentType(contentType)
  if (ct.startsWith('audio/')) return 'voice'
  if (ct === EXCALIDRAW_CONTENT_TYPE) return 'sketch'
  return 'file'
}

/**
 * Look up the (at most one) napkin attachment for a session. Returns the row
 * if present, null otherwise. Used by the session-row SELECT to denormalize
 * `napkin_attachment_id` so SessionPage can build the URL in one round-trip,
 * and as a precondition check in the upload handler's one-per-session guard.
 */
export async function findNapkinForSession(
  db: D1Database,
  sessionId: string,
): Promise<AttachmentRow | null> {
  return db
    .prepare(
      `SELECT ${ATTACHMENT_COLUMNS}
       FROM attachments
       WHERE session_id = ? AND kind = 'napkin'
       LIMIT 1`,
    )
    .bind(sessionId)
    .first<AttachmentRow>()
}

/**
 * Magic-byte signatures for the high-value content types we accept. Used to
 * defend against a malicious client that lies about Content-Type (the
 * browser-supplied value isn't trustworthy). Bytes are the first N of the
 * file; we match a prefix. Text types are intentionally absent — they have
 * no reliable signature.
 */
const MAGIC_BYTES: Array<{ prefix: number[]; types: string[] }> = [
  { prefix: [0xff, 0xd8, 0xff], types: ['image/jpeg', 'image/jpg'] },
  { prefix: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], types: ['image/png'] },
  { prefix: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61], types: ['image/gif'] },
  { prefix: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61], types: ['image/gif'] },
  { prefix: [0x52, 0x49, 0x46, 0x46], types: ['image/webp'] }, // "RIFF" — webp prefix
  { prefix: [0x25, 0x50, 0x44, 0x46, 0x2d], types: ['application/pdf'] }, // %PDF-
  // Office docs (modern) + zip share the same magic bytes (PK\x03\x04) — we
  // accept the union; mime check above narrows further.
  {
    prefix: [0x50, 0x4b, 0x03, 0x04],
    types: [
      'application/zip',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ],
  },
  // Legacy Office (.doc/.xls/.ppt) — D0CF11E0A1B11AE1
  {
    prefix: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1],
    types: ['application/msword', 'application/vnd.ms-excel', 'application/vnd.ms-powerpoint'],
  },
  // WebM / Matroska (EBML header) — what MediaRecorder produces on Chrome +
  // Firefox for `audio/webm`.
  { prefix: [0x1a, 0x45, 0xdf, 0xa3], types: ['audio/webm'] },
  // Ogg ("OggS") — MediaRecorder's `audio/ogg` container.
  { prefix: [0x4f, 0x67, 0x67, 0x53], types: ['audio/ogg'] },
  // audio/mp4 (Safari) and audio/mpeg carry their signature at a non-zero
  // offset (or none at all), so they have no entry here and pass through —
  // the upload is already auth-gated + rate-limited; magic bytes are a
  // defence-in-depth layer, not the only gate.
]

/**
 * Buffer-based twin of verifyMagicBytes, for the voice + sketch paths which
 * read the whole upload into memory anyway (to transcribe / to parse). Same
 * contract: a content type with no known signature passes through.
 */
export function verifyMagicBytesBuffer(contentType: string, bytes: Uint8Array): boolean {
  const ct = baseContentType(contentType)
  const sig = MAGIC_BYTES.find((m) => m.types.includes(ct))
  if (!sig) return true
  if (bytes.length < sig.prefix.length) return false
  for (let i = 0; i < sig.prefix.length; i++) {
    if (bytes[i] !== sig.prefix[i]) return false
  }
  return true
}

/**
 * Read the first 12 bytes of the stream and verify they match the declared
 * content-type's known magic-byte signature. Returns `{ ok: true, stream }`
 * with a fresh ReadableStream the caller MUST use in place of the original
 * (the original was consumed). Returns `{ ok: false }` on mismatch or when
 * the type has no known signature *and* is one of the high-value classes we
 * insist on verifying. text/plain, application/json, and friends are passed
 * through (no signature exists for them).
 */
export async function verifyMagicBytes(file: {
  type: string
  stream: () => ReadableStream
}): Promise<{ ok: boolean; stream?: ReadableStream }> {
  const ct = file.type.toLowerCase().split(';')[0]?.trim() ?? ''
  const sig = MAGIC_BYTES.find((m) => m.types.includes(ct))
  if (!sig) {
    // No signature on file (text/*, json) — accept as-is.
    return { ok: true, stream: file.stream() }
  }
  const reader = file.stream().getReader()
  const chunks: Uint8Array[] = []
  let collected = 0
  // Pull until we have enough bytes for the longest known prefix.
  while (collected < sig.prefix.length) {
    const { value, done } = await reader.read()
    if (done) break
    if (value) {
      chunks.push(value)
      collected += value.byteLength
    }
  }
  // Concatenate the leading bytes we collected.
  const leading = new Uint8Array(collected)
  let offset = 0
  for (const c of chunks) {
    leading.set(c, offset)
    offset += c.byteLength
  }
  // Match
  if (leading.length < sig.prefix.length) {
    reader.releaseLock()
    return { ok: false }
  }
  for (let i = 0; i < sig.prefix.length; i++) {
    if (leading[i] !== sig.prefix[i]) {
      reader.releaseLock()
      return { ok: false }
    }
  }
  // Rewrap: emit the buffered bytes first, then pull the rest of the upstream.
  const pumped = new ReadableStream({
    async start(controller) {
      controller.enqueue(leading)
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        if (value) controller.enqueue(value)
      }
      controller.close()
    },
  })
  return { ok: true, stream: pumped }
}

/**
 * Generate the R2 object key. We keep the random ID as the key (no original
 * filename in the path) to avoid collisions and path-traversal classes. The
 * filename is preserved separately in the DB for display + Content-Disposition.
 */
export function r2KeyFor(sessionId: string, attachmentId: string): string {
  return `sessions/${sessionId}/${attachmentId}`
}

/**
 * Sanitize a filename for storage and Content-Disposition. Strips path
 * components, control chars, and limits length. Original may still contain
 * unicode — that's fine, the header gets RFC 5987 encoded at serve time.
 */
export function safeFilename(input: string, fallback = 'attachment'): string {
  let name = input.trim()
  // Drop directory components (Windows + POSIX)
  const i = Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\'))
  if (i >= 0) name = name.slice(i + 1)
  // Strip control bytes (  through  + DEL) so headers + DB stay clean.
  // eslint-disable-next-line no-control-regex
  name = name.replace(/[ -]/g, '')
  if (!name) return fallback
  // Cap to a reasonable length so DB rows don't bloat
  return name.slice(0, 200)
}

export function newAttachmentId(): string {
  return randomTokenB64url(12)
}

export async function listAttachmentsForMessage(
  db: D1Database,
  messageId: string,
): Promise<AttachmentRow[]> {
  const res = await db
    .prepare(
      `SELECT ${ATTACHMENT_COLUMNS}
       FROM attachments WHERE message_id = ? ORDER BY created_at ASC`,
    )
    .bind(messageId)
    .all<AttachmentRow>()
  return res.results ?? []
}

/**
 * Bulk fetch attachments for many messages in one shot. Returns a map
 * keyed by message_id. Used when listing a thread.
 */
export async function listAttachmentsForMessages(
  db: D1Database,
  messageIds: string[],
): Promise<Record<string, AttachmentRow[]>> {
  if (messageIds.length === 0) return {}
  const placeholders = messageIds.map(() => '?').join(',')
  const res = await db
    .prepare(
      `SELECT ${ATTACHMENT_COLUMNS}
       FROM attachments
       WHERE message_id IN (${placeholders})
       ORDER BY created_at ASC`,
    )
    .bind(...messageIds)
    .all<AttachmentRow>()
  const map: Record<string, AttachmentRow[]> = {}
  for (const a of res.results ?? []) {
    if (!a.message_id) continue
    if (!map[a.message_id]) map[a.message_id] = []
    map[a.message_id]!.push(a)
  }
  return map
}
