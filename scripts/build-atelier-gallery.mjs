// Build the Atelier gallery — turn the committed Playwright visual
// baselines (e2e/__screenshots__/<viewport>/*.png) into a public,
// browsable craft exhibit. Emits:
//
//   src/data/atelier-gallery.json   — committed manifest the /atelier page
//                                     imports directly (zero runtime cost)
//   public/atelier/thumbs/...webp   — small cropped thumbnails for the grid
//   public/atelier/full/...png      — original captures, loaded on click
//
// Why a build script (mirrors build-lac-meta + build-map-skeleton):
//   (a) the baselines live OUTSIDE src/, so Vite's import.meta.glob can't
//       reach them; (b) the raw PNGs are ~60 MB — shipping them through the
//       JS bundle is a non-starter, so we down-scale to WebP here.
//
// public/atelier/** is a regenerated artifact (git-ignored). Only the
// manifest JSON is committed — and it carries NO timestamp, so a second
// build produces a byte-identical file and CI's `git diff --quiet` check
// stays clean (same rule build-map-skeleton.mjs documents).
//
// sharp is the thumbnailer. It's wrapped so a missing native binary
// degrades to copying the originals rather than hard-failing the build.

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const portalRoot = dirname(dirname(__filename))

const SHOTS_DIR = join(portalRoot, 'e2e', '__screenshots__')
const PUBLIC_OUT = join(portalRoot, 'public', 'atelier')
const THUMBS_OUT = join(PUBLIC_OUT, 'thumbs')
const FULL_OUT = join(PUBLIC_OUT, 'full')
const DATA_OUT = join(portalRoot, 'src', 'data', 'atelier-gallery.json')
const SKELETON_PATH = join(portalRoot, 'src', 'data', 'map-skeleton.json')

const THUMB_W = 600 // target thumbnail width; never upscales past the source
const THUMB_MAX_ASPECT = 1.6 // crop the top of a tall capture so cards stay scannable

// The four Playwright projects (see playwright.config.ts). Only viewports
// with an on-disk baseline dir end up in the manifest.
const VIEWPORTS = [
  { id: 'phone', label: { fr: 'Téléphone', en: 'Phone' }, width: 390, height: 844 },
  { id: 'narrow', label: { fr: 'Écran étroit', en: 'Narrow' }, width: 1000, height: 900 },
  { id: 'wide', label: { fr: 'Grand écran', en: 'Wide' }, width: 1440, height: 900 },
  { id: 'dark', label: { fr: 'Mode soir', en: 'Dark' }, width: 1440, height: 900, theme: 'dark' },
]

// Human, bilingual labels per route component. The slug→component mapping
// comes from the route skeleton; this turns a component into a caption.
const ROUTE_LABELS = {
  RootByTemplate: { fr: 'La page d’accueil', en: 'The home page' },
  Tier0: { fr: 'Tier 0 — le premier échange', en: 'Tier 0 — the first chat' },
  Intake: { fr: 'Le formulaire d’intake', en: 'The intake form' },
  Napkin: { fr: 'La napkin', en: 'The napkin sketch' },
  Journey: { fr: 'Le parcours', en: 'The journey' },
  Projects: { fr: 'La galerie de projets', en: 'The projects gallery' },
  Vouches: { fr: 'Les témoignages', en: 'The testimonials' },
  Vouch: { fr: 'Laisser un mot', en: 'Leave a vouch' },
  Handoff: { fr: 'La passation', en: 'The handoff' },
  HandoffChecklist: { fr: 'La liste de passation', en: 'The handoff checklist' },
  Login: { fr: 'La connexion', en: 'The login' },
  MagicLinkSent: { fr: 'Lien magique envoyé', en: 'Magic link sent' },
  MePortal: { fr: 'Mon espace', en: 'My space' },
  Meta: { fr: 'Sous le capot', en: 'Under the hood' },
  MapPage: { fr: 'La carte du site', en: 'The site map' },
  Privacy: { fr: 'La vie privée', en: 'Privacy' },
  Pia: { fr: 'La protection des données', en: 'Data protection' },
  Atelier: { fr: 'L’atelier', en: 'The workshop' },
}

// Reading order for the grid — fr/en of the same surface land adjacent.
const COMPONENT_ORDER = Object.keys(ROUTE_LABELS)

/** A URL path → a flat, filesystem-safe slug. Mirrors e2e/routes.ts so a
 *  baseline filename round-trips back to its route. '/' → 'root'. */
function slug(path) {
  const s = path.replace(/^\/+/, '').replace(/\/+$/, '').replace(/\//g, '-')
  return s || 'root'
}

/** Read a PNG's pixel dimensions straight from its IHDR chunk — no decode,
 *  no dependency. Width/height are big-endian uint32 at byte offsets 16/20. */
function pngSize(path) {
  const buf = readFileSync(path)
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
}

// ─── slug → route lookup, from the generated skeleton ────────────────────────

const skeleton = JSON.parse(readFileSync(SKELETON_PATH, 'utf8'))
const routeBySlug = new Map()
for (const r of skeleton.routes) {
  if (r.inAdminShell || r.dynamic) continue
  routeBySlug.set(slug(r.path), r)
}

/** Resolve a baseline filename slug to {route, variant}. Error-state shots
 *  (projects-empty, vouches-error, …) have no route of their own — they
 *  carry a `-empty`/`-error` suffix over a base route slug. */
function resolveSlug(name) {
  const direct = routeBySlug.get(name)
  if (direct) return { route: direct, variant: null }
  for (const variant of ['empty', 'error']) {
    if (name.endsWith(`-${variant}`)) {
      const base = routeBySlug.get(name.slice(0, -(variant.length + 1)))
      if (base) return { route: base, variant }
    }
  }
  return null
}

// ─── sharp (optional) ────────────────────────────────────────────────────────

let sharp = null
try {
  sharp = (await import('sharp')).default
} catch {
  console.warn('build-atelier-gallery: sharp unavailable — copying full PNGs as thumbnails')
}

// ─── build ───────────────────────────────────────────────────────────────────

rmSync(PUBLIC_OUT, { recursive: true, force: true })
mkdirSync(THUMBS_OUT, { recursive: true })
mkdirSync(FULL_OUT, { recursive: true })

const shots = []
const usedViewports = []
let unresolved = 0

for (const vp of VIEWPORTS) {
  const dir = join(SHOTS_DIR, vp.id)
  if (!existsSync(dir)) continue
  usedViewports.push(vp)
  mkdirSync(join(THUMBS_OUT, vp.id), { recursive: true })
  mkdirSync(join(FULL_OUT, vp.id), { recursive: true })

  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.png')) continue
    const name = file.slice(0, -4)
    const resolved = resolveSlug(name)
    if (!resolved) {
      console.warn(`build-atelier-gallery: skipping unmapped baseline ${vp.id}/${file}`)
      unresolved++
      continue
    }
    const { route, variant } = resolved
    const src = join(dir, file)
    const { width: srcW, height: srcH } = pngSize(src)

    // Copy the original for the click-to-enlarge lightbox.
    copyFileSync(src, join(FULL_OUT, vp.id, file))

    // Thumbnail — down-scaled, top-cropped if the capture is very tall.
    const thumbW = Math.min(THUMB_W, srcW)
    const scale = thumbW / srcW
    const fullScaledH = Math.round(srcH * scale)
    const maxThumbH = Math.round(thumbW * THUMB_MAX_ASPECT)
    const cropped = fullScaledH > maxThumbH
    const thumbH = cropped ? maxThumbH : fullScaledH

    let thumbPath
    if (sharp) {
      thumbPath = `/atelier/thumbs/${vp.id}/${name}.webp`
      let pipe = sharp(src)
      if (cropped) {
        const cropSrcH = Math.min(srcH, Math.max(1, Math.round(maxThumbH / scale)))
        pipe = pipe.extract({ left: 0, top: 0, width: srcW, height: cropSrcH })
      }
      await pipe
        .resize({ width: thumbW, withoutEnlargement: true })
        .webp({ quality: 72 })
        .toFile(join(THUMBS_OUT, vp.id, `${name}.webp`))
    } else {
      // Degraded path — no thumbnailer; the grid uses the full PNG.
      thumbPath = `/atelier/full/${vp.id}/${file}`
    }

    // The label is the pure page name; the empty/error state is carried in
    // `variant` and rendered as a badge by the page, not folded into the text.
    const label = ROUTE_LABELS[route.component] ?? { fr: route.component, en: route.component }

    shots.push({
      slug: name,
      viewport: vp.id,
      route: route.path,
      component: route.component,
      lang: route.lang,
      variant,
      label: { fr: label.fr, en: label.en },
      thumb: thumbPath,
      full: `/atelier/full/${vp.id}/${file}`,
      thumbW,
      thumbH,
      fullH: srcH,
      cropped,
    })
  }
}

// Stable order: viewport, then reading order, then fr before en, then the
// base capture before its empty/error variants.
const vpRank = new Map(VIEWPORTS.map((v, i) => [v.id, i]))
const variantRank = { null: 0, empty: 1, error: 2 }
shots.sort((a, b) => {
  if (a.viewport !== b.viewport) return vpRank.get(a.viewport) - vpRank.get(b.viewport)
  const ca = COMPONENT_ORDER.indexOf(a.component)
  const cb = COMPONENT_ORDER.indexOf(b.component)
  if (ca !== cb) return ca - cb
  if (a.lang !== b.lang) return a.lang === 'fr' ? -1 : 1
  return variantRank[String(a.variant)] - variantRank[String(b.variant)]
})

writeFileSync(
  DATA_OUT,
  JSON.stringify({ viewports: usedViewports, shots, count: shots.length }, null, 2) + '\n',
)

console.log(
  `build-atelier-gallery: ${shots.length} shots / ${usedViewports.length} viewports` +
    `${unresolved ? ` (${unresolved} unmapped, skipped)` : ''} → src/data/atelier-gallery.json`,
)
