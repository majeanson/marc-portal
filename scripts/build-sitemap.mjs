// Generate public/sitemap.xml from a fixed list of public routes. The static
// /showcase/:slug system was retired in favour of the dynamic /projects feed
// (DB-backed, no build-time enumeration), so this script no longer scans
// feat-*/feature.json files. /projects renders client-side from D1; search
// engines can still discover individual /share/<id> URLs via outbound links.

import { writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const portalRoot = dirname(dirname(__filename))
const baseUrl = process.env.PORTAL_BASE_URL ?? 'https://marc.example'

function urlEntry(loc, lastmod) {
  const lm = lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ''
  return `  <url>\n    <loc>${baseUrl}${loc}</loc>${lm}\n  </url>`
}

const today = new Date().toISOString().slice(0, 10)

const urls = [
  urlEntry('/', today),
  urlEntry('/en', today),
  urlEntry('/projects', today),
  urlEntry('/en/projects', today),
  urlEntry('/intake', today),
  urlEntry('/en/intake', today),
  urlEntry('/tier-0', today),
  urlEntry('/en/tier-0', today),
  urlEntry('/demo/sunday-night-dread', today),
  urlEntry('/en/demo/sunday-night-dread', today),
  urlEntry('/confidentialite', today),
  urlEntry('/en/privacy', today),
]

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>
`

writeFileSync(join(portalRoot, 'public', 'sitemap.xml'), sitemap)
console.log(`sitemap.xml written with ${urls.length} URLs`)
