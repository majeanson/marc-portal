// GET  /api/sessions — list sessions. Visitor sees their own; an operator
// (admin email + isOperator tenant) sees all sessions in this tenant.
// POST /api/sessions — create a session for the current user, status=draft.
// One session per intake submission; the body carries the intake_json blob.
//
// Tenant-scoped: every read filters by tenant_id and every write tags it.

import { currentEmail } from '../../_lib/auth'
import { randomTokenB64url } from '../../_lib/bytes'
import type { Env } from '../../_lib/env'
import { isAdmin } from '../../_lib/env'
import { badRequest, ok, unauthorized } from '../../_lib/json'
import type { SessionRow } from '../../_lib/sessions'
import { requireTenant } from '../../_lib/tenant'

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const tenant = requireTenant(ctx)
  const email = await currentEmail(ctx.request, ctx.env.SESSION_SECRET)
  if (!email) return unauthorized()

  // Operator on operator tenant sees all sessions for *this* tenant. They do
  // NOT see other tenants' sessions — that would require a fleet-wide query
  // and a separate operator-only endpoint.
  const isOperatorView = isAdmin(ctx.env, email) && tenant.flags.isOperator === true

  const stmt = isOperatorView
    ? ctx.env.DB.prepare(
        `SELECT id, email, intake_json, status, created_at, updated_at
           FROM sessions WHERE tenant_id = ? ORDER BY updated_at DESC`,
      ).bind(tenant.id)
    : ctx.env.DB.prepare(
        `SELECT id, email, intake_json, status, created_at, updated_at
           FROM sessions WHERE tenant_id = ? AND email = ? ORDER BY updated_at DESC`,
      ).bind(tenant.id, email)

  const res = await stmt.all<SessionRow>()
  return ok({ sessions: res.results ?? [] })
}

interface CreateBody {
  intakeJson?: unknown
}

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const tenant = requireTenant(ctx)
  const email = await currentEmail(ctx.request, ctx.env.SESSION_SECRET)
  if (!email) return unauthorized()

  let body: CreateBody
  try {
    body = (await ctx.request.json()) as CreateBody
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

  await ctx.env.DB.prepare(
    `INSERT INTO sessions (id, email, intake_json, status, created_at, updated_at, tenant_id)
     VALUES (?, ?, ?, 'draft', ?, ?, ?)`,
  )
    .bind(id, email, intakeJson, now, now, tenant.id)
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
