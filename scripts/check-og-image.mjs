// CI guard: fails the build when the OG SVG was edited without re-running
// `node scripts/build-og-image.mjs`. Compares the SVG's current SHA-256
// against the value stored in public/og-image.hash.json (written by
// build-og-image.mjs after each rasterise).
//
// Why a check instead of regenerating on every build? `sharp` is a hefty
// native binary; the PNGs rarely change. The committed PNGs keep Pages
// builds fast and deterministic — this script catches the "I edited the
// SVG and forgot the PNG" case.
//
// On hash mismatch: prints which variant drifted and exits 1.
// On missing hash file: warning, exits 0 (first run, pre-rollout deploys).

import { readFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const portalRoot = dirname(dirname(__filename))
const hashPath = join(portalRoot, 'public', 'og-image.hash.json')

if (!existsSync(hashPath)) {
  console.warn('check-og-image: og-image.hash.json missing — run build-og-image.mjs once.')
  process.exit(0)
}

const stored = JSON.parse(readFileSync(hashPath, 'utf8'))
const variants = [
  { svg: 'og-image.svg', label: 'fr' },
  { svg: 'og-image-en.svg', label: 'en' },
]

let drift = false
for (const v of variants) {
  const svg = readFileSync(join(portalRoot, 'public', v.svg))
  const current = createHash('sha256').update(svg).digest('hex')
  if (current !== stored[v.label]) {
    console.error(
      `check-og-image: ${v.svg} hash drifted (${current.slice(0, 12)} vs stored ${(stored[v.label] ?? '∅').slice(0, 12)}).`,
    )
    console.error('  Re-run: node scripts/build-og-image.mjs')
    drift = true
  }
}

if (drift) process.exit(1)
console.log('check-og-image: PNGs are in sync with SVGs.')
