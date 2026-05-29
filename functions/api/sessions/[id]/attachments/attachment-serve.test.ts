/**
 * Handler-level tests for GET /api/sessions/:id/attachments/:attId — the
 * stream-from-R2 path, focused on HTTP Range support.
 *
 * Why Range matters here: a MediaRecorder webm/opus voice note carries no
 * duration in its header, so the <audio> element issues a Range request to
 * backfill the duration and to seek. A server that always answers 200 leaves
 * the clip unseekable — it plays once and errors on replay (the "voice note
 * says error the second time" bug). These tests pin the 206 / Content-Range /
 * Accept-Ranges / 416 behaviour so a future refactor can't silently drop it.
 *
 * R2 is stubbed with an in-memory buffer whose `get` honours the `range`
 * option, mirroring the real binding closely enough to exercise the slice.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { D1Database, R2Bucket } from '@cloudflare/workers-types'
import { D1Mock } from '../../../../../tests/d1-mock'

const SESSION_SECRET = '0'.repeat(64)
const VISITOR_EMAIL = 'visitor@x.com'
const SESSION_ID = 'sess_serve_test'
const ATT_ID = 'att_voice_1'

// happy-dom blocks `Cookie` as a forbidden Request header, so we stub
// currentEmail at the module boundary (same approach as napkin-upload.test.ts).
// The "no cookie → 401" gate is covered by the auth lib's own tests.
let _currentEmailReturn: string | null = VISITOR_EMAIL
vi.mock('../../../../_lib/auth', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    currentEmail: vi.fn(async () => _currentEmailReturn),
  }
})

import { onRequestGet } from './[attId]'
import type { Env } from '../../../../_lib/env'

// A recognizable 100-byte body — index 0..99 — so a sliced range is easy to
// assert against (byte N === N).
const BODY = new Uint8Array(Array.from({ length: 100 }, (_, i) => i))

/** Stub R2 whose `get` honours the `{ range: { offset, length } }` option the
 *  serving handler passes for partial reads. */
function stubR2(bytes: Uint8Array): R2Bucket {
  return {
    async get(_key: string, opts?: { range?: { offset: number; length: number } }) {
      const range = opts?.range
      if (range) {
        const slice = bytes.slice(range.offset, range.offset + range.length)
        return { body: slice, size: bytes.length, range } as never
      }
      return { body: bytes, size: bytes.length } as never
    },
    async put() {
      return { key: 'k' } as never
    },
    async delete() {},
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

function seedSessionAndVoice(db: D1Mock): void {
  db.sessions.set(SESSION_ID, {
    id: SESSION_ID,
    email: VISITOR_EMAIL,
    intake_json: null,
    status: 'active',
    created_at: 1,
    updated_at: 1,
    deleted_at: null,
    status_history: null,
    showcased_at: null,
    showcase_title: null,
    showcase_tagline: null,
  })
  db.attachments.set(ATT_ID, {
    id: ATT_ID,
    session_id: SESSION_ID,
    message_id: 'msg_1',
    uploaded_by: VISITOR_EMAIL,
    filename: 'voice-note.webm',
    content_type: 'audio/webm;codecs=opus',
    size: BODY.length,
    r2_key: `sessions/${SESSION_ID}/${ATT_ID}`,
    created_at: 1,
    kind: 'voice',
    transcript: null,
  })
}

function makeCtx(env: Partial<Env>, request: Request) {
  return {
    request,
    env: env as Env,
    params: { id: SESSION_ID, attId: ATT_ID },
    data: {},
    next: async () => new Response(),
    waitUntil: () => {},
    passThroughOnException: () => {},
    functionPath: '/api/sessions/[id]/attachments/[attId]',
  } as never
}

describe('GET /api/sessions/:id/attachments/:attId (Range support)', () => {
  let db: D1Mock
  let env: Env

  beforeEach(() => {
    db = new D1Mock()
    seedSessionAndVoice(db)
    _currentEmailReturn = VISITOR_EMAIL
    env = {
      DB: db as unknown as D1Database,
      MEDIA: stubR2(BODY),
      ADMIN_EMAILS: 'marc@x.com',
      SESSION_SECRET,
    } as Env
  })

  function get(headers?: Record<string, string>): Promise<Response> {
    const req = new Request(`https://x.test/api/sessions/${SESSION_ID}/attachments/${ATT_ID}`, {
      headers,
    })
    return onRequestGet(makeCtx(env, req)) as Promise<Response>
  }

  it('serves the full body as 200 with Accept-Ranges when no Range is sent', async () => {
    const res = await get()
    expect(res.status).toBe(200)
    expect(res.headers.get('accept-ranges')).toBe('bytes')
    expect(res.headers.get('content-length')).toBe('100')
    expect(res.headers.get('content-range')).toBeNull()
    expect(res.headers.get('content-type')).toBe('audio/webm;codecs=opus')
    const buf = new Uint8Array(await res.arrayBuffer())
    expect(buf.length).toBe(100)
    expect(buf[0]).toBe(0)
    expect(buf[99]).toBe(99)
  })

  it('answers a bounded range with 206 + Content-Range and the exact slice', async () => {
    const res = await get({ range: 'bytes=10-19' })
    expect(res.status).toBe(206)
    expect(res.headers.get('content-range')).toBe('bytes 10-19/100')
    expect(res.headers.get('content-length')).toBe('10')
    expect(res.headers.get('accept-ranges')).toBe('bytes')
    const buf = new Uint8Array(await res.arrayBuffer())
    expect(buf.length).toBe(10)
    expect(buf[0]).toBe(10)
    expect(buf[9]).toBe(19)
  })

  it('treats an open-ended range (bytes=0-) as the whole object, 206', async () => {
    // This is the request a media element fires first to probe seekability.
    const res = await get({ range: 'bytes=0-' })
    expect(res.status).toBe(206)
    expect(res.headers.get('content-range')).toBe('bytes 0-99/100')
    expect(res.headers.get('content-length')).toBe('100')
  })

  it('clamps an end past the object size to the last byte', async () => {
    const res = await get({ range: 'bytes=90-200' })
    expect(res.status).toBe(206)
    expect(res.headers.get('content-range')).toBe('bytes 90-99/100')
    expect(res.headers.get('content-length')).toBe('10')
  })

  it('honours a suffix range (bytes=-10) as the last N bytes', async () => {
    const res = await get({ range: 'bytes=-10' })
    expect(res.status).toBe(206)
    expect(res.headers.get('content-range')).toBe('bytes 90-99/100')
    const buf = new Uint8Array(await res.arrayBuffer())
    expect(buf[0]).toBe(90)
    expect(buf[9]).toBe(99)
  })

  it('returns 416 with Content-Range:*/size for a start past the end', async () => {
    const res = await get({ range: 'bytes=200-300' })
    expect(res.status).toBe(416)
    expect(res.headers.get('content-range')).toBe('bytes */100')
  })

  it('falls back to a full 200 on a garbled Range header', async () => {
    const res = await get({ range: 'rows=1-2' })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-length')).toBe('100')
  })

  it('401s when not signed in', async () => {
    _currentEmailReturn = null
    const res = await get({ range: 'bytes=0-9' })
    expect(res.status).toBe(401)
  })

  it('503s when the MEDIA binding is absent (graceful degrade)', async () => {
    env = { ...env, MEDIA: undefined } as Env
    const res = await get()
    expect(res.status).toBe(503)
  })
})
