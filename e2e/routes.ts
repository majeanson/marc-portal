/**
 * Route manifest for the screenshot suite.
 *
 * Driven by src/data/map-skeleton.json — the same generated route list the
 * /carte atlas uses — so a newly added page is screenshotted automatically
 * the next time baselines are refreshed. Admin-shell and dynamic (`:param`)
 * routes are dropped: the former need auth, the latter need a real id.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

interface SkeletonRoute {
  path: string
  component: string
  lang: 'fr' | 'en'
  dynamic: boolean
  inAdminShell: boolean
}

interface Skeleton {
  routes: SkeletonRoute[]
}

const skeleton = JSON.parse(
  // Playwright runs with cwd = the dir holding playwright.config.ts (repo root).
  readFileSync(join(process.cwd(), 'src/data/map-skeleton.json'), 'utf8'),
) as Skeleton

export interface PageRoute {
  /** Filesystem-safe screenshot name, e.g. 'en-intake' or 'root'. */
  name: string
  /** URL path to visit. */
  path: string
  lang: 'fr' | 'en'
  component: string
}

/** A URL path → a flat, filesystem-safe slug. '/' → 'root'. */
function slug(path: string): string {
  const s = path.replace(/^\/+/, '').replace(/\/+$/, '').replace(/\//g, '-')
  return s || 'root'
}

/** Every public, non-dynamic route — what the screenshot suite captures. */
export const PUBLIC_ROUTES: PageRoute[] = skeleton.routes
  .filter((r) => !r.inAdminShell && !r.dynamic)
  .map((r) => ({ name: slug(r.path), path: r.path, lang: r.lang, component: r.component }))
  .sort((a, b) => a.name.localeCompare(b.name))
