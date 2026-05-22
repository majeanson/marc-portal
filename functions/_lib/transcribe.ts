// Edge speech-to-text. Wraps Cloudflare Workers AI (Whisper) so a voice note
// recorded in the intake form or a session thread becomes text.
//
// Why "at the edge" is load-bearing: a voice recording is sensitive personal
// information. Whisper runs *inside* Cloudflare's network — the same vendor
// already hosting Pages, D1 and R2 — so the audio never reaches a separate
// third-party processor. That keeps the practice's Loi 25 posture intact
// without adding a new cross-border processor to the PIA (see
// docs/loi-25-pia.md). It is a deliberate architecture choice, not an
// incidental one.
//
// Graceful degrade: when the AI binding is absent (dev, or a deployment that
// hasn't enabled Workers AI) every function here returns null. Callers store a
// null transcript and keep the audio — nothing user-facing breaks, exactly
// like the MEDIA (R2) binding being optional.

import type { Env } from './env'

// Whisper large-v3-turbo. Chosen over the base `@cf/openai/whisper` because
// this is a bilingual practice and a fair share of the audio is Québécois
// French — large-v3 is markedly better than base Whisper on accented and
// dialectal speech, which is exactly where transcripts otherwise garble. The
// language is left to auto-detect (no `language` param) so a fr/en clip is
// handled without the caller having to know which it is. Cost is 46.63
// neurons/audio-minute vs 41.14 for base — negligible at this portal's volume.
const WHISPER_MODEL = '@cf/openai/whisper-large-v3-turbo'

// large-v3-turbo takes the audio as a base64 string (the base model took a raw
// number array). Encode in fixed chunks: `String.fromCharCode(...bytes)` on a
// whole multi-MB clip would blow the argument-count limit.
function toBase64(audio: ArrayBuffer): string {
  const bytes = new Uint8Array(audio)
  let binary = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}

/** Upper bound on transcript length we persist. Whisper on a 2-minute clip
 *  lands far under this; the cap is a defensive ceiling on a runaway result
 *  so a single row can't bloat D1. */
export const MAX_TRANSCRIPT_LEN = 8000

/**
 * Transcribe an audio buffer to text. Returns the trimmed transcript, or null
 * when the AI binding is missing, Whisper throws, or the result is empty.
 * Never throws — transcription is best-effort enrichment, never a hard
 * dependency of the upload it rides on.
 */
export async function transcribeAudio(env: Env, audio: ArrayBuffer): Promise<string | null> {
  if (!env.AI) return null
  try {
    // large-v3-turbo expects base64-encoded audio.
    const res = (await env.AI.run(WHISPER_MODEL, {
      audio: toBase64(audio),
    })) as { text?: unknown }
    const text = typeof res.text === 'string' ? res.text.trim() : ''
    if (!text) return null
    return text.length > MAX_TRANSCRIPT_LEN ? text.slice(0, MAX_TRANSCRIPT_LEN - 1) + '…' : text
  } catch (err) {
    console.error('transcribe: whisper failed', err)
    return null
  }
}
