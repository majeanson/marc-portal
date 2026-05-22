// GET /og/certificate/:id — a 1000×1400 PNG "certificat de passation" for a
// shipped session. The keepsake artifact of ownership: project, date, what
// was transferred, the v1.0-handoff tag.
//
// Generated at edge-request time via workers-og (satori + resvg WASM), the
// same pipeline as /og/share/:id. Deliberately text-only — no embedded
// images, no decorative SVG — so satori render time stays well clear of the
// CF Worker CPU ceiling (see the 1102 note in og/share/[id].ts).
//
// Auth-gated, unlike the public share card: a certificate carries the
// visitor's name, so only the session owner (or an operator) may fetch it.
// The download link on the session page is a same-origin GET, so the
// session cookie rides along automatically.
//
// ?lang=en switches the copy. ?debug=1 returns the resolved fields as JSON.

import { ImageResponse } from 'workers-og'
import type { Env } from '../../_lib/env'
import { isAdmin } from '../../_lib/env'
import { currentEmail } from '../../_lib/auth'
import { loadSession } from '../../_lib/sessions'
import { loadOgFonts } from '../../_lib/og-fonts'
import { captureWorkerException } from '../../_lib/sentry'

const MONTHS = {
  fr: [
    'janvier',
    'février',
    'mars',
    'avril',
    'mai',
    'juin',
    'juillet',
    'août',
    'septembre',
    'octobre',
    'novembre',
    'décembre',
  ],
  en: [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ],
} as const

const COPY = {
  fr: {
    eyebrow: 'MARC.PORTAL · QUÉBEC',
    title: 'Certificat de passation',
    projectLabel: 'Projet',
    handedTo: (name: string, date: string) => `Remis à ${name} · le ${date}`,
    assetsHeading: 'Ce qui passe entre tes mains',
    assets: [
      'Le code source et le dépôt Git',
      'Le nom de domaine et le DNS',
      "L'hébergement et la base de données",
      'Les comptes et les clés d’accès',
      'La documentation de reprise',
    ],
    tagLine: 'Étiquette de version · v1.0-handoff',
    closing: 'À toi.',
    fallbackProject: 'Projet livré',
  },
  en: {
    eyebrow: 'MARC.PORTAL · QUÉBEC',
    title: 'Handoff Certificate',
    projectLabel: 'Project',
    handedTo: (name: string, date: string) => `Handed to ${name} · on ${date}`,
    assetsHeading: 'What passes into your hands',
    assets: [
      'The source code and the Git repository',
      'The domain name and DNS',
      'The hosting and the database',
      'The accounts and access keys',
      'The takeover documentation',
    ],
    tagLine: 'Version tag · v1.0-handoff',
    closing: 'All yours.',
    fallbackProject: 'Project shipped',
  },
} as const

interface CertFields {
  project: string
  name: string
  shippedAt: number
}

interface StatusHistoryEntry {
  to?: string
  at?: number
}

/** Resolve the moment the session shipped — the last status_history entry
 *  whose `to` is 'shipped', falling back to updated_at. */
function shippedTimestamp(statusHistory: string | null, updatedAt: number): number {
  if (statusHistory) {
    try {
      const hist = JSON.parse(statusHistory) as StatusHistoryEntry[]
      if (Array.isArray(hist)) {
        for (let i = hist.length - 1; i >= 0; i--) {
          if (hist[i]?.to === 'shipped' && typeof hist[i]?.at === 'number') {
            return hist[i].at as number
          }
        }
      }
    } catch {
      // fall through to updated_at
    }
  }
  return updatedAt
}

/** Visitor display name from the intake payload — name if given, else the
 *  local part of the email. */
function visitorName(intakeJson: string | null, email: string): string {
  if (intakeJson) {
    try {
      const p = JSON.parse(intakeJson) as { account?: { name?: unknown } }
      const n = p?.account?.name
      if (typeof n === 'string' && n.trim()) return n.trim()
    } catch {
      // fall through
    }
  }
  return email.split('@')[0]
}

function formatDate(sec: number, lang: 'fr' | 'en'): string {
  const d = new Date(sec * 1000)
  const day = d.getUTCDate()
  const month = MONTHS[lang][d.getUTCMonth()]
  const year = d.getUTCFullYear()
  return lang === 'fr' ? `${day} ${month} ${year}` : `${month} ${day}, ${year}`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function debugResponse(payload: Record<string, unknown>): Response {
  return new Response(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

function plain(status: number, message: string): Response {
  return new Response(message, {
    status,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
  })
}

export const onRequestGet: PagesFunction<Env> = async ({ env, params, request }) => {
  const id = String(params.id ?? '')
  const url = new URL(request.url)
  const debug = url.searchParams.get('debug') === '1'
  const lang = url.searchParams.get('lang') === 'en' ? 'en' : 'fr'
  const t = COPY[lang]

  if (!id) return plain(400, 'missing id')

  // Auth — only the owner or an operator may fetch a certificate.
  const viewer = await currentEmail(request, env.SESSION_SECRET)
  if (!viewer) return plain(401, 'sign in to download your certificate')

  let fields: CertFields | null = null
  try {
    const session = await loadSession(env.DB, id)
    if (session && !session.deleted_at) {
      const owner = isAdmin(env, viewer) || viewer.toLowerCase() === session.email.toLowerCase()
      if (!owner) return plain(403, 'not your session')
      if (session.status === 'shipped') {
        fields = {
          project: session.showcase_title?.trim() || t.fallbackProject,
          name: visitorName(session.intake_json, session.email),
          shippedAt: shippedTimestamp(session.status_history, session.updated_at),
        }
      }
    }
  } catch (err) {
    console.warn('certificate: loadSession failed', err)
    return plain(500, 'could not load the session')
  }

  if (!fields) {
    // Not shipped yet, or missing — no certificate to issue.
    if (debug) return debugResponse({ ok: false, reason: 'not-shipped-or-missing', id })
    return plain(404, 'no certificate for this session yet')
  }

  if (debug) return debugResponse({ ok: true, id, fields })

  const project = fields.project.length > 60 ? fields.project.slice(0, 57) + '…' : fields.project
  const dateStr = formatDate(fields.shippedAt, lang)
  const assetRows = t.assets
    .map(
      (a) =>
        `<div style="display:flex;font-size:26px;color:#3f3c34;margin-top:14px;">— ${escapeHtml(a)}</div>`,
    )
    .join('')

  // satori is strict — every multi-child div needs display:flex; single-text
  // divs keep their text on the same line. Text-only, no images: keeps the
  // render cheap.
  const html =
    // Root must use explicit pixel dimensions, not width/height:100%. Satori
    // has no parent for the root element, so a `%` size can't resolve and the
    // container collapses to fit-content — the bordered box would shrink to
    // its widest text line instead of filling the 1000×1400 canvas.
    `<div style="display:flex;width:1000px;height:1400px;padding:48px;background:linear-gradient(180deg,#fbf7ec 0%,#f6f1e6 100%);font-family:FiraSans;">` +
    `<div style="display:flex;flex-direction:column;flex:1;border:2px solid #d6cdb8;padding:64px 72px;">` +
    `<div style="display:flex;color:#7a7568;font-size:22px;letter-spacing:4px;">${escapeHtml(t.eyebrow)}</div>` +
    `<div style="display:flex;margin-top:34px;font-size:58px;font-weight:700;color:#1f1d18;letter-spacing:-0.01em;">${escapeHtml(t.title)}</div>` +
    `<div style="display:flex;width:120px;height:4px;background:#3d6e4e;margin-top:30px;"></div>` +
    `<div style="display:flex;margin-top:48px;color:#7a7568;font-size:22px;letter-spacing:3px;">${escapeHtml(t.projectLabel.toUpperCase())}</div>` +
    `<div style="display:flex;margin-top:10px;font-size:46px;font-weight:700;color:#1f1d18;line-height:1.1;">${escapeHtml(project)}</div>` +
    `<div style="display:flex;margin-top:18px;font-size:26px;color:#3f3c34;">${escapeHtml(t.handedTo(fields.name, dateStr))}</div>` +
    `<div style="display:flex;margin-top:52px;color:#7a7568;font-size:22px;letter-spacing:3px;">${escapeHtml(t.assetsHeading.toUpperCase())}</div>` +
    `<div style="display:flex;flex-direction:column;margin-top:8px;">${assetRows}</div>` +
    `<div style="display:flex;margin-top:44px;color:#566270;font-size:22px;letter-spacing:1px;">${escapeHtml(t.tagLine)}</div>` +
    `<div style="display:flex;margin-top:auto;align-items:flex-end;justify-content:space-between;">` +
    `<div style="display:flex;font-size:60px;font-weight:700;color:#3d6e4e;">${escapeHtml(t.closing)}</div>` +
    `<div style="display:flex;font-size:24px;color:#7a7568;letter-spacing:2px;">marc.portal</div>` +
    `</div>` +
    `</div>` +
    `</div>`

  try {
    const fonts = await loadOgFonts(request)
    const imgResp = new ImageResponse(html, { width: 1000, height: 1400, fonts })
    const png = await imgResp.arrayBuffer()
    return new Response(png, {
      status: 200,
      headers: {
        'content-type': 'image/png',
        // Private — the certificate is personal data; keep it off shared caches.
        'cache-control': 'private, max-age=300',
      },
    })
  } catch (err) {
    console.warn('certificate: render failed', err)
    captureWorkerException(err, { request, op: 'og.certificate.render', extra: { id, lang } })
    if (url.searchParams.get('debug') === 'render') {
      return debugResponse({
        ok: false,
        reason: 'render-error',
        error: err instanceof Error ? err.message : String(err),
        id,
      })
    }
    return plain(500, 'could not render the certificate')
  }
}
