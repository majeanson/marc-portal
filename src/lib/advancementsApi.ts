/**
 * Frontend bindings for the session advancements API. Mirrors
 * functions/api/sessions/[id]/advancements/*. Source of truth for the schema
 * is the functions side; this file follows.
 *
 * An "advancement" is an admin-posted record of build/demo progress on a
 * session — the SND-style cadence ("rev 1 demo shipped → rev 2 → ...") with
 * each entry pinned to a Cloudflare Pages deployment URL the visitor can
 * iframe to time-travel through builds.
 */

import { api } from './api'

export interface AdvancementFlags {
  allowedForPublic?: boolean
  showInConversation?: boolean
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
  /** Server-parsed convenience copy of flags_json. */
  flags: AdvancementFlags
  created_at: number
  updated_at: number
}

export function listAdvancements(
  sessionId: string,
): Promise<{ advancements: AdvancementRow[] }> {
  return api(`/api/sessions/${encodeURIComponent(sessionId)}/advancements`)
}

export interface CreateAdvancementInput {
  label: string
  body?: string
  date?: number
  iframePath?: string | null
  flags?: AdvancementFlags
  /** Optional pre-fill — for advancements pointing at external deploys
   * (e.g. a sibling repo on its own Cloudflare project). When set, the
   * auto-stamp pipeline skips this row. */
  buildUrl?: string | null
  commitSha?: string | null
}

export function createAdvancement(
  sessionId: string,
  input: CreateAdvancementInput,
): Promise<{ advancement: AdvancementRow }> {
  return api(`/api/sessions/${encodeURIComponent(sessionId)}/advancements`, {
    method: 'POST',
    body: input,
  })
}

export interface PatchAdvancementInput {
  label?: string
  body?: string
  date?: number
  iframePath?: string | null
  flags?: AdvancementFlags
  buildUrl?: string | null
  commitSha?: string | null
}

export function patchAdvancement(
  sessionId: string,
  advId: string,
  patch: PatchAdvancementInput,
): Promise<{ advancement: AdvancementRow }> {
  return api(
    `/api/sessions/${encodeURIComponent(sessionId)}/advancements/${encodeURIComponent(advId)}`,
    { method: 'PATCH', body: patch },
  )
}

export function deleteAdvancement(
  sessionId: string,
  advId: string,
): Promise<{ ok: true }> {
  return api(
    `/api/sessions/${encodeURIComponent(sessionId)}/advancements/${encodeURIComponent(advId)}`,
    { method: 'DELETE' },
  )
}

/**
 * Public-facing slimmed-down shape — returned by the unauth share endpoint.
 * No author email, no flags_json blob; only what the share view needs.
 */
export interface PublicAdvancementRow {
  id: string
  session_id: string
  date: number
  label: string
  body: string
  build_url: string | null
  commit_sha: string | null
  iframe_path: string | null
}

export function listPublicAdvancements(
  sessionId: string,
): Promise<{ advancements: PublicAdvancementRow[] }> {
  return api(
    `/api/public/sessions/${encodeURIComponent(sessionId)}/advancements`,
  )
}
