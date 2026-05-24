import { describe, expect, it } from 'vitest'
import {
  attachmentKind,
  baseContentType,
  EXCALIDRAW_CONTENT_TYPE,
  findNapkinForSession,
  isAllowedContentType,
  MAX_ATTACHMENT_SIZE,
  MAX_ATTACHMENTS_PER_MESSAGE,
  MAX_NAPKIN_SIZE,
  MAX_SKETCH_SIZE,
  MAX_VOICE_SIZE,
  newAttachmentId,
  r2KeyFor,
  safeFilename,
  verifyMagicBytesBuffer,
} from './attachments'
import { D1Mock } from '../../tests/d1-mock'
import type { D1Database } from '@cloudflare/workers-types'

describe('isAllowedContentType', () => {
  it('accepts image/* and text/*', () => {
    expect(isAllowedContentType('image/png')).toBe(true)
    expect(isAllowedContentType('image/jpeg')).toBe(true)
    expect(isAllowedContentType('text/plain')).toBe(true)
    expect(isAllowedContentType('text/csv')).toBe(true)
  })

  it('accepts the office + pdf allowlist', () => {
    expect(isAllowedContentType('application/pdf')).toBe(true)
    expect(
      isAllowedContentType(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ),
    ).toBe(true)
    expect(isAllowedContentType('application/zip')).toBe(true)
  })

  it('strips charset suffixes before matching', () => {
    expect(isAllowedContentType('text/plain; charset=utf-8')).toBe(true)
  })

  it('rejects executables and unknown application/*', () => {
    expect(isAllowedContentType('application/x-msdownload')).toBe(false)
    expect(isAllowedContentType('application/x-sh')).toBe(false)
    expect(isAllowedContentType('application/octet-stream')).toBe(false)
  })

  it('rejects empty / falsy', () => {
    expect(isAllowedContentType('')).toBe(false)
    expect(isAllowedContentType('  ')).toBe(false)
  })

  it('is case-insensitive', () => {
    expect(isAllowedContentType('IMAGE/PNG')).toBe(true)
  })

  it('accepts audio/* (voice notes) and the Excalidraw scene type', () => {
    expect(isAllowedContentType('audio/webm')).toBe(true)
    expect(isAllowedContentType('audio/webm;codecs=opus')).toBe(true)
    expect(isAllowedContentType('audio/ogg')).toBe(true)
    expect(isAllowedContentType('audio/mp4')).toBe(true)
    expect(isAllowedContentType(EXCALIDRAW_CONTENT_TYPE)).toBe(true)
  })
})

describe('baseContentType', () => {
  it('strips the codecs / charset parameter', () => {
    expect(baseContentType('audio/webm;codecs=opus')).toBe('audio/webm')
    expect(baseContentType('text/plain; charset=utf-8')).toBe('text/plain')
  })
  it('lowercases', () => {
    expect(baseContentType('AUDIO/WEBM')).toBe('audio/webm')
  })
})

describe('attachmentKind', () => {
  it('classifies voice, sketch and file', () => {
    expect(attachmentKind('audio/webm;codecs=opus')).toBe('voice')
    expect(attachmentKind('audio/mp4')).toBe('voice')
    expect(attachmentKind(EXCALIDRAW_CONTENT_TYPE)).toBe('sketch')
    expect(attachmentKind('image/png')).toBe('file')
    expect(attachmentKind('application/pdf')).toBe('file')
    expect(attachmentKind('application/json')).toBe('file')
  })

  it("never classifies image/png as 'napkin' — that requires explicit opt-in", () => {
    // The napkin kind exists, but it's only set when the upload handler is
    // called with `?kind=napkin`. A bare image/png upload from a thread
    // attachment must still classify as 'file', or the orphan sweep would
    // skip it incorrectly (napkin is exempt; thread attachments are not).
    expect(attachmentKind('image/png')).toBe('file')
  })
})

describe('verifyMagicBytesBuffer', () => {
  it('accepts a WebM clip with the EBML header', () => {
    const ok = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x00, 0x00])
    expect(verifyMagicBytesBuffer('audio/webm;codecs=opus', ok)).toBe(true)
  })
  it('rejects a WebM clip whose bytes lie', () => {
    const bad = new Uint8Array([0x00, 0x00, 0x00, 0x00])
    expect(verifyMagicBytesBuffer('audio/webm', bad)).toBe(false)
  })
  it('accepts an Ogg clip with the OggS header', () => {
    const ok = new Uint8Array([0x4f, 0x67, 0x67, 0x53, 0x00])
    expect(verifyMagicBytesBuffer('audio/ogg', ok)).toBe(true)
  })
  it('passes through types with no known signature (sketch JSON, mp4)', () => {
    expect(verifyMagicBytesBuffer(EXCALIDRAW_CONTENT_TYPE, new Uint8Array([0x7b]))).toBe(true)
    expect(verifyMagicBytesBuffer('audio/mp4', new Uint8Array([0x00]))).toBe(true)
  })
})

describe('safeFilename', () => {
  it('strips POSIX path components', () => {
    expect(safeFilename('/etc/passwd')).toBe('passwd')
  })

  it('strips Windows path components', () => {
    expect(safeFilename('C:\\Users\\victim\\secrets.txt')).toBe('secrets.txt')
  })

  it('drops control characters', () => {
    expect(safeFilename('hi\x00\x07.png')).toBe('hi.png')
  })

  it('caps to 200 chars', () => {
    const long = 'a'.repeat(500) + '.txt'
    const out = safeFilename(long)
    expect(out.length).toBe(200)
  })

  it('returns fallback when input is empty after sanitize', () => {
    expect(safeFilename('')).toBe('attachment')
    expect(safeFilename('/')).toBe('attachment')
  })

  it('preserves unicode', () => {
    expect(safeFilename('résumé.pdf')).toBe('résumé.pdf')
  })
})

describe('r2KeyFor', () => {
  it('puts session in path, attachment id at leaf', () => {
    expect(r2KeyFor('s1', 'a1')).toBe('sessions/s1/a1')
  })
})

describe('newAttachmentId', () => {
  it('returns a non-empty token', () => {
    const id = newAttachmentId()
    expect(id).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(id.length).toBeGreaterThan(8)
  })

  it('returns distinct ids', () => {
    const a = newAttachmentId()
    const b = newAttachmentId()
    expect(a).not.toBe(b)
  })
})

describe('constants', () => {
  it('per-file ceiling is 10 MB', () => {
    expect(MAX_ATTACHMENT_SIZE).toBe(10 * 1024 * 1024)
  })

  it('per-message ceiling is 5', () => {
    expect(MAX_ATTACHMENTS_PER_MESSAGE).toBe(5)
  })

  it('voice + sketch ceilings sit below the streamed-file ceiling', () => {
    expect(MAX_VOICE_SIZE).toBe(8 * 1024 * 1024)
    expect(MAX_SKETCH_SIZE).toBe(2 * 1024 * 1024)
    expect(MAX_VOICE_SIZE).toBeLessThan(MAX_ATTACHMENT_SIZE)
    expect(MAX_SKETCH_SIZE).toBeLessThan(MAX_ATTACHMENT_SIZE)
  })

  it('napkin ceiling sits below the streamed-file ceiling', () => {
    expect(MAX_NAPKIN_SIZE).toBe(4 * 1024 * 1024)
    expect(MAX_NAPKIN_SIZE).toBeLessThan(MAX_ATTACHMENT_SIZE)
  })
})

describe('findNapkinForSession', () => {
  it('returns null when no napkin attached', async () => {
    const db = new D1Mock()
    db.sessions.set('s1', {
      id: 's1',
      email: 'v@x',
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
    const got = await findNapkinForSession(db as unknown as D1Database, 's1')
    expect(got).toBeNull()
  })

  it('returns the napkin row when one exists', async () => {
    const db = new D1Mock()
    db.attachments.set('a1', {
      id: 'a1',
      session_id: 's1',
      message_id: null,
      uploaded_by: 'v@x',
      filename: 'napkin.png',
      content_type: 'image/png',
      size: 1024,
      r2_key: 'sessions/s1/a1',
      created_at: 1,
      kind: 'napkin',
    })
    const got = await findNapkinForSession(db as unknown as D1Database, 's1')
    expect(got?.id).toBe('a1')
    expect(got?.kind).toBe('napkin')
  })

  it('orphan-sweep SQL skips kind=napkin while collecting other orphans', async () => {
    // Direct query path — mirrors the SQL in functions/api/admin/digest.ts.
    // Proves the d1-mock filter matches the production WHERE clause.
    const db = new D1Mock()
    const oldEnough = 1
    const recent = 9_999_999_999
    db.attachments.set('orphan_file', {
      id: 'orphan_file',
      session_id: 's1',
      message_id: null,
      uploaded_by: 'v@x',
      filename: 'leftover.pdf',
      content_type: 'application/pdf',
      size: 100,
      r2_key: 'sessions/s1/orphan_file',
      created_at: oldEnough,
      kind: 'file',
    })
    db.attachments.set('napkin', {
      id: 'napkin',
      session_id: 's1',
      message_id: null,
      uploaded_by: 'v@x',
      filename: 'napkin.png',
      content_type: 'image/png',
      size: 100,
      r2_key: 'sessions/s1/napkin',
      created_at: oldEnough,
      kind: 'napkin',
    })
    db.attachments.set('linked', {
      id: 'linked',
      session_id: 's1',
      message_id: 'm1',
      uploaded_by: 'v@x',
      filename: 'doc.pdf',
      content_type: 'application/pdf',
      size: 100,
      r2_key: 'sessions/s1/linked',
      created_at: oldEnough,
      kind: 'file',
    })

    const res = await db
      .prepare(
        `SELECT id, r2_key FROM attachments
         WHERE message_id IS NULL AND kind != 'napkin' AND created_at < ?`,
      )
      .bind(recent)
      .all<{ id: string; r2_key: string }>()

    const ids = (res.results ?? []).map((r) => r.id)
    expect(ids).toEqual(['orphan_file'])
    expect(ids).not.toContain('napkin')
    expect(ids).not.toContain('linked')
  })

  it('ignores attachments of other kinds (sketch, file, voice)', async () => {
    const db = new D1Mock()
    db.attachments.set('a_sketch', {
      id: 'a_sketch',
      session_id: 's1',
      message_id: 'm1',
      uploaded_by: 'v@x',
      filename: 'doodle.excalidraw',
      content_type: EXCALIDRAW_CONTENT_TYPE,
      size: 1024,
      r2_key: 'sessions/s1/a_sketch',
      created_at: 1,
      kind: 'sketch',
    })
    db.attachments.set('a_file', {
      id: 'a_file',
      session_id: 's1',
      message_id: null,
      uploaded_by: 'v@x',
      filename: 'photo.png',
      content_type: 'image/png',
      size: 1024,
      r2_key: 'sessions/s1/a_file',
      created_at: 1,
      kind: 'file',
    })
    const got = await findNapkinForSession(db as unknown as D1Database, 's1')
    expect(got).toBeNull()
  })
})
