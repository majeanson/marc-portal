/**
 * Intake-side voice transcription. The intake form has no session yet, so a
 * voice note can't be a stored attachment — instead it's transcribed at the
 * edge and discarded, and only the text joins the intake payload.
 *
 * See functions/api/intake/transcribe.ts (session-less, CSRF-exempt,
 * IP-rate-limited; the audio is never persisted).
 */

import { api } from './api'

/** A voice note folded into the intake payload — text only, no audio. */
export interface VoiceNapkin {
  /** The edge-transcribed text. The visitor can edit it before submitting. */
  transcript: string
  /** ISO timestamp of when it was recorded. */
  savedAt: string
}

/**
 * Transcribe a recorded intake voice note. The blob is sent to the edge,
 * transcribed with Whisper, and discarded server-side; only the text returns.
 */
export async function transcribeIntakeVoice(blob: Blob): Promise<{ transcript: string }> {
  const ext = blob.type.includes('ogg') ? 'ogg' : blob.type.includes('mp4') ? 'm4a' : 'webm'
  const form = new FormData()
  form.append('file', new File([blob], `intake-voice.${ext}`, { type: blob.type }))
  return api('/api/intake/transcribe', { method: 'POST', formData: form })
}
