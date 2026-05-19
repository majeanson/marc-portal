// GET /og/home — dynamic 1200×630 PNG for the home page's social unfurl.
//
// Editorial layout: cream paper, mono eyebrow, big trio headline, sage
// accent line, live stats footer (shipped count + currently-active
// project, pulled from D1 at request time).
//
// FR by default; `?lang=en` for the English variant.
//
// Same diagnostics as /og/share/:id:
//   ?debug=1       → JSON of resolved fields (no render)
//   ?debug=render  → JSON of satori's actual error on failure
//
// Falls back to /og-image.png (FR) or /og-image-en.png (EN) if anything
// in the render path throws — same pattern as the project endpoint.

import { ImageResponse } from 'workers-og'
import type { Env } from '../_lib/env'
import { loadOgFonts } from '../_lib/og-fonts'
import { captureWorkerException } from '../_lib/sentry'

interface HomeFields {
  shippedCount: number
  activeTitle: string | null
}

async function loadHomeFields(env: Env): Promise<HomeFields> {
  // Two small reads. Combined into one row via a subselect so D1 only
  // sees one prepare/execute round-trip on the hot path.
  const row = await env.DB.prepare(
    `SELECT
       (SELECT COUNT(*) FROM sessions
        WHERE showcased_at IS NOT NULL AND deleted_at IS NULL AND status = 'shipped')
         AS shipped_count,
       (SELECT showcase_title FROM sessions
        WHERE showcased_at IS NOT NULL AND deleted_at IS NULL AND status = 'active'
        ORDER BY showcased_at DESC LIMIT 1)
         AS active_title`,
  ).first<{ shipped_count: number; active_title: string | null }>()

  return {
    shippedCount: row?.shipped_count ?? 0,
    activeTitle: row?.active_title ?? null,
  }
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

function fallbackRedirect(request: Request, lang: 'fr' | 'en', reason: string): Response {
  const target = new URL(
    lang === 'en' ? '/og-image-en.png' : '/og-image.png',
    request.url,
  ).toString()
  return new Response(null, {
    status: 302,
    headers: {
      location: target,
      'cache-control': 'public, max-age=60',
      'x-og-fallback': reason,
    },
  })
}

interface Copy {
  eyebrow: string
  brand: string
  headline: [string, string, string]
  shippedLabel: (n: number) => string
  activeLabel: string
  noActiveLabel: string
  responseLabel: string
  footerHost: string
}

const COPY: Record<'fr' | 'en', Copy> = {
  fr: {
    eyebrow: 'SIDE-GIG · QUÉBEC · ASYNC',
    brand: 'marc.portal',
    headline: ['Dev québécois.', 'Job de jour.', 'Le soir, j’aide.'],
    shippedLabel: (n) => (n === 1 ? '1 PROJET LIVRÉ' : `${n} PROJETS LIVRÉS`),
    activeLabel: 'EN COURS',
    noActiveLabel: 'PROCHAIN CRÉNEAU OUVERT',
    responseLabel: 'RÉPONSE 72H',
    footerHost: 'marcportal.com',
  },
  en: {
    eyebrow: 'SIDE PRACTICE · QUEBEC · ASYNC',
    brand: 'marc.portal',
    headline: ['Québécois dev.', 'Day job.', 'I help at night.'],
    shippedLabel: (n) => (n === 1 ? '1 PROJECT SHIPPED' : `${n} PROJECTS SHIPPED`),
    activeLabel: 'IN PROGRESS',
    noActiveLabel: 'NEXT SLOT OPEN',
    responseLabel: 'REPLY IN 72H',
    footerHost: 'marcportal.com',
  },
}

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const url = new URL(request.url)
  const lang: 'fr' | 'en' = url.searchParams.get('lang') === 'en' ? 'en' : 'fr'
  const debug = url.searchParams.get('debug') === '1'

  let fields: HomeFields
  try {
    fields = await loadHomeFields(env)
  } catch (err) {
    console.warn('og home: load failed', err)
    if (debug) {
      return debugResponse({
        ok: false,
        reason: 'load-error',
        error: err instanceof Error ? err.message : String(err),
      })
    }
    return fallbackRedirect(request, lang, 'load-error')
  }

  if (debug) {
    return debugResponse({ ok: true, lang, fields })
  }

  const c = COPY[lang]
  // Truncate active title defensively — it lives between two pipe
  // separators on the live-stats row, so anything past ~28 chars looks
  // off on the card. Same shape constraint the project card uses.
  const safeActive = fields.activeTitle
    ? fields.activeTitle.length > 28
      ? fields.activeTitle.slice(0, 25) + '…'
      : fields.activeTitle
    : null

  // satori is strict: every <div> with more than one child must declare
  // display:flex (or none). Multi-line template whitespace becomes
  // text-node siblings, so we emit the whole tree as one concatenated
  // string and force display:flex on every container. Same convention
  // as functions/og/share/[id].ts — see the long comment there.
  const html =
    `<div style="display:flex;flex-direction:column;width:100%;height:100%;padding:80px;background:linear-gradient(180deg,#fbf7ec 0%,#f6f1e6 100%);font-family:FiraSans;">` +
    // top eyebrow
    `<div style="display:flex;color:#7a7568;font-size:22px;letter-spacing:3px;font-weight:400;">${escapeHtml(c.eyebrow)}</div>` +
    // brand
    `<div style="display:flex;margin-top:24px;color:#1f1d18;font-size:38px;font-weight:700;letter-spacing:-0.01em;">${escapeHtml(c.brand)}</div>` +
    // headline trio
    `<div style="display:flex;flex-direction:column;margin-top:48px;gap:8px;">` +
    `<div style="display:flex;font-size:64px;font-weight:700;color:#1f1d18;line-height:1.05;letter-spacing:-0.02em;">${escapeHtml(c.headline[0])}</div>` +
    `<div style="display:flex;font-size:64px;font-weight:700;color:#1f1d18;line-height:1.05;letter-spacing:-0.02em;">${escapeHtml(c.headline[1])}</div>` +
    `<div style="display:flex;font-size:64px;font-weight:700;color:#3d6e4e;line-height:1.05;letter-spacing:-0.02em;">${escapeHtml(c.headline[2])}</div>` +
    `</div>` +
    // sage accent line
    `<div style="display:flex;margin-top:48px;width:140px;height:4px;background:#3d6e4e;"></div>` +
    // live stats row, pinned to bottom with margin-top:auto
    `<div style="margin-top:auto;display:flex;flex-direction:column;gap:14px;">` +
    `<div style="display:flex;align-items:center;gap:18px;color:#3f3c34;font-size:24px;font-weight:700;letter-spacing:1px;">` +
    `<div style="display:flex;color:#7a7568;font-size:20px;letter-spacing:2px;font-weight:400;">${safeActive ? escapeHtml(c.activeLabel) : escapeHtml(c.noActiveLabel)}</div>` +
    (safeActive
      ? `<div style="display:flex;">${escapeHtml(safeActive)}</div>`
      : `<div style="display:flex;color:#3d6e4e;">${escapeHtml(c.responseLabel)}</div>`) +
    `</div>` +
    `<div style="display:flex;align-items:center;gap:18px;color:#3f3c34;font-size:24px;font-weight:700;letter-spacing:1px;">` +
    `<div style="display:flex;color:#7a7568;font-size:20px;letter-spacing:2px;font-weight:400;">${escapeHtml(c.shippedLabel(fields.shippedCount))}</div>` +
    `<div style="display:flex;color:#7a7568;font-size:20px;letter-spacing:2px;font-weight:400;">·</div>` +
    `<div style="display:flex;color:#7a7568;font-size:20px;letter-spacing:2px;font-weight:400;">${escapeHtml(c.footerHost)}</div>` +
    `</div>` +
    `</div>` +
    `</div>`

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
        // 1 hour edge cache: short enough that shipping a project
        // shows up in the home unfurl reasonably soon, long enough
        // to absorb scraper bursts. Project cards use 24h because
        // their content is per-card and slower-moving.
        'cache-control': 'public, max-age=3600, s-maxage=3600',
      },
    })
  } catch (err) {
    console.warn('og home: render failed', err)
    captureWorkerException(err, { request, op: 'og.home.render', extra: { lang } })
    if (url.searchParams.get('debug') === 'render') {
      return debugResponse({
        ok: false,
        reason: 'render-error',
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        lang,
        fields,
      })
    }
    return fallbackRedirect(request, lang, 'render-error')
  }
}

export const onRequestHead = onRequestGet

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
