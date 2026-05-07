// Generate public/sitemap.xml from feat-*/feature.json files.
// Runs as a prebuild step. New showcase = new folder = sitemap updates automatically.

import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const portalRoot = dirname(dirname(__filename))
const baseUrl = process.env.PORTAL_BASE_URL ?? 'https://marc.example'

function collectFromFeatureJson(featurePath, slugs) {
  let stat
  try {
    stat = statSync(featurePath)
  } catch {
    return
  }
  if (!stat.isFile()) return

  const json = JSON.parse(readFileSync(featurePath, 'utf8'))
  const showcase = json.annotations?.find((a) => a.type === 'showcase')?.data
  if (showcase?.slug) {
    slugs.push({
      slug: showcase.slug,
      lastmod: json.lastVerifiedDate ?? showcase.shippedDate ?? showcase.targetShipDate ?? null,
    })
  }
}

function findShowcaseSlugs() {
  const slugs = []
  // Root feature.json (the parent portal feature can itself be a showcase).
  collectFromFeatureJson(join(portalRoot, 'feature.json'), slugs)
  // All feat-*/feature.json sibling directories.
  for (const entry of readdirSync(portalRoot)) {
    if (!entry.startsWith('feat-')) continue
    collectFromFeatureJson(join(portalRoot, entry, 'feature.json'), slugs)
  }
  return slugs
}

function urlEntry(loc, lastmod) {
  const lm = lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ''
  return `  <url>\n    <loc>${baseUrl}${loc}</loc>${lm}\n  </url>`
}

const slugs = findShowcaseSlugs()
const today = new Date().toISOString().slice(0, 10)

const urls = [
  urlEntry('/', today),
  urlEntry('/en', today),
  ...slugs.flatMap((s) => [
    urlEntry(`/showcase/${s.slug}`, s.lastmod ?? today),
    urlEntry(`/en/showcase/${s.slug}`, s.lastmod ?? today),
  ]),
]

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>
`

writeFileSync(join(portalRoot, 'public', 'sitemap.xml'), sitemap)
console.log(`sitemap.xml written with ${urls.length} URLs (${slugs.length} showcases)`)
