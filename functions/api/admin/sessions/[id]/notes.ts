// GET  /api/admin/sessions/:id/notes — read the operator note for a session
// PUT  /api/admin/sessions/:id/notes — upsert the note body
// DELETE /api/admin/sessions/:id/notes — remove it
//
// Admin-only free-text scratch pad. One row per session (operator_notes
// table is keyed on session_id). The body holds anything Marc wants to
// remember about a session that doesn't belong in the visitor-facing
// thread — meeting notes, scope-creep callouts, follow-up reminders.
//
// CSRF: not exempt. PUT/DELETE flow through the standard double-submit
// cookie gate in _middleware.ts.

import { currentEmail } from '../../../../_lib/auth'
import type { Env } from '../../../../_lib/env'
import { isAdmin } from '../../../../_lib/env'
import {
  badRequest,
  forbidden,
  notFound,
  ok,
  payloadTooLarge,
  unauthorized,
} from '../../../../_lib/json'
import { loadSession } from '../../../../_lib/sessions'

/** Server-side ceiling on note body. ~4 KB is comfortably above any
 *  realistic operator memo while bounding a paste-bomb. Stored as TEXT
 *  in SQLite (no schema-level cap); enforcing here keeps the storage
 *  predictable and saves a future migration to add a CHECK. */
const MAX_BODY_BYTES = 4096

export interface OperatorNote {
  sessionId: string
  body: string
  updatedAt: number
  updatedBy: string
}

interface OperatorNoteResponse {
  note: OperatorNote | null
}

interface NoteRow {
  session_id: string
  body: string
  updated_at: number
  updated_by: string
}

async function requireAdminAndSession(
  request: Request,
  env: Env,
  rawId: unknown,
): Promise<{ email: string; sessionId: string } | Response> {
  const email = await currentEmail(request, env.SESSION_SECRET)
  if (!email) return unauthorized()
  if (!isAdmin(env, email)) return forbidden()
  const id = typeof rawId === 'string' ? rawId : String(rawId ?? '')
  if (!id) return badRequest('missing id')
  // Verify the session exists; admin sees soft-deleted rows too (trash
  // recovery + after-the-fact note edits). Hiding from non-admin doesn't
  // apply here — the guard above already required admin.
  const session = await loadSession(env.DB, id)
  if (!session) return notFound()
  return { email, sessionId: session.id }
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env, params }) => {
  const guard = await requireAdminAndSession(request, env, params.id)
  if (guard instanceof Response) return guard
  const { sessionId } = guard

  let row: NoteRow | null = null
  try {
    row = await env.DB.prepare(
      `SELECT session_id, body, updated_at, updated_by
         FROM operator_notes WHERE session_id = ?`,
    )
      .bind(sessionId)
      .first<NoteRow>()
  } catch (err) {
    // Pre-migration fallback (table doesn't exist yet) — return null so
    // the SessionPage admin panel still mounts cleanly.
    const msg = err instanceof Error ? err.message : String(err)
    if (!/no such table/.test(msg)) throw err
    row = null
  }

  const response: OperatorNoteResponse = {
    note: row
      ? {
          sessionId: row.session_id,
          body: row.body,
          updatedAt: row.updated_at,
          updatedBy: row.updated_by,
        }
      : null,
  }
  return ok(response)
}

interface PutBody {
  body?: unknown
}

export const onRequestPut: PagesFunction<Env> = async ({ request, env, params }) => {
  const guard = await requireAdminAndSession(request, env, params.id)
  if (guard instanceof Response) return guard
  const { email, sessionId } = guard

  let payload: PutBody
  try {
    payload = (await request.json()) as PutBody
  } catch {
    return badRequest('invalid json')
  }
  if (typeof payload.body !== 'string') return badRequest('body must be a string')
  const trimmed = payload.body.trim()
  // Treat empty-string PUT as a deletion. The client uses DELETE for an
  // explicit "remove note", but a Save on an empty textarea should also
  // tidy up rather than persist whitespace.
  if (trimmed.length === 0) {
    await env.DB.prepare(`DELETE FROM operator_notes WHERE session_id = ?`).bind(sessionId).run()
    return ok({ note: null } satisfies OperatorNoteResponse)
  }
  // Bytes, not characters — the storage limit is bytes, and a paste of
  // emoji-heavy text can balloon a 4000-char string past 4 KB.
  const byteLength = new TextEncoder().encode(trimmed).length
  if (byteLength > MAX_BODY_BYTES) return payloadTooLarge('note body too large')

  const now = Math.floor(Date.now() / 1000)
  await env.DB.prepare(
    `INSERT INTO operator_notes (session_id, body, updated_by, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(session_id) DO UPDATE SET
       body = excluded.body,
       updated_by = excluded.updated_by,
       updated_at = excluded.updated_at`,
  )
    .bind(sessionId, trimmed, email, now)
    .run()

  const note: OperatorNote = {
    sessionId,
    body: trimmed,
    updatedAt: now,
    updatedBy: email,
  }
  return ok({ note } satisfies OperatorNoteResponse)
}

export const onRequestDelete: PagesFunction<Env> = async ({ request, env, params }) => {
  const guard = await requireAdminAndSession(request, env, params.id)
  if (guard instanceof Response) return guard
  const { sessionId } = guard
  await env.DB.prepare(`DELETE FROM operator_notes WHERE session_id = ?`).bind(sessionId).run()
  return ok({ note: null } satisfies OperatorNoteResponse)
}
