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

/** Every public, non-dynamic route — what the a11y suite scans. */
export const PUBLIC_ROUTES: PageRoute[] = skeleton.routes
  .filter((r) => !r.inAdminShell && !r.dynamic)
  .map((r) => ({ name: slug(r.path), path: r.path, lang: r.lang, component: r.component }))
  .sort((a, b) => a.name.localeCompare(b.name))

/**
 * Routes the visual-regression suite must NOT screenshot. /atelier embeds a
 * thumbnail of every other baseline — capturing it would recurse the whole
 * corpus into one image and churn that baseline on any layout change
 * anywhere. The page's own layout is covered by the a11y scan + a smoke
 * assertion; it needs no baseline of its own.
 */
const SCREENSHOT_EXCLUDE = new Set(['atelier', 'en-atelier'])

/** Routes the screenshot suite captures — PUBLIC_ROUTES minus the gallery. */
export const SCREENSHOT_ROUTES: PageRoute[] = PUBLIC_ROUTES.filter(
  (r) => !SCREENSHOT_EXCLUDE.has(r.name),
)
