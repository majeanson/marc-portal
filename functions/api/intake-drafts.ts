// Cross-device intake drafts. The visitor types their intake on a phone, gets
// the magic link, opens it on desktop — without server-side storage, the draft
// only existed in the phone's localStorage and is lost. This endpoint is the
// fallback: every autosave POSTs here, the magic-link sign-in pulls from here.
//
// Endpoints:
//   GET    /api/intake-drafts   — return the draft for the signed-in email
//   POST   /api/intake-drafts   — upsert {payload}
//   DELETE /api/intake-drafts   — drop after a successful createSession()
//
// Anti-abuse: drafts are keyed by lowercased email; the auth cookie pins which
// email you can read/write. Ungated POST would be a write amplifier for the
// magic-link rate-limit table; we require auth.

import { currentEmail } from '../_lib/auth'
import type { Env } from '../_lib/env'
import { badRequest, ok, payloadTooLarge, unauthorized } from '../_lib/json'

interface DraftRow {
  email: string
  payload: string
  created_at: number
  updated_at: number
}

interface PostBody {
  payload?: unknown
}

const MAX_PAYLOAD_BYTES = 64 * 1024

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const email = await currentEmail(request, env.SESSION_SECRET)
  if (!email) return unauthorized()

  const row = await env.DB.prepare(
    `SELECT email, payload, created_at, updated_at FROM intake_drafts WHERE email = ?`,
  )
    .bind(email)
    .first<DraftRow>()

  if (!row) return ok({ draft: null })

  let parsed: unknown = null
  try {
    parsed = JSON.parse(row.payload)
  } catch {
    // corrupted draft — return null and let the visitor start fresh
    return ok({ draft: null })
  }
  return ok({
    draft: {
      payload: parsed,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    },
  })
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const email = await currentEmail(request, env.SESSION_SECRET)
  if (!email) return unauthorized()

  let body: PostBody
  try {
    body = (await request.json()) as PostBody
  } catch {
    return badRequest('invalid json')
  }
  if (body.payload === undefined || body.payload === null) {
    return badRequest('missing payload')
  }

  const serialized = typeof body.payload === 'string' ? body.payload : JSON.stringify(body.payload)
  if (serialized.length > MAX_PAYLOAD_BYTES) {
    return payloadTooLarge('intake draft too large')
  }

  const now = Math.floor(Date.now() / 1000)
  // INSERT-or-UPDATE keyed on the email PK. SQLite/D1 supports ON CONFLICT.
  await env.DB.prepare(
    `INSERT INTO intake_drafts (email, payload, created_at, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(email) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`,
  )
    .bind(email, serialized, now, now)
    .run()

  return ok({ saved: true, updatedAt: now })
}

export const onRequestDelete: PagesFunction<Env> = async ({ request, env }) => {
  const email = await currentEmail(request, env.SESSION_SECRET)
  if (!email) return unauthorized()

  await env.DB.prepare(`DELETE FROM intake_drafts WHERE email = ?`).bind(email).run()
  return ok({ ok: true })
}
