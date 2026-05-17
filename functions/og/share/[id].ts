// GET /og/share/:id — dynamic 1200×630 PNG for a session's share link.
//
// Generated at edge-request time via workers-og (satori + resvg WASM).
// Slack/iMessage refuse SVG OG images, so we return PNG. Cached
// aggressively at the edge; the underlying showcase title rarely changes.
//
// Falls back to the static /og-image.png if the session is missing, not
// showcased, or rendering fails — the share link still works, the preview
// just isn't personalised.
//
// Debug mode: ?debug=1 returns text/plain with the resolved fields instead
// of a PNG. Useful when verifying the function is actually reachable.

import { ImageResponse } from 'workers-og'
import type { Env } from '../../_lib/env'
import { loadSession } from '../../_lib/sessions'
import { loadOgFonts } from '../../_lib/og-fonts'
import { captureWorkerException } from '../../_lib/sentry'

interface OgFields {
  title: string
  tagline: string
  tier: number | null
  status: string
}

async function loadOgFields(env: Env, id: string): Promise<OgFields | null> {
  const session = await loadSession(env.DB, id)
  if (!session) return null
  if (session.deleted_at) return null
  if (!session.showcased_at) return null
  return {
    title: session.showcase_title || 'Projet en cours',
    tagline: session.showcase_tagline || '',
    tier: session.tier,
    status: session.status,
  }
}

// Response.redirect() requires an absolute URL. Build one from the incoming
// request so the redirect target stays on the same origin in any environment
// (preview deploys, production, custom domains).
function fallbackRedirect(request: Request, reason: string): Response {
  const target = new URL('/og-image.png', request.url).toString()
  return new Response(null, {
    status: 302,
    headers: {
      location: target,
      'cache-control': 'public, max-age=60',
      'x-og-fallback': reason,
    },
  })
}

function debugResponse(payload: Record<string, unknown>): Response {
  return new Response(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}

export const onRequestGet: PagesFunction<Env> = async ({ env, params, request }) => {
  const id = String(params.id ?? '')
  const url = new URL(request.url)
  const debug = url.searchParams.get('debug') === '1'

  if (!id) {
    if (debug) return debugResponse({ ok: false, reason: 'missing-id' })
    return fallbackRedirect(request, 'missing-id')
  }

  let fields: OgFields | null = null
  let loadErr: string | null = null
  try {
    fields = await loadOgFields(env, id)
  } catch (err) {
    loadErr = err instanceof Error ? err.message : String(err)
    console.warn('og: loadSession failed', err)
    if (debug) return debugResponse({ ok: false, reason: 'load-error', error: loadErr, id })
    return fallbackRedirect(request, 'load-error')
  }

  if (!fields) {
    if (debug) return debugResponse({ ok: false, reason: 'not-showcased-or-missing', id })
    return fallbackRedirect(request, 'not-showcased-or-missing')
  }

  if (debug) {
    return debugResponse({ ok: true, id, fields })
  }

  // workers-og takes JSX-like HTML strings; satori renders them to SVG, resvg
  // converts to PNG. The shape mirrors public/og-image.svg: cream paper,
  // mono eyebrow, big serif headline, sage accent line.
  //
  // Font-family must reference a name we register via the `fonts` option
  // below — Cloudflare Workers have no system fonts, so satori would
  // produce an empty/garbled SVG (that resvg then turns into a 200-byte
  // corrupt PNG) if asked for system-ui / Consolas / etc.
  const tierLabel = fields.tier !== null ? `TIER ${fields.tier}` : 'PROJET'
  const safeTitle = fields.title.length > 64 ? fields.title.slice(0, 61) + '…' : fields.title
  const safeTagline =
    fields.tagline.length > 120 ? fields.tagline.slice(0, 117) + '…' : fields.tagline
  const lang = url.searchParams.get('lang') === 'en' ? 'en' : 'fr'
  const footerLabel = lang === 'en' ? 'SHARED FROM MARC.PORTAL' : 'PARTAGÉ DEPUIS MARC.PORTAL'

  // satori is strict: every <div> must have explicit `display: flex` (or
  // `display: none`) if it has more than one child, AND multi-line template
  // whitespace becomes text-node children around the actual text. So we
  // emit a single-line tree and set display:flex on every container.
  // Single-text divs additionally get the text on the same line so the
  // parser never sees stray whitespace-text-node siblings.
  const tagline = safeTagline
    ? `<div style="display:flex;margin-top:28px;font-size:28px;color:#3f3c34;line-height:1.35;max-width:1040px;font-weight:400;">${escapeHtml(safeTagline)}</div>`
    : ''
  const html =
    `<div style="display:flex;flex-direction:column;width:100%;height:100%;padding:80px;background:linear-gradient(180deg,#fbf7ec 0%,#f6f1e6 100%);font-family:FiraSans;">` +
    `<div style="display:flex;align-items:center;gap:18px;color:#7a7568;font-size:22px;letter-spacing:3px;font-weight:400;">` +
    `<div style="display:flex;">${tierLabel}</div>` +
    `<div style="display:flex;">·</div>` +
    `<div style="display:flex;">${escapeHtml(fields.status.toUpperCase())}</div>` +
    `<div style="display:flex;">·</div>` +
    `<div style="display:flex;">MARC.PORTAL</div>` +
    `</div>` +
    `<div style="display:flex;margin-top:60px;font-size:62px;font-weight:700;color:#1f1d18;line-height:1.05;letter-spacing:-0.02em;">${escapeHtml(safeTitle)}</div>` +
    tagline +
    `<div style="margin-top:auto;display:flex;align-items:center;gap:16px;">` +
    `<div style="display:flex;width:140px;height:4px;background:#3d6e4e;"></div>` +
    `<div style="display:flex;color:#7a7568;font-size:20px;letter-spacing:2px;font-weight:400;">${escapeHtml(footerLabel)}</div>` +
    // NOTE: the VÉRIFIÉ stamp that was here (added 2026-05-17, reverted
    // same day) was the suspected trigger for prod CF Worker error 1102
    // (CPU exceeded). Worker 1102 fires before our try/catch can fall
    // back, so the share preview broke entirely. The static home OG
    // (og-image.svg → og-image.png) still carries the visual mark; the
    // per-session card stays clean. Don't reintroduce without measuring
    // satori render time on the actual prod worker.
    `</div>` +
    `</div>`

  // Render path. Two failure modes wrapped here:
  //   1. Font fetch — synchronous error before satori runs (caught easily).
  //   2. satori/resvg streaming — `new ImageResponse(...)` returns sync,
  //      but the actual render happens lazily as the body streams. We
  //      `await imgResp.arrayBuffer()` inside the try so streaming
  //      errors land in the catch instead of slipping out as a 200 with
  //      a few bytes of garbage (the bug this whole change exists to fix).
  try {
    const fonts = await loadOgFonts(request)
    const imgResp = new ImageResponse(html, {
      width: 1200,
      height: 630,
      fonts,
    })
    const png = await imgResp.arrayBuffer()
    return new Response(png, {
      status: 200,
      headers: {
        'content-type': 'image/png',
        // Cache for a day at the edge; the showcase title rarely changes.
        'cache-control': 'public, max-age=86400, s-maxage=86400',
      },
    })
  } catch (err) {
    console.warn('og: render failed', err)
    captureWorkerException(err, {
      request,
      op: 'og.share.render',
      extra: { id, lang },
    })
    // ?debug=render surfaces the real error message instead of redirecting
    // to the static fallback. Useful when investigating why a particular
    // showcase produces a render-error in prod.
    if (url.searchParams.get('debug') === 'render') {
      return debugResponse({
        ok: false,
        reason: 'render-error',
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        id,
        lang,
      })
    }
    return fallbackRedirect(request, 'render-error')
  }
}

// Treat HEAD identically — some scrapers HEAD the OG URL first to validate.
export const onRequestHead = onRequestGet

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
