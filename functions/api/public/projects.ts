// GET /api/public/projects — UNAUTH endpoint. Returns the public-facing
// gallery: every session admin has flagged showcased_at IS NOT NULL, with
// its pinned current-build advancement (if any). Powers the /projects page.
//
// We deliberately strip PII (visitor email, intake content). Each card
// only carries: session id, admin-set title + tagline, current build URL,
// optional iframe path. That's enough for the gallery; the detail view
// (/share/<id>) is a separate unauth endpoint already.

import { parseFlags } from '../../_lib/advancements'
import type { Env } from '../../_lib/env'
import { ok } from '../../_lib/json'

interface ShowcaseRow {
  id: string
  showcased_at: number
  showcase_title: string | null
  showcase_tagline: string | null
  status: string
}

interface AdvancementJoinRow {
  session_id: string
  label: string
  body: string
  build_url: string | null
  iframe_path: string | null
  flags_json: string
  date: number
}

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  // Sessions opted into showcase. Newest first by showcased_at.
  const sessRes = await env.DB.prepare(
    `SELECT id, showcased_at, showcase_title, showcase_tagline, status
     FROM sessions
     WHERE showcased_at IS NOT NULL AND deleted_at IS NULL
     ORDER BY showcased_at DESC`,
  ).all<ShowcaseRow>()
  const sessions = sessRes.results ?? []

  if (sessions.length === 0) {
    return ok({ projects: [] })
  }

  // Pull every advancement on these sessions in one shot, then pick the
  // freshest showAsCurrentBuild per session in JS. Keeps the SQL simple
  // (D1 SQLite doesn't have window functions on every plan).
  const ids = sessions.map((s) => s.id)
  const placeholders = ids.map(() => '?').join(',')
  const advRes = await env.DB.prepare(
    `SELECT session_id, label, body, build_url, iframe_path, flags_json, date
     FROM session_advancements
     WHERE session_id IN (${placeholders})
     ORDER BY date DESC, created_at DESC`,
  )
    .bind(...ids)
    .all<AdvancementJoinRow>()

  // Index by session_id, picking the first (= newest) showAsCurrentBuild.
  const currentBySession = new Map<string, AdvancementJoinRow>()
  for (const a of advRes.results ?? []) {
    if (currentBySession.has(a.session_id)) continue
    const flags = parseFlags(a.flags_json)
    if (!flags.showAsCurrentBuild) continue
    currentBySession.set(a.session_id, a)
  }

  const projects = sessions.map((s) => {
    const cur = currentBySession.get(s.id) ?? null
    return {
      id: s.id,
      showcasedAt: s.showcased_at,
      title: s.showcase_title,
      tagline: s.showcase_tagline,
      status: s.status,
      currentBuild: cur
        ? {
            label: cur.label,
            body: cur.body,
            buildUrl: cur.build_url,
            iframePath: cur.iframe_path,
            date: cur.date,
          }
        : null,
    }
  })

  return ok({ projects })
}
