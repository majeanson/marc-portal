// Build-time data seed for the prerendered pages.
//
// scripts/prerender.mjs snapshots /, /en, /projects and /en/projects to
// static HTML. The gallery and the home strip are DATA — without a seed,
// their first React render is the loading skeleton, so the prerender could
// only ever bake a skeleton (no SEO content) or bake cards that React then
// replaces with a skeleton (a visible flicker). The prerender therefore
// injects the /api/public/projects payload it fetched from production at
// build time as <script id="projects-seed" type="application/json">, and the
// two consumers initialise their state from it: first render = cards = the
// snapshot, no flicker, and crawlers get real titles and taglines.
//
// The seed is as fresh as the last deploy; both consumers still fetch live
// data and replace the state (stale-while-revalidate), so an admin showcase
// edit shows up without a rebuild — at worst one repaint when it differs.
// No seed (dev, fail-soft prerender) = null = the old skeleton-first boot.

import type { PublicProject } from './sessionsApi'

let cached: PublicProject[] | null | undefined

export function readProjectsSeed(): PublicProject[] | null {
  if (cached !== undefined) return cached
  cached = null
  try {
    const el = document.getElementById('projects-seed')
    if (el?.textContent) {
      const parsed = JSON.parse(el.textContent) as { projects?: unknown }
      if (Array.isArray(parsed.projects)) cached = parsed.projects as PublicProject[]
    }
  } catch {
    // A malformed seed is a bonus we didn't get — never a crash.
  }
  return cached
}

/** Test hook — the module caches the first read so every consumer sees one
 * consistent answer per boot. */
export function resetProjectsSeedForTests(): void {
  cached = undefined
}
