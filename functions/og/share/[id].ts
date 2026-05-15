// GET /og/share/:id — dynamic 1200×630 PNG for a session's share link.
//
// Generated at edge-request time via workers-og (satori + resvg WASM).
// Slack/iMessage/LinkedIn refuse SVG OG images, so we return PNG. Cached
// aggressively at the edge; the underlying showcase title rarely changes.
//
// Falls back to the static /og-image.png if the session is missing, not
// showcased, or rendering fails — the share link still works, the preview
// just isn't personalised.

import { ImageResponse } from 'workers-og'
import type { Env } from '../../_lib/env'
import { loadSession } from '../../_lib/sessions'

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

function fallbackRedirect(): Response {
  return Response.redirect('/og-image.png', 302)
}

export const onRequestGet: PagesFunction<Env> = async ({ env, params, request }) => {
  const id = String(params.id ?? '')
  if (!id) return fallbackRedirect()

  let fields: OgFields | null = null
  try {
    fields = await loadOgFields(env, id)
  } catch (err) {
    console.warn('og: loadSession failed', err)
    return fallbackRedirect()
  }
  if (!fields) return fallbackRedirect()

  // workers-og takes JSX-like HTML strings; satori renders them to SVG, resvg
  // converts to PNG. The shape mirrors our public og-image.svg: cream paper,
  // mono eyebrow, big serif headline, sage accent line.
  const tierLabel = fields.tier !== null ? `TIER ${fields.tier}` : 'PROJET'
  const safeTitle = fields.title.length > 64 ? fields.title.slice(0, 61) + '…' : fields.title
  const safeTagline =
    fields.tagline.length > 120 ? fields.tagline.slice(0, 117) + '…' : fields.tagline

  const html = `
    <div style="display:flex;flex-direction:column;width:100%;height:100%;padding:80px;background:linear-gradient(180deg,#fbf7ec 0%,#f6f1e6 100%);font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">
      <div style="display:flex;align-items:center;gap:18px;color:#7a7568;font-size:22px;letter-spacing:3px;font-family:Consolas,monospace;">
        <span>${tierLabel}</span>
        <span>·</span>
        <span>${escapeHtml(fields.status.toUpperCase())}</span>
        <span>·</span>
        <span>MARC.PORTAL</span>
      </div>
      <div style="margin-top:60px;font-size:62px;font-weight:700;color:#1f1d18;line-height:1.05;letter-spacing:-0.02em;">
        ${escapeHtml(safeTitle)}
      </div>
      ${
        safeTagline
          ? `<div style="margin-top:28px;font-size:28px;color:#3f3c34;line-height:1.35;max-width:1040px;">${escapeHtml(safeTagline)}</div>`
          : ''
      }
      <div style="margin-top:auto;display:flex;align-items:center;gap:16px;">
        <div style="width:140px;height:4px;background:#3d6e4e;"></div>
        <div style="color:#7a7568;font-size:20px;letter-spacing:2px;font-family:Consolas,monospace;">PARTAGÉ DEPUIS MARC.PORTAL</div>
      </div>
    </div>
  `

  try {
    const url = new URL(request.url)
    const lang = url.searchParams.get('lang') === 'en' ? 'en' : 'fr'
    const langLabel = lang === 'en' ? 'SHARED FROM MARC.PORTAL' : 'PARTAGÉ DEPUIS MARC.PORTAL'
    const finalHtml = html.replace('PARTAGÉ DEPUIS MARC.PORTAL', langLabel)

    return new ImageResponse(finalHtml, {
      width: 1200,
      height: 630,
      // Cache for a day at the edge; the showcase title rarely changes. The
      // fallback redirect path is never cached.
      headers: {
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      },
    })
  } catch (err) {
    console.warn('og: render failed', err)
    return fallbackRedirect()
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
