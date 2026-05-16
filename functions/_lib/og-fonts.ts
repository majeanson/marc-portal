// Font loader for the dynamic OG renderer (functions/og/share/[id].ts).
//
// workers-og + satori need ArrayBuffer font data. We host the file as a
// static asset under /fonts/ so it serves from Cloudflare's edge cache
// without inflating the Functions bundle. This module fetches it on
// demand and keeps two layers of cache:
//
//   1. Per-isolate Map — warm starts within the same isolate skip the
//      fetch entirely (modules persist for the isolate's lifetime).
//   2. Cloudflare edge cache — we hint `cf.cacheTtl` so the colocated
//      cache stores the asset for a day; cold isolates pay only an
//      intra-DC fetch, not a cross-region one.
//
// The font is variable (Inter[opsz,wght].ttf, ~875 KB). satori reads
// the `wght` axis at render time, so we register the same buffer twice
// with different `weight` values — one logical font per visual weight.
//
// See scripts/download-fonts.mjs for how the file got into public/.

const FONT_FILES = {
  inter: '/fonts/Inter.ttf',
} as const

type FontKey = keyof typeof FONT_FILES

const cache = new Map<FontKey, ArrayBuffer>()

export interface OgFont {
  name: string
  data: ArrayBuffer
  weight: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900
  style: 'normal' | 'italic'
}

async function loadOne(request: Request, key: FontKey): Promise<ArrayBuffer> {
  const cached = cache.get(key)
  if (cached) return cached
  const url = new URL(FONT_FILES[key], request.url)
  // cacheTtl + cacheEverything: tell Cloudflare to keep the response
  // even though it's an internal subrequest. Without this, the worker
  // would re-fetch from the static-asset origin on every cold isolate.
  const res = await fetch(url.toString(), {
    cf: { cacheTtl: 86400, cacheEverything: true },
  } as RequestInit)
  if (!res.ok) {
    throw new Error(`og-fonts: failed to load ${url.pathname} (HTTP ${res.status})`)
  }
  const buf = await res.arrayBuffer()
  // Sanity-check the magic bytes. If the asset is missing in production
  // the static-asset host can return a 200 HTML 404 page; those bytes
  // would crash satori with a confusing error. Detect early.
  if (buf.byteLength < 1024) {
    throw new Error(`og-fonts: ${url.pathname} returned only ${buf.byteLength} bytes`)
  }
  const head = new Uint8Array(buf, 0, 4)
  // TTF: 00 01 00 00. OTF: 4F 54 54 4F ('OTTO'). True/Open Type
  // collection: 74 74 63 66 ('ttcf'). Anything else = wrong asset.
  const isTTF = head[0] === 0x00 && head[1] === 0x01 && head[2] === 0x00 && head[3] === 0x00
  const isOTF = head[0] === 0x4f && head[1] === 0x54 && head[2] === 0x54 && head[3] === 0x4f
  const isTTC = head[0] === 0x74 && head[1] === 0x74 && head[2] === 0x63 && head[3] === 0x66
  if (!isTTF && !isOTF && !isTTC) {
    throw new Error(
      `og-fonts: ${url.pathname} does not look like a font (magic ${[...head].map((b) => b.toString(16).padStart(2, '0')).join(' ')})`,
    )
  }
  cache.set(key, buf)
  return buf
}

/**
 * Load the full font set the OG card needs. Returns the array shape
 * workers-og's ImageResponse expects directly.
 *
 * Throws if any font fetch fails — caller should wrap in try/catch and
 * fall back to the static OG image.
 */
export async function loadOgFonts(request: Request): Promise<OgFont[]> {
  const inter = await loadOne(request, 'inter')
  return [
    { name: 'Inter', data: inter, weight: 400, style: 'normal' },
    { name: 'Inter', data: inter, weight: 700, style: 'normal' },
  ]
}

/**
 * Lower-level diagnostic for /og/ping?fonts=1. Returns byte counts
 * without throwing — surfaces missing/short assets as per-key errors
 * instead of failing the whole probe.
 */
export async function probeOgFonts(
  request: Request,
): Promise<Record<string, { ok: true; bytes: number } | { ok: false; error: string }>> {
  const out: Record<string, { ok: true; bytes: number } | { ok: false; error: string }> = {}
  for (const key of Object.keys(FONT_FILES) as FontKey[]) {
    try {
      const buf = await loadOne(request, key)
      out[key] = { ok: true, bytes: buf.byteLength }
    } catch (err) {
      out[key] = { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  }
  return out
}
