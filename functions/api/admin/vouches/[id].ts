// PATCH  /api/admin/vouches/:id  — admin-only. Status flip
//                                   (pending/approved/rejected), body edit,
//                                   link edit, or undelete (restore from trash).
// DELETE /api/admin/vouches/:id  — admin-only soft delete (sets deleted_at).
//
// Editing is intentionally broad: Marc routinely tightens visitor copy
// before approving (typos, length, voice). Author email and submission
// timestamp are immutable.

import { currentEmail } from '../../../_lib/auth'
import type { Env } from '../../../_lib/env'
import { isAdmin } from '../../../_lib/env'
import { badRequest, forbidden, notFound, ok, unauthorized } from '../../../_lib/json'
import {
  isValidRelationship,
  validateLinkUrl,
  VOUCH_LIMITS,
  VOUCH_STATUSES,
  type VouchRow,
  type VouchStatus,
} from '../../../_lib/vouches'

function loadVouch(env: Env, id: string): Promise<VouchRow | null> {
  return env.DB.prepare(
    `SELECT id, author_name, author_email, author_relationship, body, link_url,
            session_id, status, created_at, approved_at, deleted_at
       FROM vouches WHERE id = ?`,
  )
    .bind(id)
    .first<VouchRow>()
}

interface PatchBody {
  status?: unknown
  authorName?: unknown
  authorRelationship?: unknown
  body?: unknown
  linkUrl?: unknown
  /** Admin-only: restore a soft-deleted vouch (clears deleted_at). */
  undelete?: unknown
}

export const onRequestPatch: PagesFunction<Env> = async ({ request, env, params }) => {
  const email = await currentEmail(request, env.SESSION_SECRET)
  if (!email) return unauthorized()
  if (!isAdmin(env, email)) return forbidden()
  const id = String(params.id ?? '')
  if (!id) return badRequest('missing id')

  const vouch = await loadVouch(env, id)
  if (!vouch) return notFound()

  let body: PatchBody
  try {
    body = (await request.json()) as PatchBody
  } catch {
    return badRequest('invalid json')
  }

  const now = Math.floor(Date.now() / 1000)

  // Undelete: only valid op against a trashed row.
  if (body.undelete === true) {
    if (!vouch.deleted_at) return ok({ vouch })
    await env.DB.prepare(`UPDATE vouches SET deleted_at = NULL WHERE id = ?`).bind(id).run()
    const fresh = await loadVouch(env, id)
    return ok({ vouch: fresh })
  }
  if (vouch.deleted_at) return notFound()

  // Build the UPDATE incrementally. Each field is validated independently
  // so the response points at the bad field. Empty PATCHes are no-ops.
  const sets: string[] = []
  const binds: unknown[] = []

  if (body.status !== undefined) {
    if (typeof body.status !== 'string' || !VOUCH_STATUSES.has(body.status as VouchStatus)) {
      return badRequest('invalid status')
    }
    const nextStatus = body.status as VouchStatus
    if (nextStatus !== vouch.status) {
      sets.push('status = ?')
      binds.push(nextStatus)
      // approved_at: stamp on first approval, clear when leaving approved.
      // Keeps the timeline honest if a vouch is unapproved later.
      if (nextStatus === 'approved') {
        sets.push('approved_at = ?')
        binds.push(now)
      } else if (vouch.status === 'approved') {
        sets.push('approved_at = NULL')
      }
    }
  }

  if (body.authorName !== undefined) {
    if (typeof body.authorName !== 'string') return badRequest('invalid name')
    const trimmed = body.authorName.trim()
    if (trimmed.length < VOUCH_LIMITS.nameMin || trimmed.length > VOUCH_LIMITS.nameMax) {
      return badRequest('invalid name length')
    }
    sets.push('author_name = ?')
    binds.push(trimmed)
  }

  if (body.authorRelationship !== undefined) {
    if (!isValidRelationship(body.authorRelationship)) return badRequest('invalid relationship')
    sets.push('author_relationship = ?')
    binds.push(body.authorRelationship)
  }

  if (body.body !== undefined) {
    if (typeof body.body !== 'string') return badRequest('invalid body')
    const trimmed = body.body.trim()
    if (trimmed.length < VOUCH_LIMITS.bodyMin || trimmed.length > VOUCH_LIMITS.bodyMax) {
      return badRequest('invalid body length')
    }
    sets.push('body = ?')
    binds.push(trimmed)
  }

  if (body.linkUrl !== undefined) {
    const url = validateLinkUrl(body.linkUrl)
    if (url === false) return badRequest('invalid link url')
    sets.push('link_url = ?')
    binds.push(url)
  }

  if (sets.length === 0) return ok({ vouch })

  binds.push(id)
  await env.DB.prepare(`UPDATE vouches SET ${sets.join(', ')} WHERE id = ?`)
    .bind(...binds)
    .run()

  const fresh = await loadVouch(env, id)
  return ok({ vouch: fresh })
}

export const onRequestDelete: PagesFunction<Env> = async ({ request, env, params }) => {
  const email = await currentEmail(request, env.SESSION_SECRET)
  if (!email) return unauthorized()
  if (!isAdmin(env, email)) return forbidden()
  const id = String(params.id ?? '')
  if (!id) return badRequest('missing id')

  const vouch = await loadVouch(env, id)
  if (!vouch) return notFound()
  if (vouch.deleted_at) return ok({ ok: true })

  const now = Math.floor(Date.now() / 1000)
  await env.DB.prepare(`UPDATE vouches SET deleted_at = ? WHERE id = ?`).bind(now, id).run()
  return ok({ ok: true })
}
