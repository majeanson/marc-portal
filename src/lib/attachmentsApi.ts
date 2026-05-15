/**
 * Attachment uploads are multipart/form-data; everything else is JSON. Both
 * go through the shared `api()` wrapper now so the CSRF header attachment
 * stays in one place (the wrapper reads the mp_csrf cookie and echoes it).
 */

import { api } from './api'
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
  return api(`/api/sessions/${encodeURIComponent(sessionId)}/attachments`, {
    method: 'POST',
    formData: form,
  })
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
