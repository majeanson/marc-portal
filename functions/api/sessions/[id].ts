// GET   /api/sessions/:id — fetch a single session (visitor: own; admin: any)
// PATCH /api/sessions/:id — admin-only status transition. Visitor cannot
//                           change status; that's Marc's triage decision.

import { currentEmail } from '../../_lib/auth'
import type { Env } from '../../_lib/env'
import { isAdmin } from '../../_lib/env'
import { badRequest, forbidden, notFound, ok, unauthorized } from '../../_lib/json'
import { canAccessSession, isValidStatus } from '../../_lib/sessions'
import type { SessionRow } from '../../_lib/sessions'

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

  return ok({ session })
}

interface PatchBody {
  status?: unknown
  intakeJson?: unknown
}

export const onRequestPatch: PagesFunction<Env> = async ({ request, env, params }) => {
  const email = await currentEmail(request, env.SESSION_SECRET)
  if (!email) return unauthorized()
  const id = String(params.id ?? '')
  if (!id) return badRequest('missing id')

  const session = await loadSession(env, id)
  if (!session) return notFound()

  let body: PatchBody
  try {
    body = (await request.json()) as PatchBody
  } catch {
    return badRequest('invalid json')
  }

  const admin = isAdmin(env, email)
  const now = Math.floor(Date.now() / 1000)

  // Status changes are admin-only — that's the triage decision.
  if (body.status !== undefined) {
    if (!admin) return forbidden('only admin can change status')
    if (!isValidStatus(body.status)) return badRequest('invalid status')
    await env.DB.prepare(`UPDATE sessions SET status = ?, updated_at = ? WHERE id = ?`)
      .bind(body.status, now, id)
      .run()
  }

  // intakeJson edits are visitor-self or admin-on-anyone (the visitor can
  // refine their own draft; admin can also patch on a visitor's behalf).
  if (body.intakeJson !== undefined) {
    if (!canAccessSession(email, admin, session)) return forbidden()
    const intake =
      body.intakeJson === null
        ? null
        : typeof body.intakeJson === 'string'
          ? body.intakeJson
          : JSON.stringify(body.intakeJson)
    await env.DB.prepare(`UPDATE sessions SET intake_json = ?, updated_at = ? WHERE id = ?`)
      .bind(intake, now, id)
      .run()
  }

  const fresh = await loadSession(env, id)
  return ok({ session: fresh })
}
