// Showcase build health — the /projects gallery is a wall of live iframes,
// each pointing at an app deployed from its own repo. None of those deploys
// notify this one, so a dead build shows up as a broken-looking card and
// nothing else. The daily digest pings every showcased build URL and emails
// the ones that don't answer. (The 503/504s that motivated this on
// 2026-10-15 turned out to be the portal's own OG renderer at the CPU
// cliff, not the builds — see _lib/og-cache.ts — but the watch is still
// the right instrument: the builds deploy from eight repos that never
// report back here.)

import { parseFlags } from './advancements'

export interface ShowcasedBuild {
  id: string
  title: string
  url: string
}

export interface DownBuild extends ShowcasedBuild {
  detail: string
}

// Same two-query shape as functions/api/public/projects.ts (the canonical
// gallery read): showcased sessions, then newest showAsCurrentBuild per
// session picked in JS. Only id/title/url survive — that's all a ping needs.
export async function listShowcasedBuilds(db: D1Database): Promise<ShowcasedBuild[]> {
  const sessRes = await db
    .prepare(
      `SELECT id, showcase_title FROM sessions
       WHERE showcased_at IS NOT NULL AND deleted_at IS NULL`,
    )
    .all<{ id: string; showcase_title: string | null }>()
  const sessions = sessRes.results ?? []
  if (sessions.length === 0) return []

  const placeholders = sessions.map(() => '?').join(',')
  const advRes = await db
    .prepare(
      `SELECT session_id, build_url, flags_json
       FROM session_advancements
       WHERE session_id IN (${placeholders})
       ORDER BY date DESC, created_at DESC`,
    )
    .bind(...sessions.map((s) => s.id))
    .all<{ session_id: string; build_url: string | null; flags_json: string }>()

  const urlBySession = new Map<string, string>()
  for (const a of advRes.results ?? []) {
    if (urlBySession.has(a.session_id)) continue
    if (!a.build_url) continue
    if (!parseFlags(a.flags_json).showAsCurrentBuild) continue
    urlBySession.set(a.session_id, a.build_url)
  }

  return sessions
    .filter((s) => urlBySession.has(s.id))
    .map((s) => ({ id: s.id, title: s.showcase_title ?? s.id, url: urlBySession.get(s.id)! }))
}

// GET rather than HEAD: static-assets Workers answer both, but GET is what
// the card's iframe actually issues, and it doubles as a daily warm-up
// touch for builds that cold-start slowly. Redirects are followed because
// a build that bounces anonymous visitors to its own login page (Retrodio)
// is up — the login page IS its public face. ok === false after following
// means the visitor-facing surface is broken.
export async function pingBuilds(
  builds: ShowcasedBuild[],
  probeToken?: string,
  fetchImpl: typeof fetch = fetch,
): Promise<DownBuild[]> {
  const outcomes = await Promise.all(
    builds.map(async (b): Promise<DownBuild | null> => {
      try {
        const res = await fetchImpl(b.url, {
          method: 'GET',
          redirect: 'follow',
          // Lets the zone's WAF skip rule recognise us; see env.ts PROBE_TOKEN.
          headers: probeToken ? { 'X-Portal-Probe': probeToken } : undefined,
          signal: AbortSignal.timeout(10_000),
        })
        if (res.ok) return null
        // A bare "HTTP 403" can't say who answered: the zone's WAF, a Zero
        // Trust policy, or the build itself. Surfacing the edge headers plus
        // the first bytes of the body turns the next email into the diagnosis
        // (the 2026-10-16 same-zone 403s needed exactly this).
        const body = (await res.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 120)
        const hints = [
          res.headers.get('cf-mitigated') && `cf-mitigated=${res.headers.get('cf-mitigated')}`,
          res.headers.get('server') && `server=${res.headers.get('server')}`,
          res.headers.get('cf-ray') && `ray=${res.headers.get('cf-ray')}`,
          body && `body="${body}"`,
        ].filter(Boolean)
        return { ...b, detail: [`HTTP ${res.status}`, ...hints].join(' ') }
      } catch (err) {
        // DOMException (what AbortSignal.timeout throws) is not an Error
        // subclass on every runtime, so match on .name, not instanceof.
        const name = (err as { name?: unknown } | null)?.name
        const detail =
          name === 'TimeoutError'
            ? 'timeout (10s)'
            : err instanceof Error
              ? err.message
              : String(err)
        return { ...b, detail }
      }
    }),
  )
  return outcomes.filter((o): o is DownBuild => o !== null)
}
