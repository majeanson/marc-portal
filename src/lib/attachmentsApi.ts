/**
 * Attachment uploads are multipart/form-data; everything else is JSON. Both
 * go through the shared `api()` wrapper now so the CSRF header attachment
 * stays in one place (the wrapper reads the mp_csrf cookie and echoes it).
 */

import { api } from './api'
import type { AttachmentKind, AttachmentRow } from './sessionsApi'

export type { AttachmentKind, AttachmentRow }

/** Excalidraw's vendor MIME — mirrors EXCALIDRAW_CONTENT_TYPE on the server. */
export const EXCALIDRAW_CONTENT_TYPE = 'application/vnd.excalidraw+json'

function uploadForm(sessionId: string, form: FormData): Promise<{ attachment: AttachmentRow }> {
  return api(`/api/sessions/${encodeURIComponent(sessionId)}/attachments`, {
    method: 'POST',
    formData: form,
  })
}

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
  return uploadForm(sessionId, form)
}

/**
 * Upload a recorded voice note. The server transcribes it at the edge
 * (Whisper) and the returned row carries `kind: 'voice'` + a transcript.
 */
export async function uploadVoice(
  sessionId: string,
  blob: Blob,
): Promise<{ attachment: AttachmentRow }> {
  // Name the file by container so a download has a sensible extension.
  const ext = blob.type.includes('ogg') ? 'ogg' : blob.type.includes('mp4') ? 'm4a' : 'webm'
  const form = new FormData()
  form.append('file', new File([blob], `voice-note.${ext}`, { type: blob.type }))
  return uploadForm(sessionId, form)
}

/**
 * Upload an Excalidraw sketch. The scene (an `{ elements }` object) is stored
 * as JSON; the returned row carries `kind: 'sketch'` and the thread re-opens
 * it on the canvas.
 */
export async function uploadSketch(
  sessionId: string,
  scene: { elements: unknown[] },
): Promise<{ attachment: AttachmentRow }> {
  const json = JSON.stringify({ elements: scene.elements })
  const form = new FormData()
  form.append('file', new File([json], 'sketch.excalidraw', { type: EXCALIDRAW_CONTENT_TYPE }))
  return uploadForm(sessionId, form)
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
