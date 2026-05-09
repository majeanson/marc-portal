// Session advancement domain logic. An "advancement" is an admin-posted
// record of build/demo progress on an engagement session — mirrors the
// feature.json revisions[] pattern (commit + buildUrl, auto-stamped by CI)
// but lives in D1 against a session_id.
//
// The visibility flags are intentionally JSON-blob (not separate columns) so
// we can grow the set without another migration. Today: allowedForPublic,
// showInConversation, showAsCurrentBuild. Future flags slot into the same
// shape.

import { randomTokenB64url } from './bytes'

export interface AdvancementFlags {
  /** Non-owner non-admin visitors may see this entry. Off by default. */
  allowedForPublic?: boolean
  /** Render inline in the message thread (future-use; for now informational). */
  showInConversation?: boolean
  /** Pin as the headline "current demo" entry in the renderer. */
  showAsCurrentBuild?: boolean
}

export interface AdvancementRow {
  id: string
  session_id: string
  date: number
  author: string
  label: string
  body: string
  build_url: string | null
  commit_sha: string | null
  iframe_path: string | null
  flags_json: string
  created_at: number
  updated_at: number
}

/** Max lengths — keep DB rows tame and cap the admin form. */
export const MAX_LABEL_LEN = 200
export const MAX_BODY_LEN = 8000
export const MAX_IFRAME_PATH_LEN = 500

export function newAdvancementId(): string {
  return randomTokenB64url(12)
}

export function parseFlags(raw: string | null | undefined): AdvancementFlags {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const out: AdvancementFlags = {}
      const obj = parsed as Record<string, unknown>
      if (typeof obj.allowedForPublic === 'boolean') out.allowedForPublic = obj.allowedForPublic
      if (typeof obj.showInConversation === 'boolean')
        out.showInConversation = obj.showInConversation
      if (typeof obj.showAsCurrentBuild === 'boolean')
        out.showAsCurrentBuild = obj.showAsCurrentBuild
      return out
    }
  } catch {
    // fall through
  }
  return {}
}

export function stringifyFlags(flags: AdvancementFlags): string {
  // Drop falsy keys so the stored blob stays tight and parseable.
  const trimmed: AdvancementFlags = {}
  if (flags.allowedForPublic) trimmed.allowedForPublic = true
  if (flags.showInConversation) trimmed.showInConversation = true
  if (flags.showAsCurrentBuild) trimmed.showAsCurrentBuild = true
  return JSON.stringify(trimmed)
}

/** Validate + normalize a label. Returns trimmed string or null if invalid. */
export function normalizeLabel(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const v = input.trim()
  if (!v) return null
  if (v.length > MAX_LABEL_LEN) return null
  return v
}

export function normalizeBody(input: unknown): string {
  if (typeof input !== 'string') return ''
  return input.trim().slice(0, MAX_BODY_LEN)
}

export function normalizeIframePath(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const v = input.trim()
  if (!v) return null
  if (v.length > MAX_IFRAME_PATH_LEN) return null
  // Must start with a single '/' — paths are appended to a build URL origin,
  // never absolute. Reject protocol-relative ('//...') and absolute URLs;
  // the renderer concatenates raw, so an unsafe input could escape the
  // build_url origin in the iframe src.
  if (!v.startsWith('/')) return null
  if (v.startsWith('//')) return null
  if (v.includes('://')) return null
  return v
}

/**
 * Visitor-facing filter. Owners and admins see everything live; everyone else
 * sees only entries flagged allowedForPublic. Soft-deleted sessions do not
 * leak advancements either way (caller handles that).
 */
export function canSeeAdvancement(flags: AdvancementFlags, viewerIsOwnerOrAdmin: boolean): boolean {
  if (viewerIsOwnerOrAdmin) return true
  return flags.allowedForPublic === true
}

export async function listAdvancementsForSession(
  db: D1Database,
  sessionId: string,
): Promise<AdvancementRow[]> {
  const res = await db
    .prepare(
      `SELECT id, session_id, date, author, label, body, build_url, commit_sha,
              iframe_path, flags_json, created_at, updated_at
       FROM session_advancements
       WHERE session_id = ?
       ORDER BY date DESC, created_at DESC`,
    )
    .bind(sessionId)
    .all<AdvancementRow>()
  return res.results ?? []
}

export async function loadAdvancement(db: D1Database, id: string): Promise<AdvancementRow | null> {
  return db
    .prepare(
      `SELECT id, session_id, date, author, label, body, build_url, commit_sha,
              iframe_path, flags_json, created_at, updated_at
       FROM session_advancements WHERE id = ?`,
    )
    .bind(id)
    .first<AdvancementRow>()
}
