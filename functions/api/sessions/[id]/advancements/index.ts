// GET  /api/sessions/:id/advancements — list advancements (visitors see only
//                                        allowedForPublic; owner+admin see all)
// POST /api/sessions/:id/advancements — admin only; creates a draft
//                                        advancement with build_url null. CI
//                                        stamps build_url + commit_sha on the
//                                        next deploy.

import { currentEmail } from '../../../../_lib/auth'
import {
  type AdvancementRow,
  listAdvancementsForSession,
  newAdvancementId,
  normalizeBody,
  normalizeIframePath,
  normalizeLabel,
  parseFlags,
  stringifyFlags,
} from '../../../../_lib/advancements'
import type { Env } from '../../../../_lib/env'
import { isAdmin } from '../../../../_lib/env'
import { badRequest, forbidden, ok, unauthorized } from '../../../../_lib/json'
import { requireSessionAccess } from '../../../../_lib/sessions'

export const onRequestGet: PagesFunction<Env> = async ({ request, env, params }) => {
  const email = await currentEmail(request, env.SESSION_SECRET)
  if (!email) return unauthorized()

  // Visitor sees 404 on a soft-deleted session, admin still has read access.
  // Non-owner non-admin gets 403 even on a live session — the iframe time-
  // travel surface is owner+admin until we expose a public showcase route.
  // Revisit when public sharing lands.
  const access = await requireSessionAccess(env.DB, params.id, {
    email,
    isAdmin: isAdmin(env, email),
  })
  if (access instanceof Response) return access
  const id = access.id

  const rows = await listAdvancementsForSession(env.DB, id)
  // Normalize: parse flags so the client doesn't re-do the same defensive
  // try/catch. Keep flags_json on the wire too in case the client needs the
  // raw blob.
  const advancements = rows.map((r) => ({
    ...r,
    flags: parseFlags(r.flags_json),
  }))
  return ok({ advancements })
}

interface PostBody {
  label?: unknown
  body?: unknown
  date?: unknown
  iframePath?: unknown
  flags?: unknown
  /** Optional pre-filled deploy URL — for advancements pointing at builds
   * outside this repo (e.g. a separate Cloudflare Pages project). When
   * provided, auto-stamping skips this row (it only stamps WHERE
   * build_url IS NULL). When omitted, CI fills it on the next deploy. */
  buildUrl?: unknown
  commitSha?: unknown
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env, params }) => {
  const email = await currentEmail(request, env.SESSION_SECRET)
  if (!email) return unauthorized()

  // Posting an advancement to a deleted session is meaningless — hide-from-all.
  // canAccessSession would pass for admin (and admin is the required role
  // below), but the soft-delete check is independent.
  const admin = isAdmin(env, email)
  const access = await requireSessionAccess(
    env.DB,
    params.id,
    { email, isAdmin: admin },
    { softDeleted: 'hide-from-all' },
  )
  if (access instanceof Response) return access
  const id = access.id
  if (!admin) return forbidden('only admin can post advancements')

  let payload: PostBody
  try {
    payload = (await request.json()) as PostBody
  } catch {
    return badRequest('invalid json')
  }

  const label = normalizeLabel(payload.label)
  if (!label) return badRequest('label is required')
  const body = normalizeBody(payload.body)
  const iframePath =
    payload.iframePath === null || payload.iframePath === undefined
      ? null
      : normalizeIframePath(payload.iframePath)
  // null vs invalid — distinguish: if user provided something that didn't
  // pass validation, refuse. If they omitted it, it stays null.
  if (payload.iframePath !== null && payload.iframePath !== undefined && iframePath === null) {
    return badRequest('iframePath must be a site-relative path starting with /')
  }
  const now = Math.floor(Date.now() / 1000)
  const date =
    typeof payload.date === 'number' && Number.isFinite(payload.date) ? payload.date : now

  const flagsObj = payload.flags && typeof payload.flags === 'object' ? payload.flags : {}
  const flagsJson = stringifyFlags({
    allowedForPublic: !!(flagsObj as Record<string, unknown>).allowedForPublic,
    showInConversation: !!(flagsObj as Record<string, unknown>).showInConversation,
    showAsCurrentBuild: !!(flagsObj as Record<string, unknown>).showAsCurrentBuild,
  })

  // Optional pre-fill of build_url + commit_sha on create. Validate same as
  // the PATCH path: http(s) absolute URL, ≤64-char SHA. Defensive — bad
  // input would otherwise corrupt the iframe src.
  let buildUrl: string | null = null
  if (typeof payload.buildUrl === 'string' && payload.buildUrl.length > 0) {
    if (!/^https?:\/\//i.test(payload.buildUrl)) {
      return badRequest('buildUrl must be an http(s) URL')
    }
    buildUrl = payload.buildUrl.replace(/\/+$/, '')
  }
  let commitSha: string | null = null
  if (typeof payload.commitSha === 'string' && payload.commitSha.length > 0) {
    commitSha = payload.commitSha.slice(0, 64)
  }

  const advId = newAdvancementId()
  await env.DB.prepare(
    `INSERT INTO session_advancements
       (id, session_id, date, author, label, body, build_url, commit_sha,
        iframe_path, flags_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(advId, id, date, email, label, body, buildUrl, commitSha, iframePath, flagsJson, now, now)
    .run()

  // Bump session updated_at so /me cards re-sort and the visitor sees
  // recent activity. Mirrors the message-post flow.
  await env.DB.prepare(`UPDATE sessions SET updated_at = ? WHERE id = ?`).bind(now, id).run()

  const row: AdvancementRow = {
    id: advId,
    session_id: id,
    date,
    author: email,
    label,
    body,
    build_url: buildUrl,
    commit_sha: commitSha,
    iframe_path: iframePath,
    flags_json: flagsJson,
    created_at: now,
    updated_at: now,
  }
  return ok({ advancement: { ...row, flags: parseFlags(flagsJson) } })
}
