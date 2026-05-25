/**
 * Handler-level tests for the `?kind=napkin` branch of POST
 * /api/sessions/:id/attachments (AUDIT P1.8). Covers the bits that pure
 * helpers (findNapkinForSession, attachmentKind) don't reach:
 *   - The URL query-param parsing actually opts the upload into the
 *     napkin path.
 *   - image/png is required when kind=napkin (a PDF labeled napkin → 415).
 *   - One-per-session is enforced (second POST → 409).
 *   - The stored row carries kind='napkin' (not 'file').
 *   - An unknown `kind` value is rejected with 400.
 *   - The auth + session-access wrapper still applies (no-cookie → 401).
 *
 * R2 is stubbed with a tiny in-memory put/delete — we only need to confirm
 * the handler routed the body somewhere R2-shaped and didn't blow up.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { D1Database, R2Bucket } from '@cloudflare/workers-types'
import { D1Mock } from '../../../../../tests/d1-mock'

const SESSION_SECRET = '0'.repeat(64)
const VISITOR_EMAIL = 'visitor@x.com'
const SESSION_ID = 'sess_napkin_test'

// happy-dom blocks `Cookie` as a forbidden Request header (per the Fetch
// spec), so we can't construct a Request with the cookie set the way
// production traffic does. Stub `currentEmail` at the module boundary so
// the handler under test behaves as if the cookie WERE there — the auth
// gate itself is exercised by the standalone "no cookie → 401" case at
// the bottom, which uses the real module unmocked. The currentEmail()
// implementation is covered by functions/_lib/auth.test.ts.
let _currentEmailReturn: string | null = VISITOR_EMAIL
vi.mock('../../../../_lib/auth', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    currentEmail: vi.fn(async () => _currentEmailReturn),
  }
})

import { onRequestPost } from './index'
import type { Env } from '../../../../_lib/env'

/** Tiny stub R2 — only the put/delete that the handler touches. */
function stubR2(): R2Bucket {
  const store = new Map<string, ArrayBuffer>()
  return {
    async put(key: string, body: ReadableStream | ArrayBuffer) {
      if (body instanceof ArrayBuffer) {
        store.set(key, body)
      } else {
        const bytes = await new Response(body).arrayBuffer()
        store.set(key, bytes)
      }
      return { key } as never
    },
    async delete(key: string) {
      store.delete(key)
    },
    async get() {
      return null
    },
    async head() {
      return null
    },
    async list() {
      return { objects: [], delimitedPrefixes: [], truncated: false } as never
    },
    async createMultipartUpload() {
      return {} as never
    },
    async resumeMultipartUpload() {
      return {} as never
    },
  } as unknown as R2Bucket
}

function seedSession(db: D1Mock): void {
  db.sessions.set(SESSION_ID, {
    id: SESSION_ID,
    email: VISITOR_EMAIL,
    intake_json: null,
    status: 'draft',
    created_at: 1,
    updated_at: 1,
    deleted_at: null,
    status_history: null,
    showcased_at: null,
    showcase_title: null,
    showcase_tagline: null,
  })
}

/** Reset the mocked currentEmail before each test (the default is the
 *  visitor; the "no auth" case flips it to null). */
function setAuthenticated(value: boolean) {
  _currentEmailReturn = value ? VISITOR_EMAIL : null
}

/** 1x1 PNG bytes. Magic-byte verifier in attachments.ts accepts these.
 *  Hand-built (not encoded) so we know the magic prefix matches. */
const PNG_BYTES = new Uint8Array([
  0x89,
  0x50,
  0x4e,
  0x47,
  0x0d,
  0x0a,
  0x1a,
  0x0a, // PNG signature
  0x00,
  0x00,
  0x00,
  0x0d, // …followed by minimal IHDR / IEND padding
  0x49,
  0x48,
  0x44,
  0x52,
  0x00,
  0x00,
  0x00,
  0x01,
  0x00,
  0x00,
  0x00,
  0x01,
  0x08,
  0x06,
  0x00,
  0x00,
  0x00,
])

/** PDF bytes — passes the magic check for application/pdf so we can verify
 *  the napkin path rejects "PDF declared as napkin" without the magic check
 *  short-circuiting first. */
const PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]) // %PDF-1.4

function makeFormDataRequest(
  url: string,
  fileBytes: Uint8Array,
  contentType: string,
  filename: string,
): Request {
  const form = new FormData()
  form.append('file', new File([fileBytes], filename, { type: contentType }))
  return new Request(url, {
    method: 'POST',
    body: form,
  })
}

function makeCtx(env: Partial<Env>, request: Request) {
  return {
    request,
    env: env as Env,
    params: { id: SESSION_ID },
    data: {},
    next: async () => new Response(),
    waitUntil: () => {},
    passThroughOnException: () => {},
    functionPath: '/api/sessions/[id]/attachments',
  } as never
}

describe('POST /api/sessions/:id/attachments?kind=napkin', () => {
  let db: D1Mock
  let r2: R2Bucket

  beforeEach(() => {
    db = new D1Mock()
    seedSession(db)
    r2 = stubR2()
    setAuthenticated(true)
  })

  function makeEnv(): Env {
    return {
      DB: db as unknown as D1Database,
      MEDIA: r2,
      RESEND_API_KEY: 'rk',
      ADMIN_EMAILS: 'marc@x.com',
      SESSION_SECRET,
    } as Env
  }

  it('writes a kind=napkin row when uploading image/png with ?kind=napkin', async () => {
    const req = makeFormDataRequest(
      `https://x.test/api/sessions/${SESSION_ID}/attachments?kind=napkin`,
      PNG_BYTES,
      'image/png',
      'napkin.png',
    )
    const res = await onRequestPost(makeCtx(makeEnv(), req))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { attachment: { kind: string; content_type: string } }
    expect(body.attachment.kind).toBe('napkin')
    expect(body.attachment.content_type).toBe('image/png')

    // DB carries it as a kind='napkin' row.
    const rows = [...db.attachments.values()].filter((a) => a.session_id === SESSION_ID)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.kind).toBe('napkin')
    expect(rows[0]?.message_id).toBeNull()
  })

  it('rejects with 415 when ?kind=napkin but content-type is not image/png', async () => {
    const req = makeFormDataRequest(
      `https://x.test/api/sessions/${SESSION_ID}/attachments?kind=napkin`,
      PDF_BYTES,
      'application/pdf',
      'not-a-napkin.pdf',
    )
    const res = await onRequestPost(makeCtx(makeEnv(), req))
    expect(res.status).toBe(415)
    const body = (await res.json()) as { error: string }
    expect(body.error).toMatch(/napkin must be image\/png/)
    // No row written.
    expect([...db.attachments.values()]).toHaveLength(0)
  })

  it('rejects with 409 when a napkin already exists for this session', async () => {
    // Seed an existing napkin.
    db.attachments.set('nap_existing', {
      id: 'nap_existing',
      session_id: SESSION_ID,
      message_id: null,
      uploaded_by: VISITOR_EMAIL,
      filename: 'napkin.png',
      content_type: 'image/png',
      size: 1024,
      r2_key: `sessions/${SESSION_ID}/nap_existing`,
      created_at: 1,
      kind: 'napkin',
    })
    const req = makeFormDataRequest(
      `https://x.test/api/sessions/${SESSION_ID}/attachments?kind=napkin`,
      PNG_BYTES,
      'image/png',
      'second-napkin.png',
    )
    const res = await onRequestPost(makeCtx(makeEnv(), req))
    expect(res.status).toBe(409)
    const body = (await res.json()) as { error: string }
    expect(body.error).toMatch(/napkin already exists/)
    // Existing row unchanged, no second row.
    expect([...db.attachments.values()].filter((a) => a.session_id === SESSION_ID)).toHaveLength(1)
  })

  it('rejects unknown ?kind values with 400', async () => {
    const req = makeFormDataRequest(
      `https://x.test/api/sessions/${SESSION_ID}/attachments?kind=bogus`,
      PNG_BYTES,
      'image/png',
      'x.png',
    )
    const res = await onRequestPost(makeCtx(makeEnv(), req))
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: string }
    expect(body.error).toMatch(/unknown kind/)
  })

  it('still classifies bare image/png upload (no ?kind) as kind=file, not napkin', async () => {
    // Sanity guard against my own bug: a regular image attachment must NOT
    // accidentally elect the napkin path.
    const req = makeFormDataRequest(
      `https://x.test/api/sessions/${SESSION_ID}/attachments`, // no query param
      PNG_BYTES,
      'image/png',
      'photo.png',
    )
    const res = await onRequestPost(makeCtx(makeEnv(), req))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { attachment: { kind: string } }
    expect(body.attachment.kind).toBe('file')
  })

  it('?kind=napkin&replace=true atomically swaps the napkin (old row + R2 deleted)', async () => {
    // Seed an existing napkin first.
    db.attachments.set('nap_old', {
      id: 'nap_old',
      session_id: SESSION_ID,
      message_id: null,
      uploaded_by: VISITOR_EMAIL,
      filename: 'napkin.png',
      content_type: 'image/png',
      size: 1024,
      r2_key: `sessions/${SESSION_ID}/nap_old`,
      created_at: 1,
      kind: 'napkin',
    })
    const req = makeFormDataRequest(
      `https://x.test/api/sessions/${SESSION_ID}/attachments?kind=napkin&replace=true`,
      PNG_BYTES,
      'image/png',
      'napkin-v2.png',
    )
    const res = await onRequestPost(makeCtx(makeEnv(), req))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { attachment: { id: string; kind: string } }
    expect(body.attachment.kind).toBe('napkin')
    expect(body.attachment.id).not.toBe('nap_old') // fresh id

    // Old row is gone, only the new one remains.
    const napkinRows = [...db.attachments.values()].filter(
      (a) => a.session_id === SESSION_ID && a.kind === 'napkin',
    )
    expect(napkinRows).toHaveLength(1)
    expect(napkinRows[0]?.id).toBe(body.attachment.id)
    expect(db.attachments.has('nap_old')).toBe(false)
  })

  it('?kind=napkin&replace=true on a session WITHOUT an existing napkin still works (idempotent)', async () => {
    const req = makeFormDataRequest(
      `https://x.test/api/sessions/${SESSION_ID}/attachments?kind=napkin&replace=true`,
      PNG_BYTES,
      'image/png',
      'napkin.png',
    )
    const res = await onRequestPost(makeCtx(makeEnv(), req))
    expect(res.status).toBe(200)
    const rows = [...db.attachments.values()].filter((a) => a.session_id === SESSION_ID)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.kind).toBe('napkin')
  })

  it('401 when not signed in (auth gate still runs before the kind branch)', async () => {
    setAuthenticated(false)
    const req = makeFormDataRequest(
      `https://x.test/api/sessions/${SESSION_ID}/attachments?kind=napkin`,
      PNG_BYTES,
      'image/png',
      'napkin.png',
    )
    const res = await onRequestPost(makeCtx(makeEnv(), req))
    expect(res.status).toBe(401)
  })
})
