/**
 * Unit tests for the intake-submission orchestrator. Proves the two
 * load-bearing invariants:
 *   1. The PNG is split out of intake_json before the session POST — the
 *      payload that reaches /api/sessions never carries the data URL.
 *   2. A napkin-upload failure does NOT eat the session — it returns alongside
 *      the session row so the caller can surface a retry affordance.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { submitIntake } from './submitIntake'

type FetchHandler = (url: string, init: RequestInit) => Promise<Response>

/**
 * Stub `fetch` for the duration of one test. Data URLs are short-circuited
 * to a 1x1 PNG Blob response — uploadNapkin() calls `fetch(dataUrl)` to
 * decode the PNG to a Blob, and routing that through the test handler
 * forces each test to know about an internal implementation detail.
 */
function mockFetch(handler: FetchHandler) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      if (typeof url === 'string' && url.startsWith('data:')) {
        return Promise.resolve(new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47])))
      }
      return handler(url, init ?? {})
    }),
  )
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

const SESSION_OK = {
  session: {
    id: 'sess_abc',
    email: 'v@x.com',
    intake_json: null,
    status: 'draft',
    created_at: 1,
    updated_at: 1,
    deleted_at: null,
    status_history: null,
    napkin_attachment_id: null,
    community_discount: 0,
  },
}

const ATTACHMENT_OK = {
  attachment: {
    id: 'att_napkin',
    session_id: 'sess_abc',
    message_id: null,
    uploaded_by: 'v@x.com',
    filename: 'napkin.png',
    content_type: 'image/png',
    size: 1024,
    r2_key: 'sessions/sess_abc/att_napkin',
    created_at: 1,
    kind: 'napkin' as const,
    transcript: null,
  },
}

// A minimal valid PNG data URL (1x1 transparent PNG, base64-encoded). Enough
// for fetch(dataUrl) to return a Blob; we don't validate the bytes here.
const TINY_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

beforeEach(() => {
  vi.unstubAllGlobals()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('submitIntake — payload splitting', () => {
  it('strips napkin.png from the intake payload before POSTing /api/sessions', async () => {
    let sessionBody: unknown = null
    mockFetch(async (url, init) => {
      if (url === '/api/sessions') {
        sessionBody = JSON.parse(init.body as string)
        return jsonResponse(200, SESSION_OK)
      }
      if (url.includes('/attachments?kind=napkin')) {
        return jsonResponse(200, ATTACHMENT_OK)
      }
      throw new Error(`unexpected url ${url}`)
    })

    await submitIntake({
      type: 'website',
      account: { email: 'v@x.com' },
      formData: {},
      submittedAt: '2026-05-24',
      lang: 'fr',
      napkin: {
        png: TINY_PNG_DATA_URL,
        text: 'a thing',
        savedAt: '2026-05-24T10:00:00Z',
        scene: { elements: [] },
      },
    })

    const body = sessionBody as { intakeJson: { napkin: { png?: string; scene: unknown } } }
    // png is gone — the editable scene + caption survive so the session view
    // can still re-open the canvas.
    expect(body.intakeJson.napkin.png).toBeUndefined()
    expect(body.intakeJson.napkin.scene).toBeDefined()
  })

  it('passes through intake unchanged when no napkin is present', async () => {
    let sessionBody: unknown = null
    mockFetch(async (url, init) => {
      if (url === '/api/sessions') {
        sessionBody = JSON.parse(init.body as string)
        return jsonResponse(200, SESSION_OK)
      }
      throw new Error(`unexpected url ${url}`)
    })

    await submitIntake({
      type: 'website',
      account: { email: 'v@x.com' },
      formData: {},
      submittedAt: '2026-05-24',
    })

    const body = sessionBody as { intakeJson: { napkin?: unknown } }
    expect(body.intakeJson.napkin).toBeUndefined()
  })

  it("doesn't try to re-upload when the napkin's `png` is already a server URL (resumed flow)", async () => {
    const calls: string[] = []
    mockFetch(async (url) => {
      calls.push(url)
      if (url === '/api/sessions') return jsonResponse(200, SESSION_OK)
      throw new Error(`unexpected url ${url}`)
    })

    await submitIntake({
      type: 'website',
      account: { email: 'v@x.com' },
      formData: {},
      submittedAt: '2026-05-24',
      napkin: {
        png: '/api/sessions/sess_abc/attachments/att_napkin', // not a data URL
        text: '',
        savedAt: '',
        scene: { elements: [] },
      },
    })

    expect(calls).toEqual(['/api/sessions'])
  })
})

describe('submitIntake — failure handling', () => {
  it('throws when the session POST itself fails', async () => {
    mockFetch(async (url) => {
      if (url === '/api/sessions') return jsonResponse(409, { error: 'at capacity' })
      throw new Error(`unexpected url ${url}`)
    })

    await expect(
      submitIntake({
        type: 'website',
        account: { email: 'v@x.com' },
        formData: {},
        submittedAt: '2026-05-24',
      }),
    ).rejects.toThrow(/at capacity/)
  })

  it('returns the session + napkinUploadError when only the napkin upload fails', async () => {
    mockFetch(async (url) => {
      if (url === '/api/sessions') return jsonResponse(200, SESSION_OK)
      if (url.includes('/attachments')) {
        return jsonResponse(503, { error: 'attachments disabled' })
      }
      throw new Error(`unexpected url ${url}`)
    })

    const result = await submitIntake({
      type: 'website',
      account: { email: 'v@x.com' },
      formData: {},
      submittedAt: '2026-05-24',
      napkin: {
        png: TINY_PNG_DATA_URL,
        text: 'sketch',
        savedAt: '2026-05-24T10:00:00Z',
        scene: { elements: [] },
      },
    })

    // Session is preserved — caller can navigate to it. The error rides
    // alongside so the caller can surface a retry path.
    expect(result.session.id).toBe('sess_abc')
    expect(result.napkinUploadError).toMatch(/attachments disabled/)
  })

  it('treats a 409 napkin (already exists) as silent success', async () => {
    mockFetch(async (url) => {
      if (url === '/api/sessions') return jsonResponse(200, SESSION_OK)
      if (url.includes('/attachments')) {
        return jsonResponse(409, { error: 'napkin already exists for this session' })
      }
      throw new Error(`unexpected url ${url}`)
    })

    const result = await submitIntake({
      type: 'website',
      account: { email: 'v@x.com' },
      formData: {},
      submittedAt: '2026-05-24',
      napkin: {
        png: TINY_PNG_DATA_URL,
        text: '',
        savedAt: '',
        scene: { elements: [] },
      },
    })

    expect(result.napkinUploadError).toBeUndefined()
  })
})
