/**
 * Attachment uploads use multipart/form-data, so they bypass the JSON-only
 * `api()` wrapper. Otherwise the contract is the same: same-origin, cookies
 * included, ApiError on non-2xx.
 */

import { api, ApiError } from './api'
import type { AttachmentRow } from './sessionsApi'

export type { AttachmentRow }

/**
 * Upload a single file. Returns the saved row. The file lives in R2; the
 * row is unlinked (message_id=null) until referenced by postMessage().
 */
export async function uploadAttachment(
  sessionId: string,
  file: File,
): Promise<{ attachment: AttachmentRow }> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/attachments`, {
    method: 'POST',
    credentials: 'same-origin',
    body: form,
  })
  let data: unknown = null
  try {
    data = await res.json()
  } catch {
    // empty/non-JSON body
  }
  if (!res.ok) {
    const message =
      data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
        ? data.error
        : `upload failed: ${res.status}`
    throw new ApiError(res.status, message)
  }
  return data as { attachment: AttachmentRow }
}

/** Pre-message uploads I made on this session, that haven't been linked yet. */
export function listPendingAttachments(sessionId: string): Promise<{
  attachments: AttachmentRow[]
}> {
  return api(`/api/sessions/${encodeURIComponent(sessionId)}/attachments`)
}

export function deleteAttachment(sessionId: string, attachmentId: string): Promise<{ ok: true }> {
  return api(
    `/api/sessions/${encodeURIComponent(sessionId)}/attachments/${encodeURIComponent(
      attachmentId,
    )}`,
    { method: 'DELETE' },
  )
}

/** Direct URL to the attachment for `<img>` / `<a download>`. Same-origin. */
export function attachmentUrl(sessionId: string, attachmentId: string): string {
  return `/api/sessions/${encodeURIComponent(sessionId)}/attachments/${encodeURIComponent(
    attachmentId,
  )}`
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
