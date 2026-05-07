// GET  /api/sessions — list sessions. Visitor sees their own; Marc sees all.
// POST /api/sessions — create a session for the current user, status=draft.
// One session per intake submission; the body carries the intake_json blob.

import { currentEmail } from '../../_lib/auth'
import { randomTokenB64url } from '../../_lib/bytes'
import type { Env } from '../../_lib/env'
import { isAdmin } from '../../_lib/env'
import { badRequest, ok, unauthorized } from '../../_lib/json'
import type { SessionRow } from '../../_lib/sessions'

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const email = await currentEmail(request, env.SESSION_SECRET)
  if (!email) return unauthorized()

  const admin = isAdmin(env, email)
  const stmt = admin
    ? env.DB.prepare(
        `SELECT id, email, intake_json, status, created_at, updated_at
         FROM sessions ORDER BY updated_at DESC`,
      )
    : env.DB.prepare(
        `SELECT id, email, intake_json, status, created_at, updated_at
         FROM sessions WHERE email = ? ORDER BY updated_at DESC`,
      ).bind(email)

  const res = await stmt.all<SessionRow>()
  return ok({ sessions: res.results ?? [] })
}

interface CreateBody {
  intakeJson?: unknown
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const email = await currentEmail(request, env.SESSION_SECRET)
  if (!email) return unauthorized()

  let body: CreateBody
  try {
    body = (await request.json()) as CreateBody
  } catch {
    return badRequest('invalid json')
  }

  // intake_json is stored as text; we accept either a stringified JSON or an
  // object that we serialize. Either way it's opaque to the server.
  let intakeJson: string | null = null
  if (body.intakeJson !== undefined && body.intakeJson !== null) {
    intakeJson =
      typeof body.intakeJson === 'string' ? body.intakeJson : JSON.stringify(body.intakeJson)
  }

  const id = randomTokenB64url(12)
  const now = Math.floor(Date.now() / 1000)

  await env.DB.prepare(
    `INSERT INTO sessions (id, email, intake_json, status, created_at, updated_at)
     VALUES (?, ?, ?, 'draft', ?, ?)`,
  )
    .bind(id, email, intakeJson, now, now)
    .run()

  const row: SessionRow = {
    id,
    email,
    intake_json: intakeJson,
    status: 'draft',
    created_at: now,
    updated_at: now,
  }
  return ok({ session: row })
}
