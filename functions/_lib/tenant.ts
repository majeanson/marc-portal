// feat-fleet-foundation
// Tenant resolution + types for the multi-tenant edge middleware.
// Marc's existing data is tenant 't_marc'. Buyer tenants get their own ids
// generated at provision time. Theme/flags travel as opaque JSON strings in
// D1 and are parsed in TypeScript with zod-free hand-rolled guards (the data
// is small and the surface is internal — no schema lib worth the bytes).

export type TenantStatus = 'pending' | 'active' | 'frozen'

/**
 * Theme tokens applied as inline CSS custom properties. Every key is the
 * exact CSS variable name (sans the leading `--`), so adding a new theme-able
 * property in the design system never requires a schema migration. Keys are
 * optional — old tenants without a key fall back to the styles.css default.
 *
 * Mapping examples (see src/styles.css :root for the full set):
 *   accent      → --accent       (primary brand color)
 *   accentDeep  → --accent-warm  (hover / heading on accent)
 *   paper       → --bg           (page background)
 *   paperWarm   → --bg-card      (card surface)
 *   ink         → --text         (body text)
 *   display     → --display      (headline font family)
 *   sans        → --sans         (body font family)
 *   radius      → --radius       (default rounded corner)
 *   logoUrl     → not a CSS var; rendered as <img> in the masthead
 *   displayName → not a CSS var; the buyer's app name in the chrome
 *   footer      → not a CSS var; the buyer's footer line
 */
export interface ThemeJSON {
  accent?: string
  accentDeep?: string
  accentSoft?: string
  paper?: string
  paperWarm?: string
  paperSoft?: string
  paperDeep?: string
  ink?: string
  inkSoft?: string
  warm?: string
  cool?: string
  display?: string
  sans?: string
  radius?: string
  logoUrl?: string
  displayName?: string
  footer?: string
}

export interface TenantFlags {
  /** True for tenants whose owner is an operator (sees /admin/fleet). */
  isOperator?: boolean
  /** True if the tenant's app should render in maintenance mode. */
  maintenance?: boolean
  /** Per-template feature flags — opaque to the platform. */
  [key: string]: unknown
}

export interface Tenant {
  id: string
  slug: string
  ownerEmail: string
  templateId: string
  templateVersion: string
  theme: ThemeJSON
  flags: TenantFlags
  status: TenantStatus
  createdAt: number
  frozenAt: number | null
}

interface TenantRow {
  id: string
  slug: string
  owner_email: string
  template_id: string
  template_version: string
  theme: string
  flags: string
  status: TenantStatus
  created_at: number
  frozen_at: number | null
}

function parseJsonOr<T>(s: string, fallback: T): T {
  try {
    const parsed = JSON.parse(s)
    return (parsed && typeof parsed === 'object' ? parsed : fallback) as T
  } catch {
    return fallback
  }
}

function rowToTenant(row: TenantRow): Tenant {
  return {
    id: row.id,
    slug: row.slug,
    ownerEmail: row.owner_email,
    templateId: row.template_id,
    templateVersion: row.template_version,
    theme: parseJsonOr<ThemeJSON>(row.theme, {}),
    flags: parseJsonOr<TenantFlags>(row.flags, {}),
    status: row.status,
    createdAt: row.created_at,
    frozenAt: row.frozen_at,
  }
}

/**
 * Resolve a Host header (e.g. "roger-voice-truck.com" or "localhost:5173")
 * to a Tenant. Returns null when the host is not registered.
 *
 * Hosts are case-insensitive; we lowercased on insert and lowercase on lookup.
 * Port is part of the key for localhost (so dev :5173 and prod 443 don't collide
 * across an accidental local CF tunnel).
 */
export async function resolveTenant(db: D1Database, host: string): Promise<Tenant | null> {
  const normalized = host.trim().toLowerCase()
  if (!normalized) return null

  const row = await db
    .prepare(
      `SELECT t.*
         FROM tenants t
         JOIN tenant_domains d ON d.tenant_id = t.id
        WHERE d.domain = ?
        LIMIT 1`,
    )
    .bind(normalized)
    .first<TenantRow>()

  if (!row) return null
  return rowToTenant(row)
}

/**
 * Look up a tenant by its slug. Used by the operator console and admin tooling.
 */
export async function tenantBySlug(db: D1Database, slug: string): Promise<Tenant | null> {
  const row = await db
    .prepare('SELECT * FROM tenants WHERE slug = ? LIMIT 1')
    .bind(slug.trim().toLowerCase())
    .first<TenantRow>()
  if (!row) return null
  return rowToTenant(row)
}

/**
 * Look up a tenant by id. Cheap, indexed.
 */
export async function tenantById(db: D1Database, id: string): Promise<Tenant | null> {
  const row = await db
    .prepare('SELECT * FROM tenants WHERE id = ? LIMIT 1')
    .bind(id)
    .first<TenantRow>()
  if (!row) return null
  return rowToTenant(row)
}

/**
 * Pull the current request's tenant from the Pages Functions context. The
 * middleware (functions/_middleware.ts) guarantees this is set when a handler
 * runs — a missing tenant is a programmer error (handler ran without the
 * middleware), and we fail loudly with a 500 rather than a tenant-scope leak.
 */
export function requireTenant(ctx: { data: PagesContextData }): Tenant {
  const t = ctx.data.tenant
  if (!t) {
    throw new TenantUnresolvedError(
      'No tenant on context — _middleware.ts must run before this handler.',
    )
  }
  return t
}

export class TenantUnresolvedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TenantUnresolvedError'
  }
}

/**
 * Render a Tenant's theme as a CSS-custom-properties block, with each declared
 * key emitted as `--<kebab-key>: <escaped-value>;`. Caller wraps in a <style>
 * tag and inserts in the document head. Values are escaped to prevent style
 * tag breakout (e.g. a malicious value containing `</style><script>...`).
 */
export function themeToCssVars(theme: ThemeJSON): string {
  const cssKeys: Array<[keyof ThemeJSON, string]> = [
    ['accent', '--accent'],
    ['accentDeep', '--accent-warm'],
    ['accentSoft', '--accent-soft'],
    ['paper', '--bg'],
    ['paperWarm', '--bg-card'],
    ['paperSoft', '--bg-section'],
    ['paperDeep', '--bg-hover'],
    ['ink', '--text'],
    ['inkSoft', '--text-mid'],
    ['warm', '--warm'],
    ['cool', '--cool'],
    ['display', '--display'],
    ['sans', '--sans'],
    ['radius', '--radius'],
  ]
  const decls: string[] = []
  for (const [jsKey, cssVar] of cssKeys) {
    const value = theme[jsKey]
    if (typeof value !== 'string') continue
    const safe = sanitizeCssValue(value)
    if (!safe) continue
    decls.push(`${cssVar}:${safe}`)
  }
  return decls.join(';')
}

/**
 * Reject any value containing `<`, `>`, `</style`, newlines, or backslashes.
 * Theme values are user-controlled and travel into a <style> tag, so we treat
 * them as untrusted. Color hex, rgb(), font names, lengths — all valid; HTML
 * fragments — never.
 */
function sanitizeCssValue(raw: string): string | null {
  if (raw.length > 200) return null
  if (/[<>\\\n\r]/.test(raw)) return null
  if (/expression\s*\(/i.test(raw)) return null
  if (/url\s*\(/i.test(raw)) return null // images go through logoUrl, not a CSS var
  return raw.trim()
}
