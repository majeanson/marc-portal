/**
 * Intake submission orchestrator. Wraps the two-step "create session +
 * upload napkin" dance so the Intake page and the post-magic-link finalize
 * in MePortal both go through the same path. Pre-P1.8 this was a single
 * POST that crammed the napkin PNG (data URL) into intake_json; that broke
 * down once busier sketches started bumping the 1 MB intake cap. The PNG
 * now rides as a real R2-backed attachment (kind='napkin', one per session)
 * and only the editable scene + caption + form answers remain inline.
 *
 * Failure shape: a session-create failure throws (caller handles like
 * today). A napkin-upload failure does NOT roll back the session — the
 * intake is the load-bearing part; the napkin is a snapshot of the scene
 * that already lives in intake_json. The orchestrator returns the session
 * + an optional napkin error so the caller can log it and surface a
 * "couldn't save your sketch — retry on the session page" affordance.
 *
 * 409 from the napkin upload is treated as success: the only way to hit
 * that is to re-submit (resume flow), in which case the napkin is already
 * there and we just continue.
 */

import { ApiError } from './api'
import { uploadNapkin } from './attachmentsApi'
import { createSession } from './sessionsApi'
import type { SessionRow } from './sessionsApi'

export interface SubmitIntakeResult {
  session: SessionRow
  /** Present when the session was created but the napkin upload failed.
   *  The session is still usable; the visitor should be offered a retry. */
  napkinUploadError?: string
}

/**
 * Submit an intake payload. If the payload's `napkin.png` is a data URL,
 * the PNG is split out into a separate kind='napkin' attachment upload.
 * The editable scene + caption ride along in `intake_json` (re-openable).
 *
 * Callers pass the same payload shape they used pre-P1.8 — the splitter
 * is hidden here.
 */
export async function submitIntake(intakePayload: unknown): Promise<SubmitIntakeResult> {
  const { payloadSansPng, napkinPng } = splitNapkinPng(intakePayload)

  const { session } = await createSession(payloadSansPng)

  if (!napkinPng) return { session }

  try {
    await uploadNapkin(session.id, napkinPng)
    return { session }
  } catch (err) {
    // 409 = napkin already attached (resumed submit / double-click). Treat
    // as success — the existing upload IS the napkin we wanted.
    if (err instanceof ApiError && err.status === 409) {
      return { session }
    }
    return {
      session,
      napkinUploadError: err instanceof Error ? err.message : 'napkin upload failed',
    }
  }
}

/** Pull `napkin.png` (a data URL) out of the intake payload, returning the
 *  PNG separately and a payload object that no longer carries it. The
 *  editable scene, caption, and savedAt stay in the napkin sub-object so
 *  the session view can re-open the canvas. A payload with no napkin (or
 *  no png field) round-trips unchanged. */
function splitNapkinPng(intakePayload: unknown): {
  payloadSansPng: unknown
  napkinPng: string | null
} {
  if (!intakePayload || typeof intakePayload !== 'object') {
    return { payloadSansPng: intakePayload, napkinPng: null }
  }
  const obj = intakePayload as Record<string, unknown>
  const napkin = obj.napkin
  if (!napkin || typeof napkin !== 'object') {
    return { payloadSansPng: intakePayload, napkinPng: null }
  }
  const nap = napkin as Record<string, unknown>
  const png = typeof nap.png === 'string' ? nap.png : null
  if (!png || !png.startsWith('data:')) {
    // No PNG, or it's already a URL (resumed flow that round-tripped through
    // the server). Nothing to split out.
    return { payloadSansPng: intakePayload, napkinPng: null }
  }
  // Build a new payload where napkin omits `png` — the editable scene and
  // caption stay so the session view can still open the interactive canvas.
  const { png: _droppedPng, ...napkinSansPng } = nap
  return {
    payloadSansPng: { ...obj, napkin: napkinSansPng },
    napkinPng: png,
  }
}
