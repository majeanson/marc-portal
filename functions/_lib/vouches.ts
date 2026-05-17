// Vouches — shared types, validation, and SELECT projections.
//
// Schema mirrors functions/db/migrations/0017_vouches.sql. Two row
// shapes: VouchRow (full, includes email; admin-side) and PublicVouchRow
// (no email; what the public endpoint returns). Keeping these distinct
// at the type level makes it impossible to accidentally leak the email
// in a public projection — the compiler refuses the assignment.

export type VouchStatus = 'pending' | 'approved' | 'rejected'

export type VouchRelationship = 'client' | 'colleague' | 'friend' | 'other'

export const VOUCH_RELATIONSHIPS: ReadonlySet<VouchRelationship> = new Set([
  'client',
  'colleague',
  'friend',
  'other',
])

export const VOUCH_STATUSES: ReadonlySet<VouchStatus> = new Set(['pending', 'approved', 'rejected'])

/** Hard limits — match the validator in functions/api/vouches.ts. The
 *  client-side form should mirror these so the visitor sees errors
 *  inline rather than via a 400. */
export const VOUCH_LIMITS = {
  nameMin: 2,
  nameMax: 80,
  emailMax: 254, // RFC 5321 cap
  bodyMin: 30,
  bodyMax: 600,
  linkUrlMax: 200,
} as const

export interface VouchRow {
  id: string
  author_name: string
  author_email: string
  author_relationship: string
  body: string
  link_url: string | null
  session_id: string | null
  status: VouchStatus
  created_at: number
  approved_at: number | null
  deleted_at: number | null
}

/** Public projection — exactly what /api/public/vouches returns. The
 *  email is intentionally absent at the type level so the compiler
 *  refuses any leak. */
export interface PublicVouchRow {
  id: string
  author_name: string
  author_relationship: string
  body: string
  link_url: string | null
  session_id: string | null
  created_at: number
}

/** Validate the relationship enum at the boundary. */
export function isValidRelationship(s: unknown): s is VouchRelationship {
  return typeof s === 'string' && VOUCH_RELATIONSHIPS.has(s as VouchRelationship)
}

/** Validate the optional link URL. Returns the trimmed URL if valid,
 *  null if absent, and false if present-but-invalid (caller 400s). */
export function validateLinkUrl(s: unknown): string | null | false {
  if (s === undefined || s === null || s === '') return null
  if (typeof s !== 'string') return false
  const trimmed = s.trim()
  if (trimmed.length === 0) return null
  if (trimmed.length > VOUCH_LIMITS.linkUrlMax) return false
  // Only http/https — no javascript:, no data:, no relative paths that
  // could host-confuse on render.
  try {
    const u = new URL(trimmed)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
    return trimmed
  } catch {
    return false
  }
}

/** Drop the email from a full row before serializing for the public
 *  endpoint. Centralized here so every public path uses the same
 *  projection — easy to audit. */
export function toPublicVouchRow(row: VouchRow): PublicVouchRow {
  return {
    id: row.id,
    author_name: row.author_name,
    author_relationship: row.author_relationship,
    body: row.body,
    link_url: row.link_url,
    session_id: row.session_id,
    created_at: row.created_at,
  }
}
