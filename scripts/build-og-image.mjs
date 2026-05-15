// One-off generator for the social-share OG images. Reads each language's
// master SVG from public/og-image*.svg and rasterises to PNG at the
// canonical 1200×630 used by Open Graph and Twitter (`summary_large_image`).
//
// Run when the design changes:
//   node scripts/build-og-image.mjs
//
// Why not generate on every build? Sharp pulls in a hefty native binary and
// the PNGs never change between deploys — committing the outputs keeps the
// Pages build fast and deterministic.

import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __filename = fileURLToPath(import.meta.url)
const portalRoot = dirname(dirname(__filename))

const variants = [
  { svg: 'og-image.svg', png: 'og-image.png', label: 'fr' },
  { svg: 'og-image-en.svg', png: 'og-image-en.png', label: 'en' },
]

const hashes = {}
for (const v of variants) {
  const svgPath = join(portalRoot, 'public', v.svg)
  const pngPath = join(portalRoot, 'public', v.png)
  const svg = readFileSync(svgPath)
  // density 288 → sharp rasterises the 1200×630 SVG at 2.4× internally then
  // resizes back down. Anti-aliases text edges without ballooning file size.
  const png = await sharp(svg, { density: 288 })
    .resize(1200, 630, { fit: 'fill' })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer()
  writeFileSync(pngPath, png)
  // Record the SVG hash at the time we rasterised. check-og-image.mjs uses
  // it as a stale-detector at build time.
  hashes[v.label] = createHash('sha256').update(svg).digest('hex')
  console.log(`${v.png} (${v.label}) — ${(png.length / 1024).toFixed(1)} KB`)
}

writeFileSync(
  join(portalRoot, 'public', 'og-image.hash.json'),
  JSON.stringify(hashes, null, 2) + '\n',
)
console.log('og-image.hash.json updated')
