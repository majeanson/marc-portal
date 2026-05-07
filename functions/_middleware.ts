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

import { resolveTenant, type Tenant } from './_lib/tenant'

interface Env {
  DB: D1Database
  ADMIN_EMAILS?: string
  SESSION_SECRET?: string
  RESEND_API_KEY?: string
}

// Augment the Pages Functions context with our tenant data so handlers can
// `const tenant = ctx.data.tenant` with full typing.
declare global {
  interface PagesContextData {
    tenant?: Tenant
  }
}

export const onRequest: PagesFunction<Env> = async (ctx) => {
  const url = new URL(ctx.request.url)
  const host = url.host.toLowerCase()

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
  return ctx.next()
}
