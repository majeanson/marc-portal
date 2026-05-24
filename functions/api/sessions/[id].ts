// GET    /api/sessions/:id  — fetch a single session (visitor: own; admin: any)
// PATCH  /api/sessions/:id  — admin-only status; visitor or admin intakeJson;
//                             optimistic concurrency via ifUpdatedAt.
// DELETE /api/sessions/:id  — soft delete (sets deleted_at). Self or admin.

import { currentEmail } from '../../_lib/auth'
import {
  sendAllYoursAckNotification,
  sendIntakeEditedNotification,
  sendStatusChangeNotification,
  sendTierAssignedNotification,
  sendWithdrawalNotification,
} from '../../_lib/email'
import type { Env } from '../../_lib/env'
import { isAdmin } from '../../_lib/env'
import { badRequest, conflict, forbidden, notFound, ok, unauthorized } from '../../_lib/json'
import {
  appendStatusHistory,
  canAccessSession,
  isValidStatus,
  loadSession,
  primaryAdminEmail,
  requireSessionAccess,
} from '../../_lib/sessions'
import type { StatusHistoryEntry } from '../../_lib/sessions'
import { getLang } from '../../_lib/userPrefs'

export const onRequestGet: PagesFunction<Env> = async ({ request, env, params }) => {
  const email = await currentEmail(request, env.SESSION_SECRET)
  if (!email) return unauthorized()

  // Soft-deleted rows: visitors get 404; admin still loads them (trash UI).
  const access = await requireSessionAccess(env.DB, params.id, {
    email,
    isAdmin: isAdmin(env, email),
  })
  if (access instanceof Response) return access

  return ok({ session: access })
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
  /** Admin-only: Tier-4 quoted amount in CAD cents, or null to clear.
   * Used by /api/payments/checkout when the visitor self-pays a tier-4
   * project. 10000 (100 CAD) .. 10000000 (100000 CAD). */
  tier4AmountCents?: unknown
  /** Admin-only: Tier-3 installment split — '50-50' | '40-40-20' | null. */
  tier3Split?: unknown
  /** Visitor-self or admin: explicit acknowledgment of "Tout à toi"
   *  mode (opting out of Custodian). Pass `true` to set
   *  all_yours_acknowledged_at to now; `false` to clear it back to NULL.
   *  Only the session owner or admin can set this. Best-effort email to
   *  Marc on the first-time set. */
  acknowledgeAllYours?: unknown
  /** Admin-only: the "generous no" note shown to the visitor on a rejected
   *  session. A string sets it; null or empty string clears it. */
  declineNote?: unknown
  /** Admin-only: community-pricing flag (boolean). When set true, the
   *  session's build-tier installments are charged at the COMMUNITY_DISCOUNT_PCT
   *  reduction. **Frozen** once any `build` payment row reaches `status='paid'`
   *  — toggling either way after that returns 409 to keep the visitor's paid
   *  legs and unpaid legs at the same rate. Same atomic WHERE-guard shape as
   *  the capacity cap (no read-then-write race). */
  communityDiscount?: unknown
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
      // Bedrock cap enforcement, atomic: for transitions *into* `triage` or
      // `active`, the cap check is folded into the UPDATE's WHERE clause via a
      // subselect. If the count is already at cap, the UPDATE affects 0 rows
      // and we return 409. This closes the read-then-write race that the prior
      // two-step pattern had — two admins promoting two drafts to triage at
      // the same time can no longer both succeed.
      const entry: StatusHistoryEntry = {
        from: session.status,
        to: body.status,
        by: email,
        at: now,
      }
      const nextHistory = appendStatusHistory(session.status_history, entry)

      if (body.status === 'triage' || body.status === 'active') {
        const cap = body.status === 'triage' ? 1 : 1 // TRIAGE_CAP / ACTIVE_CAP — both are 1 today
        const result = await env.DB.prepare(
          `UPDATE sessions SET status = ?, status_history = ?, updated_at = ?
           WHERE id = ?
             AND (
               SELECT COUNT(*) FROM sessions
               WHERE status = ? AND deleted_at IS NULL AND id != ?
             ) < ?`,
        )
          .bind(body.status, nextHistory, now, id, body.status, id, cap)
          .run()
        const changed = result.meta?.changes ?? 0
        if (changed === 0) {
          return body.status === 'triage'
            ? conflict('triage at capacity — ship or reject the current entry first')
            : conflict('active at capacity — ship or reject the current build first')
        }
      } else {
        await env.DB.prepare(
          `UPDATE sessions SET status = ?, status_history = ?, updated_at = ? WHERE id = ?`,
        )
          .bind(body.status, nextHistory, now, id)
          .run()
      }
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
  // tierAssigned is captured so we can fire a tier-assigned email below — but
  // only on the null→value transition. Tier *changes* (1→2) are not notified;
  // those should accompany a thread message from Marc anyway.
  let tierAssigned: 0 | 1 | 2 | 3 | 4 | null = null
  if (body.tier !== undefined) {
    if (!admin) return forbidden('only admin can set tier')
    if (
      body.tier !== null &&
      (typeof body.tier !== 'number' || ![0, 1, 2, 3, 4].includes(body.tier))
    ) {
      return badRequest('tier must be 0, 1, 2, 3, 4, or null')
    }
    if (session.tier === null && body.tier !== null) {
      tierAssigned = body.tier as 0 | 1 | 2 | 3 | 4
    }
    await env.DB.prepare(`UPDATE sessions SET tier = ?, updated_at = ? WHERE id = ?`)
      .bind(body.tier, now, id)
      .run()
  }

  // Tier 4 quoted amount — admin-only. Cents, 10000..10000000 (100..100000 CAD),
  // or null to clear. Stored regardless of current tier (admin may quote before
  // switching tier=4 to surface the button to the visitor). checkout.ts reads
  // this when computing a Tier-4 build's installments.
  //
  // tier4QuoteJustSet: true on the null→value transition so we can fire the
  // tier-assigned email for the late-quote case (admin set tier=4 silently,
  // then later set the amount — the amount-set is the *real* moment the
  // visitor can act on it).
  let tier4QuoteJustSet = false
  if (body.tier4AmountCents !== undefined) {
    if (!admin) return forbidden('only admin can set tier4AmountCents')
    if (body.tier4AmountCents !== null) {
      if (typeof body.tier4AmountCents !== 'number' || !Number.isInteger(body.tier4AmountCents)) {
        return badRequest('tier4AmountCents must be an integer (cents) or null')
      }
      if (body.tier4AmountCents < 10_000 || body.tier4AmountCents > 10_000_000) {
        return badRequest('tier4AmountCents out of range (10000..10000000 cents)')
      }
    }
    if (
      session.tier4_amount_cents === null &&
      body.tier4AmountCents !== null &&
      // Either tier is already 4, or we just set it to 4 in this same PATCH.
      (session.tier === 4 || tierAssigned === 4)
    ) {
      tier4QuoteJustSet = true
    }
    await env.DB.prepare(`UPDATE sessions SET tier4_amount_cents = ?, updated_at = ? WHERE id = ?`)
      .bind(body.tier4AmountCents, now, id)
      .run()
  }

  // Tier 3 installment split — admin-only. '50-50' | '40-40-20' | null.
  // checkout.ts defaults to '50-50' when null.
  if (body.tier3Split !== undefined) {
    if (!admin) return forbidden('only admin can set tier3Split')
    if (body.tier3Split !== null && body.tier3Split !== '50-50' && body.tier3Split !== '40-40-20') {
      return badRequest("tier3Split must be '50-50', '40-40-20', or null")
    }
    await env.DB.prepare(`UPDATE sessions SET tier3_split = ?, updated_at = ? WHERE id = ?`)
      .bind(body.tier3Split, now, id)
      .run()
  }

  // All-yours acknowledgment — visitor-self or admin. `true` writes a
  // timestamp (only on the null→value transition, so re-acks are no-ops);
  // `false` clears it back to NULL (useful when admin wants to reset for
  // an edge-case decision-take-back). Best-effort email to Marc on the
  // first-time set so he can plan the handoff.
  let allYoursJustAcked = false
  if (body.acknowledgeAllYours !== undefined) {
    if (!canAccessSession(email, admin, session)) return forbidden()
    if (typeof body.acknowledgeAllYours !== 'boolean') {
      return badRequest('acknowledgeAllYours must be a boolean')
    }
    if (body.acknowledgeAllYours) {
      if (session.all_yours_acknowledged_at === null) {
        allYoursJustAcked = true
        await env.DB.prepare(
          `UPDATE sessions SET all_yours_acknowledged_at = ?, updated_at = ? WHERE id = ?`,
        )
          .bind(now, now, id)
          .run()
      }
    } else if (session.all_yours_acknowledged_at !== null) {
      await env.DB.prepare(
        `UPDATE sessions SET all_yours_acknowledged_at = NULL, updated_at = ? WHERE id = ?`,
      )
        .bind(now, id)
        .run()
    }
  }

  // Community-pricing flag (operator-set 20% off OBNL projects). Admin-only.
  // Boolean. The "no toggle after first paid leg" invariant is enforced as an
  // atomic NOT EXISTS guard on the UPDATE — if the row didn't change (because
  // a paid build leg exists), we return 409. Same shape as the capacity cap
  // (P1.7 in AUDIT.md): no read-then-write race, no need to wrap in a
  // transaction. Idempotent: setting the flag to its current value is a
  // no-op success (lets the admin UI "save settings" button stay simple).
  if (body.communityDiscount !== undefined) {
    if (!admin) return forbidden('only admin can set communityDiscount')
    if (typeof body.communityDiscount !== 'boolean') {
      return badRequest('communityDiscount must be a boolean')
    }
    const nextFlag = body.communityDiscount ? 1 : 0
    const currentFlag = session.community_discount ?? 0
    if (nextFlag !== currentFlag) {
      const result = await env.DB.prepare(
        `UPDATE sessions SET community_discount = ?, updated_at = ?
         WHERE id = ?
           AND NOT EXISTS (
             SELECT 1 FROM payments
             WHERE session_id = ? AND kind = 'build' AND status = 'paid'
           )`,
      )
        .bind(nextFlag, now, id, id)
        .run()
      if ((result.meta?.changes ?? 0) === 0) {
        return conflict('community discount is frozen — a build installment has already been paid')
      }
    }
  }

  // Operator-written decline note (the "generous no"). Admin-only. A string
  // sets the note; null or an empty/whitespace string clears it to NULL.
  if (body.declineNote !== undefined) {
    if (!admin) return forbidden('only admin can set declineNote')
    let note: string | null
    if (body.declineNote === null) {
      note = null
    } else if (typeof body.declineNote === 'string') {
      const trimmed = body.declineNote.trim()
      note = trimmed.length > 0 ? trimmed.slice(0, 4000) : null
    } else {
      return badRequest('declineNote must be a string or null')
    }
    await env.DB.prepare(`UPDATE sessions SET decline_note = ?, updated_at = ? WHERE id = ?`)
      .bind(note, now, id)
      .run()
  }

  const fresh = await loadSession(env.DB, id)

  // Best-effort notifications. Failures are logged but don't fail the PATCH —
  // the data is in D1; emails are nudges.
  if (statusChanged && fresh) {
    const visitorPrefLang = await getLang(env.DB, fresh.email)
    await sendStatusChangeNotification(
      env.RESEND_API_KEY,
      fresh.email,
      id,
      statusChanged.from,
      statusChanged.to,
      origin,
      visitorPrefLang,
    )
  }
  // Visitor edited their own intake → notify Marc. Admin self-editing on
  // someone's behalf is not surfaced (Marc already knows).
  if (intakeEdited && !admin && fresh) {
    const marc = primaryAdminEmail(env.ADMIN_EMAILS)
    if (marc) {
      const marcLang = await getLang(env.DB, marc)
      await sendIntakeEditedNotification(
        env.RESEND_API_KEY,
        marc,
        fresh.email,
        id,
        origin,
        marcLang,
      )
    }
  }

  // Visitor confirmed Tout à toi → admin heads-up. Skip when admin did the
  // patch themselves (they already know). Only on the first-time set.
  if (allYoursJustAcked && !admin && fresh) {
    const marc = primaryAdminEmail(env.ADMIN_EMAILS)
    if (marc) {
      const marcLang = await getLang(env.DB, marc)
      await sendAllYoursAckNotification(env.RESEND_API_KEY, marc, fresh.email, id, origin, marcLang)
    }
  }

  // Tier assignment (or first-time Tier-4 quote) — fire ONE email per moment
  // the visitor can take new action. Rules:
  //   - tier just set to 0/1/2/3 → email (price is known immediately)
  //   - tier just set to 4 WITHOUT a quote → silent (visitor has nothing to do
  //     yet beyond wait; the quote-set fires the email)
  //   - tier already 4, quote just set → email (this is when the Pay button
  //     actually appears)
  //   - tier just set to 4 AND quote set in same PATCH → email (covered by
  //     tier4QuoteJustSet, which is true when both happen together)
  if (fresh) {
    const shouldEmailTier = (tierAssigned !== null && tierAssigned !== 4) || tier4QuoteJustSet
    if (shouldEmailTier) {
      const t = (tierAssigned ?? fresh.tier) as 0 | 1 | 2 | 3 | 4
      // Canonical CAD amounts — kept in sync with the public Pricing copy and
      // with functions/_lib/pricing.ts.
      //   tier 0: free (no price)
      //   tier 1: 750 CAD · tier 2: 1800 CAD · tier 3: 3600 CAD
      //   tier 4: admin-quoted (tier4_amount_cents)
      let cents: number | null = null
      if (t === 1) cents = 75_000
      else if (t === 2) cents = 180_000
      else if (t === 3) cents = 360_000
      else if (t === 4) cents = fresh.tier4_amount_cents
      // Late-quote case: tier=4 was already set on the row (not assigned in
      // this PATCH) AND the quote is what just landed. Subject reads as
      // "quote ready" rather than "Marc accepted".
      const isLateQuote = t === 4 && tierAssigned !== 4 && tier4QuoteJustSet
      const visitorPrefLang = await getLang(env.DB, fresh.email)
      await sendTierAssignedNotification(
        env.RESEND_API_KEY,
        fresh.email,
        id,
        t,
        cents,
        origin,
        visitorPrefLang,
        isLateQuote,
      )
    }
  }

  return ok({ session: fresh })
}

export const onRequestDelete: PagesFunction<Env> = async ({ request, env, params }) => {
  const email = await currentEmail(request, env.SESSION_SECRET)
  if (!email) return unauthorized()

  // Idempotent re-delete: include soft-deleted rows so we can return ok+200
  // when re-deleting an already-deleted session.
  const admin = isAdmin(env, email)
  const access = await requireSessionAccess(
    env.DB,
    params.id,
    { email, isAdmin: admin },
    { softDeleted: 'include' },
  )
  if (access instanceof Response) return access
  const session = access
  const id = session.id
  if (session.deleted_at) return ok({ ok: true })

  const now = Math.floor(Date.now() / 1000)
  await env.DB.prepare(`UPDATE sessions SET deleted_at = ?, updated_at = ? WHERE id = ?`)
    .bind(now, now, id)
    .run()

  // Symmetric notification: visitor self-withdraws → Marc; Marc force-deletes
  // someone else's → visitor. Both are best-effort; the soft-delete is the
  // source of truth.
  const origin = new URL(request.url).origin
  if (admin && session.email !== email) {
    const visitorPrefLang = await getLang(env.DB, session.email)
    await sendWithdrawalNotification(
      env.RESEND_API_KEY,
      session.email,
      email,
      id,
      origin,
      visitorPrefLang,
      'visitor',
    )
  } else {
    const marc = primaryAdminEmail(env.ADMIN_EMAILS)
    if (marc && marc.toLowerCase() !== email.toLowerCase()) {
      const marcLang = await getLang(env.DB, marc)
      await sendWithdrawalNotification(
        env.RESEND_API_KEY,
        marc,
        email,
        id,
        origin,
        marcLang,
        'admin',
      )
    }
  }

  return ok({ ok: true })
}
