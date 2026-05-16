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
// We pull the Inter variable TTF — a single ~875 KB file containing
// the entire weight axis. satori reads the `wght` axis at render time,
// so the same buffer serves every weight we ask for. This is much
// simpler than juggling per-weight static files (which Inter's modern
// distribution no longer ships in TTF form).
//
// Run when first setting up, when bumping Inter, or if the file gets
// corrupted/lost: `node scripts/download-fonts.mjs`.

import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const FONTS = [
  {
    // URL uses the percent-encoded form of `Inter[opsz,wght].ttf`. The
    // bracket characters are required in the filename — Google's font
    // pipeline produces them — so they round-trip through the URL.
    url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/inter/Inter%5Bopsz%2Cwght%5D.ttf',
    localName: 'Inter.ttf',
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
