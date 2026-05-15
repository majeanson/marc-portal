// feat-fleet-foundation
// Edge middleware: every request to a Pages Function passes through here.
// Resolves the Host header to a Tenant, attaches it to ctx.data, and rejects
// unknown hosts with 404. Static asset serving (handled by Pages directly,
// not Functions) is not affected — only API/SSR paths run through this.
//
// What this middleware does NOT do:
//   - Inject the per-tenant theme into HTML responses. The SPA fetches the
//     resolved tenant via /api/tenant on mount and applies the theme client-
//     side (acceptable for v1; SSR theme injection comes later).
//   - Auth scoping. That's per-handler. The middleware only guarantees
//     ctx.data.tenant exists when the handler runs.
//
// Dev: localhost:5173 (Vite) doesn't route through this — Vite serves static
// assets and proxies /api to the Functions runtime. The middleware is exercised
// in `wrangler pages dev` and in production.

import { requireCsrf } from './_lib/auth'
import { resolveTenant, type Tenant } from './_lib/tenant'

interface Env {
  DB: D1Database
  ADMIN_EMAILS?: string
  SESSION_SECRET?: string
  RESEND_API_KEY?: string
}

// State-changing /api/* requests are CSRF-gated centrally (see verifyCsrf in
// functions/_lib/auth.ts). These paths are exempt because they either don't
// have a user cookie to forge (logout / request-link / digest) or carry their
// own out-of-band auth (digest uses X-Digest-Token).
const CSRF_EXEMPT_PATHS: ReadonlySet<string> = new Set([
  '/api/auth/logout',
  '/api/auth/request-link',
  '/api/admin/digest',
])

const SAFE_METHODS: ReadonlySet<string> = new Set(['GET', 'HEAD', 'OPTIONS'])

// Augment the Pages Functions context with our tenant data so handlers can
// `const tenant = ctx.data.tenant` with full typing.
declare global {
  interface PagesContextData {
    tenant?: Tenant
  }
}

/**
 * Cookie name carrying the visitor's chosen language. Read by the locale
 * redirect (below) to honor a previous explicit choice; cleared if absent.
 */
const LANG_COOKIE_NAME = 'mp_lang'

function parseLangCookie(request: Request): 'fr' | 'en' | null {
  const header = request.headers.get('Cookie')
  if (!header) return null
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=')
    if (k === LANG_COOKIE_NAME) {
      const v = rest.join('=')
      if (v === 'fr' || v === 'en') return v
    }
  }
  return null
}

function preferredLangFromHeader(request: Request): 'fr' | 'en' | null {
  const al = request.headers.get('Accept-Language') ?? ''
  // Walk language tags in order; first FR/EN match wins. We don't honor
  // q-weights — the simple greedy walk is correct 99% of the time and
  // cheaper than parsing the full RFC 4647.
  for (const raw of al.split(',')) {
    const tag = raw.split(';')[0]!.trim().toLowerCase()
    if (tag.startsWith('en')) return 'en'
    if (tag.startsWith('fr')) return 'fr'
  }
  return null
}

export const onRequest: PagesFunction<Env> = async (ctx) => {
  const url = new URL(ctx.request.url)
  const host = url.host.toLowerCase()

  // First-visit locale redirect. Only fires on the bare root (`/`) so we
  // don't surprise users who deep-link into an FR page. Honors the explicit
  // cookie if set; otherwise checks Accept-Language. EN preference → 302 to
  // `/en`. FR (or no preference) stays. Idempotent — `/en` is exempt because
  // the URL already encodes the choice.
  if (url.pathname === '/' && ctx.request.method === 'GET') {
    const cookieLang = parseLangCookie(ctx.request)
    const headerLang = preferredLangFromHeader(ctx.request)
    const pick = cookieLang ?? headerLang
    if (pick === 'en') {
      return new Response(null, {
        status: 302,
        headers: { Location: `/en${url.search}${url.hash}` },
      })
    }
  }

  // The middleware fires on every Functions invocation, including /api/*.
  // We always resolve the tenant — handlers that don't care can ignore it.
  // Resolve the tenant from D1. If the tenants table doesn't exist yet
  // (migration 0002 not applied to this environment), we let the request
  // through *without* a tenant attached. Legacy handlers gracefully fall
  // back to their pre-fleet behavior; handlers that strictly require a
  // tenant (admin/*) call requireTenant and 500 cleanly. This keeps the
  // public site working during the migration deploy window.
  let tenant: Tenant | null = null
  try {
    tenant = await resolveTenant(ctx.env.DB, host)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (/no such table|tenants/.test(msg)) {
      // Pre-migration fall-through. Logged once for visibility.
      console.warn('tenancy not yet migrated; legacy handlers in use', { host })
      return ctx.next()
    }
    throw err
  }

  if (!tenant) {
    // Migration is applied but this Host isn't registered. Unknown host:
    // terse 404, no tenant info leaked.
    return new Response('Not found.', {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    })
  }

  if (tenant.status === 'frozen') {
    // Buyer's app is paused (non-payment, abuse, operator action). Stay terse —
    // the buyer's own admin can show a richer screen via their own surface.
    return new Response('This app is currently paused.', {
      status: 503,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    })
  }

  ;(ctx.data as PagesContextData).tenant = tenant

  // CSRF gate. State-changing /api/* requests must carry a token that matches
  // their mp_csrf cookie. Browsers don't let foreign origins read the cookie,
  // so an attacker can drive the browser to send it but can't echo it in a
  // header. Skip on safe methods, the explicit exempt list, and non-API paths.
  const isApi = url.pathname.startsWith('/api/')
  if (isApi && !SAFE_METHODS.has(ctx.request.method) && !CSRF_EXEMPT_PATHS.has(url.pathname)) {
    const csrfBlock = requireCsrf(ctx.request)
    if (csrfBlock) return csrfBlock
  }

  const response = await ctx.next()
  // Crawler-correct OG injection: SPA ships a single index.html with the FR
  // OG image hardcoded; for /en/* requests we swap to og-image-en.png, and
  // for /share/:id (or /en/share/:id) we point at the dynamic /og/share/:id
  // endpoint so the social card reflects the specific project. Bot scrapers
  // never run JS, so this rewrite is the only way they see the right card.
  return rewriteOgTags(response, url)
}

function rewriteOgTags(response: Response, url: URL): Response {
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('text/html')) return response

  const path = url.pathname
  // Only the SPA's index.html carries the OG meta tags we want to swap.
  // API endpoints can still return HTML (error pages), and rewriting their
  // bodies wastes work and risks corrupting structured responses.
  if (path.startsWith('/api/') || path.startsWith('/og/')) return response

  const isEn = path === '/en' || path.startsWith('/en/')
  const shareMatch = /^\/(?:en\/)?share\/([A-Za-z0-9_-]{6,})\/?$/.exec(path)

  // Default OG image (FR or EN flavor) — same as Home.tsx's runtime swap, but
  // applied server-side so first-render bots see the right card.
  let ogImage = isEn ? '/og-image-en.png' : '/og-image.png'
  const ogLocale = isEn ? 'en_CA' : 'fr_CA'

  if (shareMatch) {
    const sessionId = shareMatch[1]
    // Point at the dynamic per-project OG endpoint. The function below
    // renders on demand. ?lang= lets the renderer localize its footer.
    ogImage = `/og/share/${sessionId}${isEn ? '?lang=en' : ''}`
  }

  // Per-page hreflang. We map the current path to its FR/EN counterpart so
  // bots see a precise alternate (not just root). Bare paths are fine here
  // because they come out the wire as HTML, not through Vite's asset pipeline.
  const frPath = stripEnPrefix(path)
  const enPath = frPath === '/' ? '/en' : `/en${frPath}`
  const hreflangLinks =
    `<link rel="alternate" hreflang="fr-CA" href="${frPath}">` +
    `<link rel="alternate" hreflang="en-CA" href="${enPath}">` +
    `<link rel="alternate" hreflang="x-default" href="${frPath}">`

  // og:url — absolute URL of the current page. Some scrapers (LinkedIn, Slack)
  // disambiguate cache entries by this field; without a per-route value every
  // share collides on the home URL.
  const ogUrl = `${url.origin}${path}`

  const rewriter = new HTMLRewriter()
    .on('meta[property="og:image"]', {
      element(el) {
        el.setAttribute('content', ogImage)
      },
    })
    .on('meta[name="twitter:image"]', {
      element(el) {
        el.setAttribute('content', ogImage)
      },
    })
    .on('meta[property="og:locale"]', {
      element(el) {
        el.setAttribute('content', ogLocale)
      },
    })
    .on('meta[property="og:url"]', {
      element(el) {
        el.setAttribute('content', ogUrl)
      },
    })
    .on('head', {
      element(el) {
        el.append(hreflangLinks, { html: true })
      },
    })

  return rewriter.transform(response)
}

function stripEnPrefix(path: string): string {
  if (path === '/en') return '/'
  if (path.startsWith('/en/')) return path.slice(3) || '/'
  return path
}
