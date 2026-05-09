// PATCH  /api/sessions/:id/advancements/:advId — admin edit
// DELETE /api/sessions/:id/advancements/:advId — admin remove

import { currentEmail } from '../../../../_lib/auth'
import {
  loadAdvancement,
  normalizeBody,
  normalizeIframePath,
  normalizeLabel,
  parseFlags,
  stringifyFlags,
} from '../../../../_lib/advancements'
import type { Env } from '../../../../_lib/env'
import { isAdmin } from '../../../../_lib/env'
import { badRequest, forbidden, notFound, ok, unauthorized } from '../../../../_lib/json'
import { loadSession } from '../../../../_lib/sessions'

interface PatchBody {
  label?: unknown
  body?: unknown
  date?: unknown
  iframePath?: unknown
  flags?: unknown
  /** Admin override — clear or replace stamped build_url + commit_sha (rare). */
  buildUrl?: unknown
  commitSha?: unknown
}

export const onRequestPatch: PagesFunction<Env> = async ({ request, env, params }) => {
  const email = await currentEmail(request, env.SESSION_SECRET)
  if (!email) return unauthorized()
  if (!isAdmin(env, email)) return forbidden('only admin can edit advancements')

  const sessionId = String(params.id ?? '')
  const advId = String(params.advId ?? '')
  if (!sessionId || !advId) return badRequest('missing id')

  const session = await loadSession(env.DB, sessionId)
  if (!session) return notFound()
  const adv = await loadAdvancement(env.DB, advId)
  if (!adv || adv.session_id !== sessionId) return notFound()

  let payload: PatchBody
  try {
    payload = (await request.json()) as PatchBody
  } catch {
    return badRequest('invalid json')
  }

  const updates: { col: string; val: unknown }[] = []

  if (payload.label !== undefined) {
    const label = normalizeLabel(payload.label)
    if (!label) return badRequest('label is required')
    updates.push({ col: 'label', val: label })
  }
  if (payload.body !== undefined) {
    updates.push({ col: 'body', val: normalizeBody(payload.body) })
  }
  if (payload.date !== undefined) {
    if (typeof payload.date !== 'number' || !Number.isFinite(payload.date)) {
      return badRequest('date must be a unix-seconds number')
    }
    updates.push({ col: 'date', val: payload.date })
  }
  if (payload.iframePath !== undefined) {
    if (payload.iframePath === null || payload.iframePath === '') {
      updates.push({ col: 'iframe_path', val: null })
    } else {
      const p = normalizeIframePath(payload.iframePath)
      if (!p) return badRequest('iframePath must be a site-relative path starting with /')
      updates.push({ col: 'iframe_path', val: p })
    }
  }
  if (payload.flags !== undefined) {
    const flagsObj =
      payload.flags && typeof payload.flags === 'object'
        ? (payload.flags as Record<string, unknown>)
        : {}
    const flagsJson = stringifyFlags({
      allowedForPublic: !!flagsObj.allowedForPublic,
      showInConversation: !!flagsObj.showInConversation,
      showAsCurrentBuild: !!flagsObj.showAsCurrentBuild,
    })
    updates.push({ col: 'flags_json', val: flagsJson })
  }
  if (payload.buildUrl !== undefined) {
    if (payload.buildUrl === null || payload.buildUrl === '') {
      updates.push({ col: 'build_url', val: null })
    } else if (typeof payload.buildUrl === 'string') {
      // Light validation: must be http(s) absolute URL.
      if (!/^https?:\/\//i.test(payload.buildUrl)) {
        return badRequest('buildUrl must be an http(s) URL')
      }
      updates.push({ col: 'build_url', val: payload.buildUrl.replace(/\/+$/, '') })
    } else {
      return badRequest('buildUrl must be a string or null')
    }
  }
  if (payload.commitSha !== undefined) {
    if (payload.commitSha === null || payload.commitSha === '') {
      updates.push({ col: 'commit_sha', val: null })
    } else if (typeof payload.commitSha === 'string') {
      updates.push({ col: 'commit_sha', val: payload.commitSha.slice(0, 64) })
    } else {
      return badRequest('commitSha must be a string or null')
    }
  }

  if (updates.length === 0) return badRequest('no fields to update')

  const now = Math.floor(Date.now() / 1000)
  updates.push({ col: 'updated_at', val: now })

  const setClause = updates.map((u) => `${u.col} = ?`).join(', ')
  await env.DB.prepare(`UPDATE session_advancements SET ${setClause} WHERE id = ?`)
    .bind(...updates.map((u) => u.val), advId)
    .run()
  // Bump session updated_at to surface activity in the visitor's /me list.
  await env.DB.prepare(`UPDATE sessions SET updated_at = ? WHERE id = ?`)
    .bind(now, sessionId)
    .run()

  const fresh = await loadAdvancement(env.DB, advId)
  if (!fresh) return notFound()
  return ok({ advancement: { ...fresh, flags: parseFlags(fresh.flags_json) } })
}

export const onRequestDelete: PagesFunction<Env> = async ({ request, env, params }) => {
  const email = await currentEmail(request, env.SESSION_SECRET)
  if (!email) return unauthorized()
  if (!isAdmin(env, email)) return forbidden('only admin can delete advancements')

  const sessionId = String(params.id ?? '')
  const advId = String(params.advId ?? '')
  if (!sessionId || !advId) return badRequest('missing id')

  const adv = await loadAdvancement(env.DB, advId)
  if (!adv || adv.session_id !== sessionId) return notFound()

  await env.DB.prepare(`DELETE FROM session_advancements WHERE id = ?`).bind(advId).run()
  return ok({ ok: true })
}
