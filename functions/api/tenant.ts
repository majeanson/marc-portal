// feat-fleet-foundation
// GET /api/tenant — returns the tenant resolved from the request Host header.
// The SPA fetches this on mount and uses the response to:
//   - set the document title / display name
//   - inject the theme tokens as CSS custom properties
//   - know the operator vs buyer role of the signed-in user
//
// This is the only endpoint a buyer's app needs to know its identity. Every
// other handler can pull ctx.data.tenant directly from the middleware.

import type { Tenant } from '../_lib/tenant'

interface Env {
  DB: D1Database
  ADMIN_EMAILS?: string
}

export interface TenantPublic {
  /** Stable identifier, used for cache keys / debug. Not secret. */
  id: string
  slug: string
  templateId: string
  templateVersion: string
  /** Display name shown in the chrome — defaults to a humanized slug. */
  displayName: string
  /** Footer line. Defaults to "© <year> <displayName>". */
  footer: string
  /** Optional logo URL (absolute or origin-relative). */
  logoUrl: string | null
  /** Theme tokens — empty object means use the design-system defaults. */
  theme: Record<string, string>
  /** True if the buyer's app is in maintenance mode. */
  maintenance: boolean
}

function humanizeSlug(slug: string): string {
  return slug
    .split('-')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ')
}

function tenantToPublic(t: Tenant): TenantPublic {
  const display = t.theme.displayName || humanizeSlug(t.slug)
  const year = new Date().getFullYear()
  return {
    id: t.id,
    slug: t.slug,
    templateId: t.templateId,
    templateVersion: t.templateVersion,
    displayName: display,
    footer: t.theme.footer || `© ${year} ${display}`,
    logoUrl: t.theme.logoUrl ?? null,
    theme: filterStringTokens(t.theme),
    maintenance: t.flags.maintenance === true,
  }
}

function filterStringTokens(theme: Tenant['theme']): Record<string, string> {
  const out: Record<string, string> = {}
  // Allowlist: every key that is a CSS-token (not displayName / logoUrl / footer).
  const cssKeys: Array<keyof Tenant['theme']> = [
    'accent',
    'accentDeep',
    'accentSoft',
    'paper',
    'paperWarm',
    'paperSoft',
    'paperDeep',
    'ink',
    'inkSoft',
    'warm',
    'cool',
    'display',
    'sans',
    'radius',
  ]
  for (const k of cssKeys) {
    const v = theme[k]
    if (typeof v === 'string' && v.length > 0) out[k as string] = v
  }
  return out
}

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const tenant = (ctx.data as PagesContextData).tenant
  if (!tenant) {
    // Should be unreachable when the middleware is in place — but leave a
    // sensible 503 in case a future deploy ships handlers without the
    // middleware enabled.
    return new Response(JSON.stringify({ error: 'tenant-unresolved' }), {
      status: 503,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    })
  }
  return new Response(JSON.stringify(tenantToPublic(tenant)), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'private, max-age=30',
    },
  })
}
