/**
 * Handler-level tests for POST (and a little GET) on
 * /api/sessions/:id/attachments — the upload path, focused on the validation
 * branches that the e2e backend spec (real wrangler + R2) doesn't pin
 * cheaply: content-type allow-list, magic-byte mismatch, per-kind + per-session
 * size ceilings, the `?kind=napkin` one-per-session opt-in and its
 * `?replace=true` swap, sketch JSON shape-checking, and the R2-rollback on a
 * DB write failure.
 *
 * R2 is a recording stub (tracks put/delete keys). The DB is the in-memory
 * D1Mock, which already matches every statement this handler issues. As in the
 * serve test, happy-dom forbids the `Cookie` request header, so currentEmail is
 * stubbed at the module boundary and the request object is hand-built — that
 * also sidesteps multipart parsing, which isn't what these tests are about.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { D1Database, R2Bucket } from '@cloudflare/workers-types'
import { D1Mock } from '../../../../../tests/d1-mock'
import {
  EXCALIDRAW_CONTENT_TYPE,
  MAX_ATTACHMENT_BYTES_PER_SESSION,
} from '../../../../_lib/attachments'

const SESSION_SECRET = '0'.repeat(64)
const VISITOR_EMAIL = 'visitor@x.com'
const SESSION_ID = 'sess_upload_test'

let _currentEmailReturn: string | null = VISITOR_EMAIL
vi.mock('../../../../_lib/auth', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return { ...actual, currentEmail: vi.fn(async () => _currentEmailReturn) }
})

import { onRequestPost, onRequestGet } from './index'
import type { Env } from '../../../../_lib/env'

const PNG_MAGIC = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00])
const WEBM_MAGIC = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x02, 0x03, 0x04])

/** A File-like whose `.stream()` emits `bytes`. `size` defaults to the byte
 *  length but can be overridden to exercise the size-cap branches without
 *  allocating a real multi-MB body (the cap is checked before buffering). */
function fileLike(opts: { name: string; type: string; bytes: Uint8Array; size?: number }) {
  return {
    name: opts.name,
    type: opts.type,
    size: opts.size ?? opts.bytes.length,
    stream: () =>
      new ReadableStream<Uint8Array>({
        start(c) {
          c.enqueue(opts.bytes)
          c.close()
        },
      }),
  }
}

function stubR2() {
  const store = new Map<string, unknown>()
  const puts: string[] = []
  const deletes: string[] = []
  const bucket = {
    puts,
    deletes,
    async put(key: string, body: unknown) {
      puts.push(key)
      store.set(key, body)
      return { key } as never
    },
    async delete(key: string) {
      deletes.push(key)
      store.delete(key)
    },
    async get(key: string) {
      return store.has(key) ? ({ body: store.get(key) } as never) : null
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
  }
  return bucket as unknown as R2Bucket & { puts: string[]; deletes: string[] }
}

function seedSession(db: D1Mock): void {
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
}

function makeCtx(
  env: Partial<Env>,
  opts: { file?: ReturnType<typeof fileLike> | null; query?: string } = {},
) {
  const query = opts.query ?? ''
  const request = {
    url: `https://x.test/api/sessions/${SESSION_ID}/attachments${query}`,
    headers: new Headers(),
    formData: async () => ({
      get: (k: string) => (k === 'file' ? (opts.file ?? null) : null),
    }),
  }
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

describe('POST /api/sessions/:id/attachments (upload)', () => {
  let db: D1Mock
  let media: R2Bucket & { puts: string[]; deletes: string[] }
  let env: Env

  beforeEach(() => {
    db = new D1Mock()
    seedSession(db)
    media = stubR2()
    _currentEmailReturn = VISITOR_EMAIL
    env = {
      DB: db as unknown as D1Database,
      MEDIA: media,
      ADMIN_EMAILS: 'marc@x.com',
      SESSION_SECRET,
    } as Env
  })

  function post(file: ReturnType<typeof fileLike> | null, query?: string): Promise<Response> {
    return onRequestPost(makeCtx(env, { file, query })) as Promise<Response>
  }

  it('503s when the MEDIA binding is absent (graceful degrade)', async () => {
    env = { ...env, MEDIA: undefined } as Env
    const res = await post(fileLike({ name: 'a.png', type: 'image/png', bytes: PNG_MAGIC }))
    expect(res.status).toBe(503)
  })

  it('401s when not signed in', async () => {
    _currentEmailReturn = null
    const res = await post(fileLike({ name: 'a.png', type: 'image/png', bytes: PNG_MAGIC }))
    expect(res.status).toBe(401)
  })

  it('400s on a missing "file" field', async () => {
    const res = await post(null)
    expect(res.status).toBe(400)
  })

  it('400s on an empty file', async () => {
    const res = await post(fileLike({ name: 'a.png', type: 'image/png', bytes: new Uint8Array(0) }))
    expect(res.status).toBe(400)
  })

  it('stores a valid PNG as kind=file and returns the row', async () => {
    const res = await post(fileLike({ name: 'shot.png', type: 'image/png', bytes: PNG_MAGIC }))
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      attachment: { kind: string; filename: string; size: number }
    }
    expect(body.attachment.kind).toBe('file')
    expect(body.attachment.filename).toBe('shot.png')
    expect(media.puts).toHaveLength(1)
    expect(db.attachments.size).toBe(1)
  })

  it('415s when the bytes do not match the declared content type', async () => {
    // Declares image/png but the bytes are not the PNG signature.
    const res = await post(
      fileLike({
        name: 'fake.png',
        type: 'image/png',
        bytes: new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]),
      }),
    )
    expect(res.status).toBe(415)
    expect(media.puts).toHaveLength(0)
    expect(db.attachments.size).toBe(0)
  })

  it('415s on a disallowed content type', async () => {
    const res = await post(
      fileLike({ name: 'run.sh', type: 'application/x-sh', bytes: new Uint8Array([0x23, 0x21]) }),
    )
    expect(res.status).toBe(415)
  })

  it('413s when the file exceeds the per-kind size cap', async () => {
    // size is checked before buffering, so a small body with a huge declared
    // size exercises the ceiling. 11 MB > the 10 MB file cap.
    const res = await post(
      fileLike({ name: 'big.png', type: 'image/png', bytes: PNG_MAGIC, size: 11 * 1024 * 1024 }),
    )
    expect(res.status).toBe(413)
  })

  it('413s when the per-session storage budget is reached', async () => {
    // An existing attachment already fills the session budget.
    db.attachments.set('att_old', {
      id: 'att_old',
      session_id: SESSION_ID,
      message_id: null,
      uploaded_by: VISITOR_EMAIL,
      filename: 'old.bin',
      content_type: 'application/pdf',
      size: MAX_ATTACHMENT_BYTES_PER_SESSION,
      r2_key: `sessions/${SESSION_ID}/att_old`,
      created_at: 1,
      kind: 'file',
    })
    const res = await post(fileLike({ name: 'a.png', type: 'image/png', bytes: PNG_MAGIC }))
    expect(res.status).toBe(413)
    expect(media.puts).toHaveLength(0)
  })

  it('stores a voice note as kind=voice with a null transcript when AI is off', async () => {
    const res = await post(
      fileLike({ name: 'clip.webm', type: 'audio/webm;codecs=opus', bytes: WEBM_MAGIC }),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { attachment: { kind: string; transcript: string | null } }
    expect(body.attachment.kind).toBe('voice')
    expect(body.attachment.transcript).toBeNull()
  })

  it('stores a valid Excalidraw scene as kind=sketch', async () => {
    const scene = new TextEncoder().encode(JSON.stringify({ elements: [] }))
    const res = await post(fileLike({ name: 'scene', type: EXCALIDRAW_CONTENT_TYPE, bytes: scene }))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { attachment: { kind: string } }
    expect(body.attachment.kind).toBe('sketch')
  })

  it('400s on a sketch that is not JSON', async () => {
    const bytes = new TextEncoder().encode('not json at all')
    const res = await post(fileLike({ name: 'scene', type: EXCALIDRAW_CONTENT_TYPE, bytes }))
    expect(res.status).toBe(400)
  })

  it('400s on a sketch JSON missing the elements array', async () => {
    const bytes = new TextEncoder().encode(JSON.stringify({ notElements: true }))
    const res = await post(fileLike({ name: 'scene', type: EXCALIDRAW_CONTENT_TYPE, bytes }))
    expect(res.status).toBe(400)
  })

  it('400s on an unknown ?kind', async () => {
    const res = await post(
      fileLike({ name: 'a.png', type: 'image/png', bytes: PNG_MAGIC }),
      '?kind=banner',
    )
    expect(res.status).toBe(400)
  })

  it('stores ?kind=napkin (image/png) as kind=napkin', async () => {
    const res = await post(
      fileLike({ name: 'napkin.png', type: 'image/png', bytes: PNG_MAGIC }),
      '?kind=napkin',
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { attachment: { kind: string } }
    expect(body.attachment.kind).toBe('napkin')
  })

  it('415s when ?kind=napkin is not image/png', async () => {
    const res = await post(
      fileLike({ name: 'napkin.webm', type: 'audio/webm', bytes: WEBM_MAGIC }),
      '?kind=napkin',
    )
    expect(res.status).toBe(415)
  })

  it('409s on a second napkin without ?replace=true', async () => {
    db.attachments.set('att_napkin', {
      id: 'att_napkin',
      session_id: SESSION_ID,
      message_id: null,
      uploaded_by: VISITOR_EMAIL,
      filename: 'napkin.png',
      content_type: 'image/png',
      size: 10,
      r2_key: `sessions/${SESSION_ID}/att_napkin`,
      created_at: 1,
      kind: 'napkin',
    })
    const res = await post(
      fileLike({ name: 'new.png', type: 'image/png', bytes: PNG_MAGIC }),
      '?kind=napkin',
    )
    expect(res.status).toBe(409)
  })

  it('replaces an existing napkin atomically with ?kind=napkin&replace=true', async () => {
    db.attachments.set('att_napkin', {
      id: 'att_napkin',
      session_id: SESSION_ID,
      message_id: null,
      uploaded_by: VISITOR_EMAIL,
      filename: 'napkin.png',
      content_type: 'image/png',
      size: 10,
      r2_key: `sessions/${SESSION_ID}/att_napkin`,
      created_at: 1,
      kind: 'napkin',
    })
    const res = await post(
      fileLike({ name: 'new.png', type: 'image/png', bytes: PNG_MAGIC }),
      '?kind=napkin&replace=true',
    )
    expect(res.status).toBe(200)
    // Old row gone, new row present — exactly one napkin remains.
    expect(db.attachments.has('att_napkin')).toBe(false)
    expect(db.attachments.size).toBe(1)
    // Old R2 object was cleaned up after the new one landed.
    expect(media.deletes).toContain(`sessions/${SESSION_ID}/att_napkin`)
  })

  it('rolls back the R2 object when the DB insert fails', async () => {
    const realPrepare = db.prepare.bind(db)
    vi.spyOn(db, 'prepare').mockImplementation((sql: string) => {
      if (sql.trim().startsWith('INSERT INTO attachments')) {
        return {
          bind: () => ({
            run: async () => {
              throw new Error('boom')
            },
          }),
        } as never
      }
      return realPrepare(sql)
    })
    await expect(
      post(fileLike({ name: 'a.png', type: 'image/png', bytes: PNG_MAGIC })),
    ).rejects.toThrow('boom')
    // The orphaned R2 object was deleted on the failure path.
    expect(media.deletes).toHaveLength(1)
  })
})

describe('GET /api/sessions/:id/attachments (pre-message list)', () => {
  let db: D1Mock
  let env: Env

  beforeEach(() => {
    db = new D1Mock()
    seedSession(db)
    _currentEmailReturn = VISITOR_EMAIL
    env = {
      DB: db as unknown as D1Database,
      MEDIA: stubR2(),
      ADMIN_EMAILS: 'marc@x.com',
      SESSION_SECRET,
    } as Env
  })

  it('401s when not signed in', async () => {
    _currentEmailReturn = null
    const res = (await onRequestGet(makeCtx(env))) as Response
    expect(res.status).toBe(401)
  })

  it('returns only the actor’s unlinked uploads for the session', async () => {
    db.attachments.set('att_unlinked', {
      id: 'att_unlinked',
      session_id: SESSION_ID,
      message_id: null,
      uploaded_by: VISITOR_EMAIL,
      filename: 'draft.png',
      content_type: 'image/png',
      size: 10,
      r2_key: `sessions/${SESSION_ID}/att_unlinked`,
      created_at: 1,
      kind: 'file',
    })
    db.attachments.set('att_linked', {
      id: 'att_linked',
      session_id: SESSION_ID,
      message_id: 'msg_1',
      uploaded_by: VISITOR_EMAIL,
      filename: 'sent.png',
      content_type: 'image/png',
      size: 10,
      r2_key: `sessions/${SESSION_ID}/att_linked`,
      created_at: 2,
      kind: 'file',
    })
    const res = (await onRequestGet(makeCtx(env))) as Response
    expect(res.status).toBe(200)
    const body = (await res.json()) as { attachments: Array<{ id: string }> }
    expect(body.attachments.map((a) => a.id)).toEqual(['att_unlinked'])
  })
})
