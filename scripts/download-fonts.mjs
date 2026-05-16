// Reproducible font fetch for the dynamic OG renderer.
//
// workers-og (satori + resvg WASM) requires explicit font byte buffers
// because the Cloudflare Workers runtime ships no system fonts. We
// commit the TTF files into public/fonts/ so they:
//   - serve as static assets cached at the Cloudflare edge,
//   - are fetched at OG-render time via same-origin /fonts/...,
//   - never count against the 1MB compressed Functions bundle limit.
//
// Source: github.com/google/fonts (the canonical Google Fonts mirror).
//
// Why Fira Sans and not Inter: satori 0.15 (current workers-og) crashes
// on variable fonts with "Cannot read properties of undefined (reading
// '256')" — its OpenType parser doesn't handle the variable axis tables.
// Inter's modern distribution only ships variable TTF; Fira Sans still
// ships per-weight static TTFs in google/fonts. Fira Sans is a Mozilla
// open-source sans-serif visually close to Inter for OG-card purposes.
//
// Run when first setting up, when bumping a weight, or if the files
// get corrupted/lost: `node scripts/download-fonts.mjs`.

import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const FONTS = [
  {
    url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/firasans/FiraSans-Regular.ttf',
    localName: 'FiraSans-Regular.ttf',
    minBytes: 100_000,
  },
  {
    url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/firasans/FiraSans-Bold.ttf',
    localName: 'FiraSans-Bold.ttf',
    minBytes: 100_000,
  },
]

const portalRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const dest = join(portalRoot, 'public', 'fonts')
if (!existsSync(dest)) mkdirSync(dest, { recursive: true })

let failed = 0
for (const f of FONTS) {
  try {
    const res = await fetch(f.url)
    if (!res.ok) {
      console.error(`download-fonts: ${f.url} → HTTP ${res.status}`)
      failed++
      continue
    }
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length < f.minBytes) {
      console.error(
        `download-fonts: ${f.url} returned ${buf.length} bytes (< ${f.minBytes} expected) — refusing to write`,
      )
      failed++
      continue
    }
    writeFileSync(join(dest, f.localName), buf)
    console.log(`download-fonts: ${f.localName} (${(buf.length / 1024).toFixed(1)} KB)`)
  } catch (err) {
    console.error(`download-fonts: ${f.url} threw`, err)
    failed++
  }
}

if (failed > 0) {
  console.error(`download-fonts: ${failed} font(s) failed; see errors above.`)
  process.exit(1)
}
