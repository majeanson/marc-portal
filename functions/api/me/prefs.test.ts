/**
 * Account-prefs API.
 *
 * Coverage:
 *  - GET requires auth (401 otherwise)
 *  - GET returns the stored lang (with fr fallback for fresh accounts)
 *  - PATCH requires CSRF
 *  - PATCH validates lang ∈ {fr, en}
 *  - PATCH persists; subsequent GET reflects the change
 *
 * Mirrors session-handlers.test.ts: auth is mocked at the module level so
 * the tests don't have to round-trip cookies through the test harness's
 * Request constructor (which strips Cookie headers in jsdom).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeMockEnv } from '../../../tests/d1-mock'
import type { D1Mock } from '../../../tests/d1-mock'

vi.mock('../../_lib/auth', () => ({
  currentEmail: vi.fn(),
  // CSRF goes through requireCsrf; we mock it as a passthrough so the
  // handler runs. The 403-on-missing-csrf path is exercised by overriding
  // this in one test.
  requireCsrf: vi.fn(() => null),
}))

import { currentEmail, requireCsrf } from '../../_lib/auth'
import { onRequestGet as getPrefs, onRequestPatch as patchPrefs } from './prefs'

const mockedCurrentEmail = vi.mocked(currentEmail)
const mockedRequireCsrf = vi.mocked(requireCsrf)

beforeEach(() => {
  vi.clearAllMocks()
  mockedRequireCsrf.mockReturnValue(null)
})

function req(url: string, init: RequestInit = {}): Request {
  const headers = new Headers(init.headers)
  if (init.body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json')
  }
  return new Request(url, { ...init, headers })
}

describe('GET /api/me/prefs', () => {
  it('401 when unauthenticated', async () => {
    mockedCurrentEmail.mockResolvedValue(null)
    const env = makeMockEnv()
    const res = await getPrefs({
      request: req('https://x.test/api/me/prefs'),
      env,
      params: {},
    } as never)
    expect(res.status).toBe(401)
  })

  it('returns fr for a fresh account (no row, no fallback)', async () => {
    mockedCurrentEmail.mockResolvedValue('fresh@x.com')
    const env = makeMockEnv()
    const res = await getPrefs({
      request: req('https://x.test/api/me/prefs'),
      env,
      params: {},
    } as never)
    expect(res.status).toBe(200)
    const data = (await res.json()) as { lang: string }
    expect(data.lang).toBe('fr')
  })

  it('returns the stored lang once a pref exists', async () => {
    mockedCurrentEmail.mockResolvedValue('marc@x.com')
    const env = makeMockEnv()
    const mock = env._db as D1Mock
    mock.user_prefs.set('marc@x.com', { email: 'marc@x.com', lang: 'en', updated_at: 100 })
    const res = await getPrefs({
      request: req('https://x.test/api/me/prefs'),
      env,
      params: {},
    } as never)
    const data = (await res.json()) as { lang: string }
    expect(data.lang).toBe('en')
  })
})

describe('PATCH /api/me/prefs', () => {
  it('403 when CSRF fails', async () => {
    mockedRequireCsrf.mockReturnValue(
      new Response(JSON.stringify({ error: 'csrf check failed' }), { status: 403 }),
    )
    const env = makeMockEnv()
    const res = await patchPrefs({
      request: req('https://x.test/api/me/prefs', {
        method: 'PATCH',
        body: JSON.stringify({ lang: 'en' }),
      }),
      env,
      params: {},
    } as never)
    expect(res.status).toBe(403)
  })

  it('401 when unauthenticated', async () => {
    mockedCurrentEmail.mockResolvedValue(null)
    const env = makeMockEnv()
    const res = await patchPrefs({
      request: req('https://x.test/api/me/prefs', {
        method: 'PATCH',
        body: JSON.stringify({ lang: 'en' }),
      }),
      env,
      params: {},
    } as never)
    expect(res.status).toBe(401)
  })

  it('400 on invalid lang', async () => {
    mockedCurrentEmail.mockResolvedValue('visitor@x.com')
    const env = makeMockEnv()
    const res = await patchPrefs({
      request: req('https://x.test/api/me/prefs', {
        method: 'PATCH',
        body: JSON.stringify({ lang: 'de' }),
      }),
      env,
      params: {},
    } as never)
    expect(res.status).toBe(400)
  })

  it('400 on malformed json', async () => {
    mockedCurrentEmail.mockResolvedValue('visitor@x.com')
    const env = makeMockEnv()
    const res = await patchPrefs({
      request: req('https://x.test/api/me/prefs', {
        method: 'PATCH',
        body: '{not json',
      }),
      env,
      params: {},
    } as never)
    expect(res.status).toBe(400)
  })

  it('persists a valid lang; GET reflects the change', async () => {
    mockedCurrentEmail.mockResolvedValue('visitor@x.com')
    const env = makeMockEnv()

    const patchRes = await patchPrefs({
      request: req('https://x.test/api/me/prefs', {
        method: 'PATCH',
        body: JSON.stringify({ lang: 'en' }),
      }),
      env,
      params: {},
    } as never)
    expect(patchRes.status).toBe(200)
    const patchData = (await patchRes.json()) as { lang: string }
    expect(patchData.lang).toBe('en')

    const getRes = await getPrefs({
      request: req('https://x.test/api/me/prefs'),
      env,
      params: {},
    } as never)
    const getData = (await getRes.json()) as { lang: string }
    expect(getData.lang).toBe('en')

    // And the underlying row is there.
    const mock = env._db as D1Mock
    expect(mock.user_prefs.get('visitor@x.com')?.lang).toBe('en')
  })

  it('upsert: PATCH twice with different langs ends on the latter', async () => {
    mockedCurrentEmail.mockResolvedValue('visitor@x.com')
    const env = makeMockEnv()

    await patchPrefs({
      request: req('https://x.test/api/me/prefs', {
        method: 'PATCH',
        body: JSON.stringify({ lang: 'en' }),
      }),
      env,
      params: {},
    } as never)
    await patchPrefs({
      request: req('https://x.test/api/me/prefs', {
        method: 'PATCH',
        body: JSON.stringify({ lang: 'fr' }),
      }),
      env,
      params: {},
    } as never)

    const mock = env._db as D1Mock
    expect(mock.user_prefs.get('visitor@x.com')?.lang).toBe('fr')
  })
})
