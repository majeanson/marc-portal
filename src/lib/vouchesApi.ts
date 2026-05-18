/**
 * Frontend bindings for /api/vouches. Mirrors functions/_lib/vouches.ts;
 * if the server schema changes, this file follows.
 *
 * Public surface returns PublicVouch (no email). Admin returns VouchRow
 * with the email; only used in the moderation UI.
 */

import { api } from './api'

export type VouchStatus = 'pending' | 'approved' | 'rejected'

export type VouchRelationship = 'client' | 'colleague' | 'friend' | 'other'

export const VOUCH_RELATIONSHIPS: readonly VouchRelationship[] = [
  'client',
  'colleague',
  'friend',
  'other',
]

/** Mirror of server-side VOUCH_LIMITS — kept in lockstep so client-side
 *  validation shows inline errors before the server 400s. */
export const VOUCH_LIMITS = {
  nameMin: 2,
  nameMax: 80,
  emailMax: 254,
  bodyMin: 30,
  bodyMax: 600,
  linkUrlMax: 200,
} as const

/** Server's PublicVouchRow — what /api/public/vouches returns. No email. */
export interface PublicVouch {
  id: string
  author_name: string
  author_relationship: string
  body: string
  link_url: string | null
  session_id: string | null
  created_at: number
}

/** Admin-side row — includes email + moderation columns. */
export interface AdminVouch extends PublicVouch {
  author_email: string
  status: VouchStatus
  approved_at: number | null
  deleted_at: number | null
}

export interface SubmitVouchInput {
  authorName: string
  authorEmail: string
  relationship: VouchRelationship
  body: string
  linkUrl?: string
  sessionId?: string
}

export function submitVouch(input: SubmitVouchInput): Promise<{ id: string; status: 'pending' }> {
  return api('/api/vouches', { method: 'POST', body: input })
}

export function listPublicVouches(opts: { sessionId?: string } = {}): Promise<{
  vouches: PublicVouch[]
}> {
  const qs = opts.sessionId ? `?sessionId=${encodeURIComponent(opts.sessionId)}` : ''
  return api(`/api/public/vouches${qs}`)
}

export function listAdminVouches(opts: { status?: VouchStatus } = {}): Promise<{
  vouches: AdminVouch[]
}> {
  const qs = opts.status ? `?status=${encodeURIComponent(opts.status)}` : ''
  return api(`/api/admin/vouches${qs}`)
}

export interface AdminPatchInput {
  status?: VouchStatus
  authorName?: string
  authorRelationship?: VouchRelationship
  body?: string
  linkUrl?: string | null
  undelete?: boolean
}

export function patchAdminVouch(
  id: string,
  input: AdminPatchInput,
): Promise<{ vouch: AdminVouch }> {
  return api(`/api/admin/vouches/${encodeURIComponent(id)}`, { method: 'PATCH', body: input })
}

export function deleteAdminVouch(id: string): Promise<{ ok: true }> {
  return api(`/api/admin/vouches/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export type AdminVouchSection = 'pending' | 'approved' | 'rejected' | 'trash'

/**
 * Group a flat AdminVouch list into the four moderation buckets used by
 * /admin/vouches. A soft-deleted row goes to `trash` regardless of its
 * `status` value — the operator sees it under Trash, not under whatever
 * status it had when deleted. Status `pending` rows are surfaced first
 * because that's the active queue.
 */
export function partitionAdminVouches(all: AdminVouch[]): Record<AdminVouchSection, AdminVouch[]> {
  const pending: AdminVouch[] = []
  const approved: AdminVouch[] = []
  const rejected: AdminVouch[] = []
  const trash: AdminVouch[] = []
  for (const v of all) {
    if (v.deleted_at) trash.push(v)
    else if (v.status === 'pending') pending.push(v)
    else if (v.status === 'approved') approved.push(v)
    else if (v.status === 'rejected') rejected.push(v)
  }
  return { pending, approved, rejected, trash }
}
