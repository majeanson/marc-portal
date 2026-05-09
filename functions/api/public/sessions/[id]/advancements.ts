// GET /api/public/sessions/:id/advancements — UNAUTH endpoint that returns
// only advancements flagged allowedForPublic for the given session. Powers
// the /share/:sessionId share-link surface so admin can hand a URL to anyone
// (no account needed) and they see exactly the slice of build progress
// admin opted into.
//
// Session ID is the only "secret" — 12-char base64url tokens (~72 bits of
// entropy) are not realistically guessable. Admin opts in per-advancement;
// nothing leaks unless allowedForPublic is set on that row.

import {
  type AdvancementRow,
  listAdvancementsForSession,
  parseFlags,
} from '../../../../_lib/advancements'
import type { Env } from '../../../../_lib/env'
import { badRequest, notFound, ok } from '../../../../_lib/json'
import { loadSession } from '../../../../_lib/sessions'

export const onRequestGet: PagesFunction<Env> = async ({ env, params }) => {
  const id = String(params.id ?? '')
  if (!id) return badRequest('missing id')

  const session = await loadSession(env.DB, id)
  if (!session) return notFound()
  // Soft-deleted sessions don't expose anything publicly, even for entries
  // that were marked public before the withdrawal.
  if (session.deleted_at) return notFound()

  const rows = await listAdvancementsForSession(env.DB, id)
  const advancements = rows
    .map((r): AdvancementRow & { flags: ReturnType<typeof parseFlags> } => ({
      ...r,
      flags: parseFlags(r.flags_json),
    }))
    .filter((r) => r.flags.allowedForPublic === true)

  // Public payload includes only what the share view needs. We deliberately
  // strip author email (PII) and flags_json (raw blob).
  const publicAdvancements = advancements.map((r) => ({
    id: r.id,
    session_id: r.session_id,
    date: r.date,
    label: r.label,
    body: r.body,
    build_url: r.build_url,
    commit_sha: r.commit_sha,
    iframe_path: r.iframe_path,
  }))

  return ok({ advancements: publicAdvancements })
}
