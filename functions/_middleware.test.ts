/**
 * Edge middleware coverage.
 *
 * Focus:
 *   - HTMLRewriter OG/hreflang injection per URL pattern
 *   - CSRF gate on state-changing /api/* requests with exempt-list
 *   - Tenant resolution doesn't block /api/* HTML (already exercised
 *     elsewhere; here we just confirm the SPA path stays alive).
 *
 * We don't exercise tenant errors here — those have D1 mocking branches
 * already covered by handler tests; the middleware's tenant path is a
 * narrow passthrough.
 */

import { describe, expect, it, vi } from 'vitest'

// HTMLRewriter is a Cloudflare Workers runtime API not available in
// happy-dom / Node. The describe blocks that exercise HTML rewriting (and
// any next() call returning text/html that flows through the rewriter)
// are conditionally skipped when HTMLRewriter is undefined. Run these
// under wrangler/miniflare or `@cloudflare/vitest-pool-workers` for full
// coverage.
const HAS_HTML_REWRITER =
  typeof (globalThis as { HTMLRewriter?: unknown }).HTMLRewriter !== 'undefined'

// Stub the tenant lookup so the middleware doesn't 404 on the test host.
// (The d1-mock has no matcher for the tenants/tenant_domains JOIN; rather
// than reach into the mock, just short-circuit the resolver — these tests
// are about the OG/hreflang/CSRF behaviour layered on top.)
vi.mock('./_lib/tenant', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('./_lib/tenant')
  return {
    ...actual,
    resolveTenant: vi.fn().mockResolvedValue({
      id: 't_marc',
      slug: 'marc',
      ownerEmail: 'marc@x.com',
      templateId: 'marc-portal',
      templateVersion: '1.0',
      theme: {},
      flags: { isOperator: true },
      status: 'active',
      createdAt: 1,
      frozenAt: null,
    }),
  }
})

import { onRequest } from './_middleware'
import { newCsrfToken } from './_lib/auth'
import { makeMockEnv } from '../tests/d1-mock'

function htmlIndex(): string {
  return [
    '<!doctype html><html><head>',
    '<meta property="og:image" content="/og-image.png">',
    '<meta name="twitter:image" content="/og-image.png">',
    '<meta property="og:image:alt" content="alt-fr">',
    '<meta name="twitter:image:alt" content="alt-fr">',
    '<meta property="og:title" content="title-fr">',
    '<meta property="og:description" content="desc-fr">',
    '<meta name="twitter:title" content="tw-title-fr">',
    '<meta name="twitter:description" content="tw-desc-fr">',
    '<meta property="og:locale" content="fr_CA">',
    '<meta property="og:url" content="https://x.test/">',
    '</head><body></body></html>',
  ].join('')
}

function makeCtx(opts: {
  method?: string
  url: string
  headers?: Record<string, string>
  next: () => Promise<Response>
}) {
  const init: RequestInit = { method: opts.method ?? 'GET' }
  if (opts.headers) init.headers = opts.headers
  const env = makeMockEnv()
  // Seed a tenant for the test host so the middleware lets the request through.
  // The mock D1 doesn't have full tenant support; the middleware's tenant
  // query falls into the "no such table" branch and passes through with no
  // tenant attached — exactly what we want for these tests.
  return {
    request: new Request(opts.url, init),
    env,
    data: {},
    next: opts.next,
    params: {},
  } as unknown as Parameters<typeof onRequest>[0]
}

describe.skipIf(!HAS_HTML_REWRITER)('middleware HTMLRewriter (OG + hreflang)', () => {
  it('rewrites og:image to /og-image-en.png on /en paths', async () => {
    const ctx = makeCtx({
      url: 'https://x.test/en/projects',
      next: async () => new Response(htmlIndex(), { headers: { 'content-type': 'text/html' } }),
    })
    const res = await onRequest(ctx)
    const body = await res.text()
    expect(body).toContain('content="https://x.test/og-image-en.png"')
    expect(body).toContain('content="en_CA"')
  })

  it('rewrites og:image to /og/share/:id on /share/:id paths', async () => {
    const ctx = makeCtx({
      url: 'https://x.test/share/abcdef1234',
      next: async () => new Response(htmlIndex(), { headers: { 'content-type': 'text/html' } }),
    })
    const res = await onRequest(ctx)
    const body = await res.text()
    expect(body).toContain('content="https://x.test/og/share/abcdef1234"')
  })

  it('appends per-page hreflang link tags into <head>', async () => {
    const ctx = makeCtx({
      url: 'https://x.test/projects',
      next: async () => new Response(htmlIndex(), { headers: { 'content-type': 'text/html' } }),
    })
    const res = await onRequest(ctx)
    const body = await res.text()
    expect(body).toContain('rel="alternate" hreflang="fr-CA" href="/projects"')
    expect(body).toContain('rel="alternate" hreflang="en-CA" href="/en/projects"')
    expect(body).toContain('rel="alternate" hreflang="x-default" href="/projects"')
  })

  it('rewrites og:title / og:description / twitter:* to EN on /en paths', async () => {
    const ctx = makeCtx({
      url: 'https://x.test/en/projects',
      next: async () => new Response(htmlIndex(), { headers: { 'content-type': 'text/html' } }),
    })
    const res = await onRequest(ctx)
    const body = await res.text()
    // EN strings — verify the FR baseline got swapped out and didn't leak.
    expect(body).toContain('Québécois dev, async')
    expect(body).toContain('Evenings and weekends')
    expect(body).not.toContain('title-fr')
    expect(body).not.toContain('desc-fr')
    expect(body).not.toContain('dev québécois, async, problèmes')
  })

  it('keeps FR og:title / og:description on bare FR paths', async () => {
    const ctx = makeCtx({
      url: 'https://x.test/projects',
      next: async () => new Response(htmlIndex(), { headers: { 'content-type': 'text/html' } }),
    })
    const res = await onRequest(ctx)
    const body = await res.text()
    expect(body).toContain('dev québécois, async, problèmes')
    expect(body).toContain('Soir et fin de semaine')
    expect(body).not.toContain('Québécois dev, async')
  })

  it('rewrites og:url to the absolute current page URL', async () => {
    const ctx = makeCtx({
      url: 'https://x.test/projects',
      next: async () => new Response(htmlIndex(), { headers: { 'content-type': 'text/html' } }),
    })
    const res = await onRequest(ctx)
    const body = await res.text()
    expect(body).toContain('content="https://x.test/projects"')
  })

  it('does NOT rewrite /api/* HTML responses (wasted work; risky)', async () => {
    const ctx = makeCtx({
      url: 'https://x.test/api/health',
      next: async () =>
        new Response(
          '<html><head><meta property="og:image" content="/og-image.png"></head></html>',
          {
            headers: { 'content-type': 'text/html' },
          },
        ),
    })
    const res = await onRequest(ctx)
    const body = await res.text()
    // Untouched — no hreflang appended, no og:image swap.
    expect(body).not.toContain('rel="alternate"')
    expect(body).toContain('content="/og-image.png"')
  })
})

describe('middleware locale redirect', () => {
  it('keeps / on FR even when Accept-Language prefers EN (FR is the default)', async () => {
    const ctx = makeCtx({
      url: 'https://x.test/',
      headers: { 'Accept-Language': 'en-US,en;q=0.9,fr;q=0.5' },
      // Plain-text body — bypasses the HTMLRewriter content-type check, so
      // the test runs in environments where HTMLRewriter isn't available.
      next: async () => new Response('home', { headers: { 'content-type': 'text/plain' } }),
    })
    const res = await onRequest(ctx)
    // Accept-Language is intentionally not consulted — the EnglishNudge
    // component handles the EN-browser case client-side instead.
    expect(res.status).toBe(200)
  })

  // Cookie is a forbidden header in fetch Request init (some happy-dom
  // builds strip it). For redirect tests that depend on mp_lang, build the
  // context with a hand-stubbed request that returns the cookie value.
  function ctxWithCookie(path: string, cookies: string, nextBody = 'home') {
    return {
      request: {
        method: 'GET',
        url: `https://x.test${path}`,
        headers: {
          get(name: string) {
            const n = name.toLowerCase()
            if (n === 'cookie') return cookies
            return null
          },
        },
      } as unknown as Request,
      env: makeMockEnv(),
      data: {},
      next: async () => new Response(nextBody, { headers: { 'content-type': 'text/plain' } }),
      params: {},
    } as unknown as Parameters<typeof onRequest>[0]
  }

  it('redirects / → /en when mp_lang=en cookie is set (explicit prior choice)', async () => {
    const res = await onRequest(ctxWithCookie('/', 'mp_lang=en'))
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('/en')
  })

  it('keeps / on FR when mp_lang=fr cookie is set', async () => {
    const res = await onRequest(ctxWithCookie('/', 'mp_lang=fr'))
    expect(res.status).toBe(200)
  })

  it('does not redirect non-root paths (only / is gated)', async () => {
    const res = await onRequest(ctxWithCookie('/projects', 'mp_lang=en'))
    expect(res.status).toBe(200)
  })
})

describe('middleware CSRF gate', () => {
  // Some happy-dom builds strip Cookie from Request init. Patch the Request
  // constructor inputs we pass so headers.get('Cookie') / get('x-csrf-token')
  // return the values we set — same pattern as auth.test.ts.

  function stubReqCtx(
    method: string,
    path: string,
    cookies: string | null,
    csrfHeader: string | null,
    next: () => Promise<Response>,
  ) {
    return {
      request: {
        method,
        url: `https://x.test${path}`,
        headers: {
          get(name: string) {
            const n = name.toLowerCase()
            if (n === 'cookie') return cookies
            if (n === 'x-csrf-token') return csrfHeader
            if (n === 'cf-connecting-ip') return '203.0.113.1'
            return null
          },
        },
      } as unknown as Request,
      env: makeMockEnv(),
      data: {},
      next,
      params: {},
    } as unknown as Parameters<typeof onRequest>[0]
  }

  it('blocks POST /api/* without CSRF header', async () => {
    let nextCalled = false
    const res = await onRequest(
      stubReqCtx('POST', '/api/sessions', 'mp_csrf=abc', null, async () => {
        nextCalled = true
        return new Response('ok')
      }),
    )
    expect(res.status).toBe(403)
    expect(nextCalled).toBe(false)
  })

  it('allows POST /api/* when CSRF header matches cookie', async () => {
    const token = newCsrfToken()
    let nextCalled = false
    const res = await onRequest(
      stubReqCtx('POST', '/api/sessions', `mp_csrf=${token}`, token, async () => {
        nextCalled = true
        return new Response('ok')
      }),
    )
    // The middleware proceeds past the CSRF gate to ctx.next(); the tenant
    // path returns a 404 for unknown hosts in this stub, but the gate itself
    // didn't block.
    expect(nextCalled).toBe(true)
    expect(res.status).toBe(200)
  })

  it('exempts /api/auth/logout from CSRF', async () => {
    let nextCalled = false
    const res = await onRequest(
      stubReqCtx('POST', '/api/auth/logout', null, null, async () => {
        nextCalled = true
        return new Response('{}', {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }),
    )
    expect(nextCalled).toBe(true)
    expect(res.status).toBe(200)
  })

  it('exempts /api/auth/request-link from CSRF', async () => {
    let nextCalled = false
    const res = await onRequest(
      stubReqCtx('POST', '/api/auth/request-link', null, null, async () => {
        nextCalled = true
        return new Response('{}', { status: 200 })
      }),
    )
    expect(nextCalled).toBe(true)
    expect(res.status).toBe(200)
  })

  it('does not gate GET requests', async () => {
    let nextCalled = false
    const res = await onRequest(
      stubReqCtx('GET', '/api/sessions', null, null, async () => {
        nextCalled = true
        return new Response('{}')
      }),
    )
    expect(nextCalled).toBe(true)
    expect(res.status).toBe(200)
  })
})
