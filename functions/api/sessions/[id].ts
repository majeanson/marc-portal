// GET   /api/sessions/:id — fetch a single session (visitor: own; operator: any in this tenant)
// PATCH /api/sessions/:id — operator-only status transition. Visitor cannot
//                           change status; that's Marc's triage decision.
//
// Tenant-scoped: the session must belong to the resolved tenant; otherwise 404.

import { currentEmail } from '../../_lib/auth'
import type { Env } from '../../_lib/env'
import { isAdmin } from '../../_lib/env'
import { badRequest, forbidden, notFound, ok, unauthorized } from '../../_lib/json'
import { canAccessSession, isValidStatus } from '../../_lib/sessions'
import type { SessionRow } from '../../_lib/sessions'
import { requireTenant } from '../../_lib/tenant'

async function loadSession(env: Env, tenantId: string, id: string): Promise<SessionRow | null> {
  return env.DB.prepare(
    `SELECT id, email, intake_json, status, created_at, updated_at
       FROM sessions WHERE id = ? AND tenant_id = ?`,
  )
    .bind(id, tenantId)
    .first<SessionRow>()
}

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const tenant = requireTenant(ctx)
  const email = await currentEmail(ctx.request, ctx.env.SESSION_SECRET)
  if (!email) return unauthorized()
  const id = String(ctx.params.id ?? '')
  if (!id) return badRequest('missing id')

  const session = await loadSession(ctx.env, tenant.id, id)
  if (!session) return notFound()
  const isOperatorView = isAdmin(ctx.env, email) && tenant.flags.isOperator === true
  if (!canAccessSession(email, isOperatorView, session)) return forbidden()

  return ok({ session })
}

interface PatchBody {
  status?: unknown
  intakeJson?: unknown
}

export const onRequestPatch: PagesFunction<Env> = async (ctx) => {
  const tenant = requireTenant(ctx)
  const email = await currentEmail(ctx.request, ctx.env.SESSION_SECRET)
  if (!email) return unauthorized()
  const id = String(ctx.params.id ?? '')
  if (!id) return badRequest('missing id')

  const session = await loadSession(ctx.env, tenant.id, id)
  if (!session) return notFound()

  let body: PatchBody
  try {
    body = (await ctx.request.json()) as PatchBody
  } catch {
    return badRequest('invalid json')
  }

  const isOperatorView = isAdmin(ctx.env, email) && tenant.flags.isOperator === true
  const now = Math.floor(Date.now() / 1000)

  // Status changes are operator-only — that's the triage decision.
  if (body.status !== undefined) {
    if (!isOperatorView) return forbidden('only operator can change status')
    if (!isValidStatus(body.status)) return badRequest('invalid status')
    await ctx.env.DB.prepare(
      `UPDATE sessions SET status = ?, updated_at = ? WHERE id = ? AND tenant_id = ?`,
    )
      .bind(body.status, now, id, tenant.id)
      .run()
  }

  // intakeJson edits are visitor-self or operator-on-anyone.
  if (body.intakeJson !== undefined) {
    if (!canAccessSession(email, isOperatorView, session)) return forbidden()
    const intake =
      body.intakeJson === null
        ? null
        : typeof body.intakeJson === 'string'
          ? body.intakeJson
          : JSON.stringify(body.intakeJson)
    await ctx.env.DB.prepare(
      `UPDATE sessions SET intake_json = ?, updated_at = ? WHERE id = ? AND tenant_id = ?`,
    )
      .bind(intake, now, id, tenant.id)
      .run()
  }

  const fresh = await loadSession(ctx.env, tenant.id, id)
  return ok({ session: fresh })
}
