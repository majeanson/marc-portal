// One-off generator for the social-share OG image. Reads the master design
// from public/og-image.svg and rasterises it to public/og-image.png at the
// canonical 1200×630 used by Open Graph and Twitter (`summary_large_image`).
//
// Run when the design changes:
//   node scripts/build-og-image.mjs
//
// Why not generate on every build? Sharp pulls in a hefty native binary and
// the PNG never changes between deploys — committing the output keeps the
// Pages build fast and deterministic.

import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __filename = fileURLToPath(import.meta.url)
const portalRoot = dirname(dirname(__filename))
const svgPath = join(portalRoot, 'public', 'og-image.svg')
const pngPath = join(portalRoot, 'public', 'og-image.png')

const svg = readFileSync(svgPath)

// density 2 → sharp rasterises the 1200×630 SVG at 2× internally then resizes
// back down to 1200×630, anti-aliasing text edges. This is the trick for
// crisp text without ballooning the file size.
const png = await sharp(svg, { density: 288 })
  .resize(1200, 630, { fit: 'fill' })
  .png({ compressionLevel: 9, adaptiveFiltering: true })
  .toBuffer()

writeFileSync(pngPath, png)
console.log(`og-image.png written — ${(png.length / 1024).toFixed(1)} KB`)
