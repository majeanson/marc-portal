// feat-template-volunteer-roster
// POST   /api/volunteer/signups        — sign up for a shift (any signed-in user)
// DELETE /api/volunteer/signups/:id    — cancel own signup (or owner cancels another's)
//
// Tenant-scoped, template-gated. POST returns the slot-fill count after
// commit so the SPA can update its display in one round-trip.

import { currentEmail } from '../../_lib/auth'
import { randomTokenB64url } from '../../_lib/bytes'
import type { Env } from '../../_lib/env'
import { isAdmin } from '../../_lib/env'
import {
  badRequest,
  forbidden,
  notFound,
  ok,
  unauthorized,
} from '../../_lib/json'
import { requireTenant } from '../../_lib/tenant'

export interface Signup {
  id: string
  shiftId: string
  volunteerEmail: string
  volunteerName: string | null
  status: 'confirmed' | 'cancelled'
  createdAt: number
}

interface SignupRow {
  id: string
  shift_id: string
  volunteer_email: string
  volunteer_name: string | null
  status: 'confirmed' | 'cancelled'
  created_at: number
}

function rowToSignup(r: SignupRow): Signup {
  return {
    id: r.id,
    shiftId: r.shift_id,
    volunteerEmail: r.volunteer_email,
    volunteerName: r.volunteer_name,
    status: r.status,
    createdAt: r.created_at,
  }
}

interface CreateBody {
  shiftId?: unknown
  name?: unknown
}

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const tenant = requireTenant(ctx)
  if (tenant.templateId !== 'volunteer-roster') return notFound()

  const email = await currentEmail(ctx.request, ctx.env.SESSION_SECRET)
  if (!email) return unauthorized()

  let body: CreateBody
  try {
    body = (await ctx.request.json()) as CreateBody
  } catch {
    return badRequest('invalid json')
  }

  const shiftId = typeof body.shiftId === 'string' ? body.shiftId.trim() : ''
  if (!shiftId) return badRequest('shiftId required')
  const name =
    typeof body.name === 'string' && body.name.trim().length > 0
      ? body.name.trim().slice(0, 80)
      : null

  // Verify the shift exists in this tenant. Avoids cross-tenant id guessing.
  const shift = await ctx.env.DB.prepare(
    `SELECT id, slots_needed FROM vr_shifts WHERE id = ? AND tenant_id = ?`,
  )
    .bind(shiftId, tenant.id)
    .first<{ id: string; slots_needed: number }>()
  if (!shift) return notFound()

  const id = `vrs_${randomTokenB64url(10).toLowerCase()}`
  const now = Math.floor(Date.now() / 1000)

  // The UNIQUE (shift_id, volunteer_email) constraint catches double-signup.
  // We translate it into a 200 with the existing row so the UX is idempotent.
  try {
    await ctx.env.DB.prepare(
      `INSERT INTO vr_signups
         (id, tenant_id, shift_id, volunteer_email, volunteer_name, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'confirmed', ?)`,
    )
      .bind(id, tenant.id, shiftId, email.toLowerCase(), name, now)
      .run()
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    if (!msg.includes('UNIQUE')) throw err
    // Existing signup — flip back to 'confirmed' if it was previously cancelled.
    await ctx.env.DB.prepare(
      `UPDATE vr_signups
          SET status = 'confirmed', volunteer_name = COALESCE(?, volunteer_name)
        WHERE shift_id = ? AND volunteer_email = ? AND tenant_id = ?`,
    )
      .bind(name, shiftId, email.toLowerCase(), tenant.id)
      .run()
  }

  // Return the latest state of the signup + the new fill count.
  const row = await ctx.env.DB.prepare(
    `SELECT id, shift_id, volunteer_email, volunteer_name, status, created_at
       FROM vr_signups
      WHERE shift_id = ? AND volunteer_email = ? AND tenant_id = ?
      LIMIT 1`,
  )
    .bind(shiftId, email.toLowerCase(), tenant.id)
    .first<SignupRow>()

  const filled = await ctx.env.DB.prepare(
    `SELECT COUNT(*) AS n FROM vr_signups
      WHERE shift_id = ? AND status = 'confirmed' AND tenant_id = ?`,
  )
    .bind(shiftId, tenant.id)
    .first<{ n: number }>()

  return ok({
    signup: row ? rowToSignup(row) : null,
    filled: filled?.n ?? 0,
  })
}

export const onRequestDelete: PagesFunction<Env> = async (ctx) => {
  const tenant = requireTenant(ctx)
  if (tenant.templateId !== 'volunteer-roster') return notFound()

  const email = await currentEmail(ctx.request, ctx.env.SESSION_SECRET)
  if (!email) return unauthorized()

  const id = String(ctx.params.id ?? '')
  if (!id) return badRequest('missing id')

  const row = await ctx.env.DB.prepare(
    `SELECT id, shift_id, volunteer_email, volunteer_name, status, created_at
       FROM vr_signups
      WHERE id = ? AND tenant_id = ?`,
  )
    .bind(id, tenant.id)
    .first<SignupRow>()
  if (!row) return notFound()

  // Self-cancel OR owner-cancel-on-behalf.
  const isOwner =
    tenant.ownerEmail.toLowerCase() === email.toLowerCase() ||
    (isAdmin(ctx.env, email) && tenant.flags.isOperator === true)
  if (row.volunteer_email.toLowerCase() !== email.toLowerCase() && !isOwner) {
    return forbidden()
  }

  await ctx.env.DB.prepare(
    `UPDATE vr_signups SET status = 'cancelled' WHERE id = ? AND tenant_id = ?`,
  )
    .bind(id, tenant.id)
    .run()

  const filled = await ctx.env.DB.prepare(
    `SELECT COUNT(*) AS n FROM vr_signups
      WHERE shift_id = ? AND status = 'confirmed' AND tenant_id = ?`,
  )
    .bind(row.shift_id, tenant.id)
    .first<{ n: number }>()

  return ok({ shiftId: row.shift_id, filled: filled?.n ?? 0 })
}
