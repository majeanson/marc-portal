// GET    /api/sessions/:id  — fetch a single session (visitor: own; admin: any)
// PATCH  /api/sessions/:id  — admin-only status; visitor or admin intakeJson;
//                             optimistic concurrency via ifUpdatedAt.
// DELETE /api/sessions/:id  — soft delete (sets deleted_at). Self or admin.

import { currentEmail } from '../../_lib/auth'
import {
  sendIntakeEditedNotification,
  sendStatusChangeNotification,
  sendWithdrawalNotification,
} from '../../_lib/email'
import type { Env } from '../../_lib/env'
import { isAdmin } from '../../_lib/env'
import { badRequest, conflict, forbidden, notFound, ok, unauthorized } from '../../_lib/json'
import {
  appendStatusHistory,
  canAccessSession,
  countActiveAndTriage,
  isActiveAtCap,
  isTriageAtCap,
  isValidStatus,
  loadSession,
  primaryAdminEmail,
  visitorLang,
} from '../../_lib/sessions'
import type { StatusHistoryEntry } from '../../_lib/sessions'

export const onRequestGet: PagesFunction<Env> = async ({ request, env, params }) => {
  const email = await currentEmail(request, env.SESSION_SECRET)
  if (!email) return unauthorized()
  const id = String(params.id ?? '')
  if (!id) return badRequest('missing id')

  const session = await loadSession(env.DB, id)
  if (!session) return notFound()
  if (!canAccessSession(email, isAdmin(env, email), session)) return forbidden()
  // Soft-deleted rows: visitors get 404; admins still see them by id.
  if (session.deleted_at && !isAdmin(env, email)) return notFound()

  return ok({ session })
}

interface PatchBody {
  status?: unknown
  intakeJson?: unknown
  ifUpdatedAt?: unknown
  /** Admin-only: restore a soft-deleted session (clears deleted_at). */
  undelete?: unknown
  /** Admin-only: opt this session into / out of the public /projects gallery
   * and edit its display title + tagline. Object shape:
   *   showcase: { enabled?: boolean, title?: string|null, tagline?: string|null }
   * Setting enabled flips showcased_at to now() / null. Title and tagline can
   * be updated independently of enabled. */
  showcase?: unknown
  /** Admin-only: tier classification (0/1/2/3) or null to clear. */
  tier?: unknown
}

export const onRequestPatch: PagesFunction<Env> = async ({ request, env, params }) => {
  const email = await currentEmail(request, env.SESSION_SECRET)
  if (!email) return unauthorized()
  const id = String(params.id ?? '')
  if (!id) return badRequest('missing id')

  const session = await loadSession(env.DB, id)
  if (!session) return notFound()

  let body: PatchBody
  try {
    body = (await request.json()) as PatchBody
  } catch {
    return badRequest('invalid json')
  }

  const admin = isAdmin(env, email)
  const now = Math.floor(Date.now() / 1000)
  const origin = new URL(request.url).origin

  // Undelete is admin-only and is the *only* PATCH operation valid against a
  // soft-deleted row. Everything else 404s once the row is in trash.
  if (body.undelete === true) {
    if (!admin) return forbidden('only admin can restore')
    if (!session.deleted_at) return ok({ session })
    await env.DB.prepare(`UPDATE sessions SET deleted_at = NULL, updated_at = ? WHERE id = ?`)
      .bind(now, id)
      .run()
    const fresh = await loadSession(env.DB, id)
    return ok({ session: fresh })
  }
  if (session.deleted_at) return notFound()

  // Optimistic concurrency: if the client tells us what version they edited,
  // refuse the patch when the row has changed since. Caller refreshes and
  // retries. Accepts only numbers; missing/invalid is treated as no check.
  if (typeof body.ifUpdatedAt === 'number' && body.ifUpdatedAt !== session.updated_at) {
    return conflict('session has changed since you loaded it')
  }

  // Status changes are admin-only — that's the triage decision.
  let statusChanged: { from: typeof session.status; to: typeof session.status } | null = null
  if (body.status !== undefined) {
    if (!admin) return forbidden('only admin can change status')
    if (!isValidStatus(body.status)) return badRequest('invalid status')
    if (body.status !== session.status) {
      // Bedrock cap enforcement: transitions *into* `triage` or `active` are
      // checked against the live counts (excluding this row, since it may
      // already be in the bucket we're checking against). 409 is the structural
      // signal — admin sees a clear "at cap" message and can ship/reject the
      // current occupant first.
      if (body.status === 'triage' || body.status === 'active') {
        const counts = await countActiveAndTriage(env.DB, id)
        if (body.status === 'triage' && isTriageAtCap(counts)) {
          return conflict('triage at capacity — ship or reject the current entry first')
        }
        if (body.status === 'active' && isActiveAtCap(counts)) {
          return conflict('active at capacity — ship or reject the current build first')
        }
      }
      const entry: StatusHistoryEntry = {
        from: session.status,
        to: body.status,
        by: email,
        at: now,
      }
      const nextHistory = appendStatusHistory(session.status_history, entry)
      await env.DB.prepare(
        `UPDATE sessions SET status = ?, status_history = ?, updated_at = ? WHERE id = ?`,
      )
        .bind(body.status, nextHistory, now, id)
        .run()
      statusChanged = { from: session.status, to: body.status }
    }
  }

  // intakeJson edits are visitor-self or admin-on-anyone (the visitor can
  // refine their own draft; admin can also patch on a visitor's behalf).
  let intakeEdited = false
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
    intakeEdited = intake !== session.intake_json
  }

  // Showcase fields — admin-only. Object shape lets us patch enabled / title
  // / tagline independently. enabled flips showcased_at to now / null.
  if (body.showcase !== undefined) {
    if (!admin) return forbidden('only admin can showcase a session')
    if (!body.showcase || typeof body.showcase !== 'object') {
      return badRequest('showcase must be an object')
    }
    const sc = body.showcase as {
      enabled?: unknown
      title?: unknown
      tagline?: unknown
    }
    const updates: { col: string; val: unknown }[] = []
    if (sc.enabled !== undefined) {
      if (typeof sc.enabled !== 'boolean') {
        return badRequest('showcase.enabled must be a boolean')
      }
      updates.push({ col: 'showcased_at', val: sc.enabled ? now : null })
    }
    if (sc.title !== undefined) {
      if (sc.title === null) {
        updates.push({ col: 'showcase_title', val: null })
      } else if (typeof sc.title === 'string') {
        const trimmed = sc.title.trim().slice(0, 200)
        updates.push({ col: 'showcase_title', val: trimmed.length > 0 ? trimmed : null })
      } else {
        return badRequest('showcase.title must be a string or null')
      }
    }
    if (sc.tagline !== undefined) {
      if (sc.tagline === null) {
        updates.push({ col: 'showcase_tagline', val: null })
      } else if (typeof sc.tagline === 'string') {
        const trimmed = sc.tagline.trim().slice(0, 500)
        updates.push({ col: 'showcase_tagline', val: trimmed.length > 0 ? trimmed : null })
      } else {
        return badRequest('showcase.tagline must be a string or null')
      }
    }
    if (updates.length > 0) {
      const setClause = updates.map((u) => `${u.col} = ?`).join(', ') + ', updated_at = ?'
      await env.DB.prepare(`UPDATE sessions SET ${setClause} WHERE id = ?`)
        .bind(...updates.map((u) => u.val), now, id)
        .run()
    }
  }

  // Tier — admin-only. Accepts 0/1/2/3 or null to clear. Anything else 400s.
  if (body.tier !== undefined) {
    if (!admin) return forbidden('only admin can set tier')
    if (
      body.tier !== null &&
      (typeof body.tier !== 'number' || ![0, 1, 2, 3].includes(body.tier))
    ) {
      return badRequest('tier must be 0, 1, 2, 3, or null')
    }
    await env.DB.prepare(`UPDATE sessions SET tier = ?, updated_at = ? WHERE id = ?`)
      .bind(body.tier, now, id)
      .run()
  }

  const fresh = await loadSession(env.DB, id)

  // Best-effort notifications. Failures are logged but don't fail the PATCH —
  // the data is in D1; emails are nudges.
  if (statusChanged && fresh) {
    await sendStatusChangeNotification(
      env.RESEND_API_KEY,
      fresh.email,
      id,
      statusChanged.from,
      statusChanged.to,
      origin,
      visitorLang(fresh),
    )
  }
  // Visitor edited their own intake → notify Marc. Admin self-editing on
  // someone's behalf is not surfaced (Marc already knows).
  if (intakeEdited && !admin && fresh) {
    const marc = primaryAdminEmail(env.ADMIN_EMAILS)
    if (marc) {
      await sendIntakeEditedNotification(env.RESEND_API_KEY, marc, fresh.email, id, origin)
    }
  }

  return ok({ session: fresh })
}

export const onRequestDelete: PagesFunction<Env> = async ({ request, env, params }) => {
  const email = await currentEmail(request, env.SESSION_SECRET)
  if (!email) return unauthorized()
  const id = String(params.id ?? '')
  if (!id) return badRequest('missing id')

  const session = await loadSession(env.DB, id)
  if (!session) return notFound()
  if (session.deleted_at) return ok({ ok: true })

  const admin = isAdmin(env, email)
  if (!canAccessSession(email, admin, session)) return forbidden()

  const now = Math.floor(Date.now() / 1000)
  await env.DB.prepare(`UPDATE sessions SET deleted_at = ?, updated_at = ? WHERE id = ?`)
    .bind(now, now, id)
    .run()

  // Symmetric notification: visitor self-withdraws → Marc; Marc force-deletes
  // someone else's → visitor. Both are best-effort; the soft-delete is the
  // source of truth.
  const origin = new URL(request.url).origin
  if (admin && session.email !== email) {
    await sendWithdrawalNotification(
      env.RESEND_API_KEY,
      session.email,
      email,
      id,
      origin,
      visitorLang(session),
      'visitor',
    )
  } else {
    const marc = primaryAdminEmail(env.ADMIN_EMAILS)
    if (marc && marc.toLowerCase() !== email.toLowerCase()) {
      await sendWithdrawalNotification(env.RESEND_API_KEY, marc, email, id, origin, 'en', 'admin')
    }
  }

  return ok({ ok: true })
}
