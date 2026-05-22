// POST /api/intake/transcribe — transcribe a short voice note recorded in the
// intake form, multipart/form-data under field name "file".
//
// Session-less by necessity: no session row exists until the intake is
// submitted. Unauthenticated by necessity too — the intake is open to
// anonymous visitors, who never receive an mp_csrf cookie (so this path is on
// the middleware's CSRF-exempt list, like /api/vouches).
//
// Abuse is bounded by a per-IP rate limit. The audio is transcribed and
// immediately discarded — nothing is written to R2 or D1. Only the transcript
// travels back in the response; the client folds it into the intake payload.
// That "transcribe and discard" shape is the smallest possible Loi 25
// footprint for the intake: no stored recording, no retention question.

import type { Env } from '../../_lib/env'
import {
  badRequest,
  ok,
  payloadTooLarge,
  serverError,
  serviceUnavailable,
  tooManyRequests,
  unsupportedMediaType,
} from '../../_lib/json'
import { clientIp, rateLimitCheck, rateLimitSweep } from '../../_lib/ratelimit'
import {
  attachmentKind,
  isAllowedContentType,
  MAX_VOICE_SIZE,
  verifyMagicBytesBuffer,
} from '../../_lib/attachments'
import { transcribeAudio } from '../../_lib/transcribe'

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.AI) {
    return serviceUnavailable('voice transcription is not enabled on this deployment')
  }

  // Per-IP throttle. 12/hour comfortably covers a visitor re-recording a few
  // times while drafting an intake; tight enough that the endpoint can't be
  // turned into free transcription compute.
  const ip = clientIp(request)
  const allowed = await rateLimitCheck(env, `intake:transcribe:ip:${ip}`, 12, 3600)
  if (!allowed) return tooManyRequests('too many transcription requests — try again later')
  await rateLimitSweep(env)

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return badRequest('expected multipart/form-data')
  }
  const raw = form.get('file')
  if (
    !raw ||
    typeof raw === 'string' ||
    typeof (raw as { stream?: unknown }).stream !== 'function'
  ) {
    return badRequest('missing "file" field')
  }
  const file = raw as { name: string; type: string; size: number; stream: () => ReadableStream }

  if (file.size === 0) return badRequest('empty file')
  if (file.size > MAX_VOICE_SIZE) {
    return payloadTooLarge(
      `recording exceeds the ${Math.round(MAX_VOICE_SIZE / 1024 / 1024)} MB limit`,
    )
  }
  if (!isAllowedContentType(file.type) || attachmentKind(file.type) !== 'voice') {
    return unsupportedMediaType('expected an audio recording')
  }

  const buffer = await new Response(file.stream()).arrayBuffer()
  if (!verifyMagicBytesBuffer(file.type, new Uint8Array(buffer))) {
    return unsupportedMediaType('file contents do not match declared type')
  }

  const transcript = await transcribeAudio(env, buffer)
  if (transcript == null) {
    // AI binding present but Whisper produced nothing usable (or threw).
    // 500 — the client falls back to letting the visitor type instead.
    return serverError('transcription produced no text')
  }
  return ok({ transcript })
}
