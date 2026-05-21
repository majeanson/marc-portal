// Generate public/sitemap.xml from a fixed list of public routes. The static
// /showcase/:slug system was retired in favour of the dynamic /projects feed
// (DB-backed, no build-time enumeration), so this script no longer scans
// feat-*/feature.json files. /projects renders client-side from D1; search
// engines can still discover individual /share/<id> URLs via outbound links.
//
// No <lastmod>: every route shared the same "today" stamp, which made the
// committed sitemap mutate daily and tripped CI's `git diff --quiet` check.
// <lastmod> is a hint, not required; crawlers fall back to their own cadence.

import { writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const portalRoot = dirname(dirname(__filename))
const baseUrl = process.env.PORTAL_BASE_URL ?? 'https://marcportal.com'

function urlEntry(loc) {
  return `  <url>\n    <loc>${baseUrl}${loc}</loc>\n  </url>`
}

const urls = [
  urlEntry('/'),
  urlEntry('/en'),
  urlEntry('/projects'),
  urlEntry('/en/projects'),
  urlEntry('/intake'),
  urlEntry('/en/intake'),
  urlEntry('/napkin'),
  urlEntry('/en/napkin'),
  urlEntry('/parcours'),
  urlEntry('/en/journey'),
  urlEntry('/tier-0'),
  urlEntry('/en/tier-0'),
  urlEntry('/confidentialite'),
  urlEntry('/en/privacy'),
  urlEntry('/pia'),
  urlEntry('/en/pia'),
  urlEntry('/handoff'),
  urlEntry('/en/handoff'),
  urlEntry('/handoff/checklist'),
  urlEntry('/en/handoff/checklist'),
  urlEntry('/meta'),
  urlEntry('/en/meta'),
  urlEntry('/atelier'),
  urlEntry('/en/atelier'),
  urlEntry('/carte'),
  urlEntry('/en/map'),
  urlEntry('/vouches'),
  urlEntry('/en/vouches'),
  urlEntry('/vouch'),
  urlEntry('/en/vouch'),
]

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>
`

writeFileSync(join(portalRoot, 'public', 'sitemap.xml'), sitemap)
console.log(`sitemap.xml written with ${urls.length} URLs`)
