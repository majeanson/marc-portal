// GET /api/public/vouches — UNAUTH endpoint. Returns approved + not-deleted
// vouches in newest-first order. Powers the home-page social proof block
// and the dedicated /vouches page.
//
// PII posture: the projection in toPublicVouchRow drops author_email. The
// type system enforces this — see PublicVouchRow in _lib/vouches.ts.
//
// Optional ?sessionId=<id> filter: when a /share/:id page wants to show
// vouches attributed to that specific project. Without the filter we
// return everything approved.
//
// Volume is tiny (Marc moderates; ceiling = ~50 vouches/year). No
// pagination — we just SELECT all approved rows and let the client trim
// for display.

import type { Env } from '../../_lib/env'
import { ok } from '../../_lib/json'
import { toPublicVouchRow, type VouchRow } from '../../_lib/vouches'

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url)
  const sessionId = url.searchParams.get('sessionId')

  const stmt = sessionId
    ? env.DB.prepare(
        `SELECT id, author_name, author_email, author_relationship, body, link_url,
                session_id, status, created_at, approved_at, deleted_at
           FROM vouches
          WHERE status = 'approved' AND deleted_at IS NULL AND session_id = ?
          ORDER BY created_at DESC`,
      ).bind(sessionId)
    : env.DB.prepare(
        `SELECT id, author_name, author_email, author_relationship, body, link_url,
                session_id, status, created_at, approved_at, deleted_at
           FROM vouches
          WHERE status = 'approved' AND deleted_at IS NULL
          ORDER BY created_at DESC`,
      )

  const res = await stmt.all<VouchRow>()
  const vouches = (res.results ?? []).map(toPublicVouchRow)
  return ok({ vouches })
}
