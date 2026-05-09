import { describe, expect, it } from 'vitest'
import {
  isAllowedContentType,
  MAX_ATTACHMENT_SIZE,
  MAX_ATTACHMENTS_PER_MESSAGE,
  newAttachmentId,
  r2KeyFor,
  safeFilename,
} from './attachments'

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
})
