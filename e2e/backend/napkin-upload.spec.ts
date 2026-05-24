// Napkin upload happy path (AUDIT P1.8) — proves the new `?kind=napkin`
// branch on POST /api/sessions/:id/attachments lands a real attachments
// row + R2 object via the live wrangler runtime, and that the session
// SELECT's correlated subquery surfaces napkin_attachment_id on the next
// /api/sessions read.
//
// What's stubbed and what's real:
//   - Pages Function code paths: REAL (attachments handler, magic-byte
//     verifier, R2 PUT via Miniflare's local R2 emulator, session SELECT
//     with the napkin_attachment_id subquery).
//   - R2 storage: REAL (Miniflare-local, ephemeral under .wrangler-e2e/).
//   - Auth: forged cookie via forgeAuthHeaders — the server verifies it
//     against the same SESSION_SECRET it was signed with.
//
// What this spec does NOT cover (deferred):
//   - Full intake → session → napkin browser flow (Excalidraw lazy chunk
//     in a real browser). The unit test on submitIntake covers the
//     orchestrator's payload-split + failure shape; this spec covers the
//     server's acceptance shape.

import { test, expect } from '@playwright/test'
import { randomBytes } from 'node:crypto'
import { E2E_BASE_URL } from './constants'
import { clearTestRows, seedSession } from './helpers/db'
import { forgeAuthHeaders } from './helpers/auth'

const VISITOR_EMAIL = 'visitor@e2e.test'

// Minimal valid PNG bytes. The first 8 are the PNG magic signature that
// functions/_lib/attachments.ts:verifyMagicBytes checks on stream entry.
// The trailing bytes are minimal IHDR padding so the file isn't suspiciously
// short — workerd doesn't care, but a paranoid R2 client might.
const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00,
])

const PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34])

/** Build a multipart/form-data body with a single `file` field. Browsers'
 *  fetch handles this transparently; node:fetch needs the explicit File. */
function napkinForm(bytes: Uint8Array, contentType: string, filename: string): FormData {
  const form = new FormData()
  // node 18+ provides File globally; cast through Blob to keep TS happy.
  const blob = new Blob([bytes], { type: contentType })
  form.append('file', blob, filename)
  return form
}

/** Like forgeAuthHeaders but strips Content-Type — fetch sets the multipart
 *  boundary automatically when body is a FormData. */
function multipartHeaders(email: string): Record<string, string> {
  const headers = forgeAuthHeaders(email) as Record<string, string>
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === 'content-type') continue
    out[k] = v
  }
  return out
}

test.describe('napkin upload — ?kind=napkin branch', () => {
  test.beforeEach(() => {
    clearTestRows()
  })

  test('happy path: PNG upload lands as kind=napkin and surfaces on session GET', async () => {
    const sessionId = `sess_napkin_${randomBytes(6).toString('hex')}`
    seedSession({ id: sessionId, email: VISITOR_EMAIL, tier: 1, status: 'active' })

    const r = await fetch(`${E2E_BASE_URL}/api/sessions/${sessionId}/attachments?kind=napkin`, {
      method: 'POST',
      headers: multipartHeaders(VISITOR_EMAIL),
      body: napkinForm(PNG_BYTES, 'image/png', 'napkin.png'),
    })
    if (r.status !== 200) {
      const text = await r.text()
      throw new Error(`unexpected ${r.status} from POST: ${text}`)
    }
    const body = (await r.json()) as { attachment: { id: string; kind: string } }
    expect(body.attachment.kind).toBe('napkin')

    // Session GET now carries the napkin_attachment_id from the correlated
    // subquery — same id we just got back from the upload.
    const sessionsResp = await fetch(`${E2E_BASE_URL}/api/sessions`, {
      headers: { Cookie: forgeAuthHeaders(VISITOR_EMAIL).Cookie },
    })
    expect(sessionsResp.status).toBe(200)
    const sessions = (await sessionsResp.json()) as {
      sessions: Array<{ id: string; napkin_attachment_id: string | null }>
    }
    const ours = sessions.sessions.find((s) => s.id === sessionId)
    expect(ours?.napkin_attachment_id).toBe(body.attachment.id)

    // The R2 object can be fetched back via the attachment GET endpoint.
    const blobResp = await fetch(
      `${E2E_BASE_URL}/api/sessions/${sessionId}/attachments/${body.attachment.id}`,
      { headers: { Cookie: forgeAuthHeaders(VISITOR_EMAIL).Cookie } },
    )
    expect(blobResp.status).toBe(200)
    expect(blobResp.headers.get('content-type')).toBe('image/png')
    const downloaded = new Uint8Array(await blobResp.arrayBuffer())
    expect(downloaded.length).toBe(PNG_BYTES.length)
    expect(downloaded[0]).toBe(0x89) // PNG signature byte 1
  })

  test('rejects non-PNG with ?kind=napkin → 415', async () => {
    const sessionId = `sess_napkin_${randomBytes(6).toString('hex')}`
    seedSession({ id: sessionId, email: VISITOR_EMAIL, tier: 1, status: 'active' })

    const r = await fetch(`${E2E_BASE_URL}/api/sessions/${sessionId}/attachments?kind=napkin`, {
      method: 'POST',
      headers: multipartHeaders(VISITOR_EMAIL),
      body: napkinForm(PDF_BYTES, 'application/pdf', 'not-a-napkin.pdf'),
    })
    expect(r.status).toBe(415)
    const j = (await r.json()) as { error: string }
    expect(j.error).toMatch(/napkin must be image\/png/)
  })

  test('rejects a second napkin on the same session → 409', async () => {
    const sessionId = `sess_napkin_${randomBytes(6).toString('hex')}`
    seedSession({ id: sessionId, email: VISITOR_EMAIL, tier: 1, status: 'active' })

    const first = await fetch(`${E2E_BASE_URL}/api/sessions/${sessionId}/attachments?kind=napkin`, {
      method: 'POST',
      headers: multipartHeaders(VISITOR_EMAIL),
      body: napkinForm(PNG_BYTES, 'image/png', 'napkin.png'),
    })
    expect(first.status).toBe(200)

    const second = await fetch(
      `${E2E_BASE_URL}/api/sessions/${sessionId}/attachments?kind=napkin`,
      {
        method: 'POST',
        headers: multipartHeaders(VISITOR_EMAIL),
        body: napkinForm(PNG_BYTES, 'image/png', 'second-napkin.png'),
      },
    )
    expect(second.status).toBe(409)
    const j = (await second.json()) as { error: string }
    expect(j.error).toMatch(/napkin already exists/)
  })

  test('napkin_attachment_id stays null on a session with no napkin', async () => {
    // Sanity check on the correlated subquery: a session with no kind='napkin'
    // attachment reports napkin_attachment_id as null. Mirrors the unit test
    // in functions/_lib/sessions.test.ts but against real D1 — proves the
    // subquery actually fires on the live SELECT, not just the mock.
    //
    // Originally this test also uploaded a kind='file' image/png to guard
    // against accidental napkin election from a thread attachment, but the
    // legacy 'file' upload path uses a hand-constructed ReadableStream
    // (from the magic-byte rewrapper) that Miniflare's R2 emulator rejects
    // for missing content-length. Production Workers R2 has been lenient on
    // this; surfaced + tracked in AUDIT.md.
    const sessionId = `sess_napkin_${randomBytes(6).toString('hex')}`
    seedSession({ id: sessionId, email: VISITOR_EMAIL, tier: 1, status: 'active' })

    const sessionsResp = await fetch(`${E2E_BASE_URL}/api/sessions`, {
      headers: { Cookie: forgeAuthHeaders(VISITOR_EMAIL).Cookie },
    })
    expect(sessionsResp.status).toBe(200)
    const sessions = (await sessionsResp.json()) as {
      sessions: Array<{ id: string; napkin_attachment_id: string | null }>
    }
    const ours = sessions.sessions.find((s) => s.id === sessionId)
    expect(ours).toBeDefined()
    expect(ours?.napkin_attachment_id).toBeNull()
  })
})
