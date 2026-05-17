// GET /api/admin/vouches — admin-only moderation list. Returns every
// vouch including pending, rejected, and soft-deleted, with the email
// attached. Sorted: pending first (newest), then everything else by
// created_at desc. The admin UI groups by status; this ordering puts
// the moderation queue at the top of the response.
//
// Optional ?status=pending|approved|rejected to narrow.

import { currentEmail } from '../../_lib/auth'
import type { Env } from '../../_lib/env'
import { isAdmin } from '../../_lib/env'
import { badRequest, forbidden, ok, unauthorized } from '../../_lib/json'
import { VOUCH_STATUSES, type VouchRow, type VouchStatus } from '../../_lib/vouches'

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const email = await currentEmail(request, env.SESSION_SECRET)
  if (!email) return unauthorized()
  if (!isAdmin(env, email)) return forbidden()

  const url = new URL(request.url)
  const statusParam = url.searchParams.get('status')
  let statusFilter: VouchStatus | null = null
  if (statusParam) {
    if (!VOUCH_STATUSES.has(statusParam as VouchStatus)) return badRequest('invalid status filter')
    statusFilter = statusParam as VouchStatus
  }

  const stmt = statusFilter
    ? env.DB.prepare(
        `SELECT id, author_name, author_email, author_relationship, body, link_url,
                session_id, status, created_at, approved_at, deleted_at
           FROM vouches
          WHERE status = ?
          ORDER BY (deleted_at IS NULL) DESC, created_at DESC`,
      ).bind(statusFilter)
    : // Pending first so the queue is the first thing Marc sees, then
      // approved + rejected by recency. Soft-deleted rows sink to the
      // bottom (still visible — admin trash).
      env.DB.prepare(
        `SELECT id, author_name, author_email, author_relationship, body, link_url,
                session_id, status, created_at, approved_at, deleted_at
           FROM vouches
          ORDER BY (status = 'pending') DESC,
                   (deleted_at IS NULL) DESC,
                   created_at DESC`,
      )

  const res = await stmt.all<VouchRow>()
  return ok({ vouches: res.results ?? [] })
}
