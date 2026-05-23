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
  // Real implementation — the handler appends this string verbatim onto
  // the response's Set-Cookie header, and one test asserts on the value.
  // Mocking it would force the assertion to encode the cookie shape twice.
  setLangCookieHeader: (lang: 'fr' | 'en') =>
    `mp_lang=${lang}; Path=/; Secure; SameSite=Lax; Max-Age=${365 * 24 * 60 * 60}`,
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

  it('returns fr + null firstName for a fresh account (no row, no fallback)', async () => {
    mockedCurrentEmail.mockResolvedValue('fresh@x.com')
    const env = makeMockEnv()
    const res = await getPrefs({
      request: req('https://x.test/api/me/prefs'),
      env,
      params: {},
    } as never)
    expect(res.status).toBe(200)
    const data = (await res.json()) as { lang: string; firstName: string | null }
    expect(data.lang).toBe('fr')
    expect(data.firstName).toBeNull()
  })

  it('returns the stored lang and firstName once a pref exists', async () => {
    mockedCurrentEmail.mockResolvedValue('marc@x.com')
    const env = makeMockEnv()
    const mock = env._db as D1Mock
    mock.user_prefs.set('marc@x.com', {
      email: 'marc@x.com',
      lang: 'en',
      first_name: 'Marc',
      updated_at: 100,
    })
    const res = await getPrefs({
      request: req('https://x.test/api/me/prefs'),
      env,
      params: {},
    } as never)
    const data = (await res.json()) as { lang: string; firstName: string | null }
    expect(data.lang).toBe('en')
    expect(data.firstName).toBe('Marc')
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

  it('400 when body has neither lang nor firstName', async () => {
    mockedCurrentEmail.mockResolvedValue('visitor@x.com')
    const env = makeMockEnv()
    const res = await patchPrefs({
      request: req('https://x.test/api/me/prefs', {
        method: 'PATCH',
        body: JSON.stringify({}),
      }),
      env,
      params: {},
    } as never)
    expect(res.status).toBe(400)
  })

  it('400 when firstName is too long', async () => {
    mockedCurrentEmail.mockResolvedValue('visitor@x.com')
    const env = makeMockEnv()
    const res = await patchPrefs({
      request: req('https://x.test/api/me/prefs', {
        method: 'PATCH',
        body: JSON.stringify({ firstName: 'x'.repeat(81) }),
      }),
      env,
      params: {},
    } as never)
    expect(res.status).toBe(400)
  })

  it('persists firstName; GET reflects the change', async () => {
    mockedCurrentEmail.mockResolvedValue('visitor@x.com')
    const env = makeMockEnv()
    const patchRes = await patchPrefs({
      request: req('https://x.test/api/me/prefs', {
        method: 'PATCH',
        body: JSON.stringify({ firstName: '  Marc  ' }),
      }),
      env,
      params: {},
    } as never)
    expect(patchRes.status).toBe(200)
    const data = (await patchRes.json()) as { firstName: string | null }
    expect(data.firstName).toBe('Marc')

    const mock = env._db as D1Mock
    expect(mock.user_prefs.get('visitor@x.com')?.first_name).toBe('Marc')
  })

  it('clearing firstName with null sets it back to null', async () => {
    mockedCurrentEmail.mockResolvedValue('visitor@x.com')
    const env = makeMockEnv()
    const mock = env._db as D1Mock
    mock.user_prefs.set('visitor@x.com', {
      email: 'visitor@x.com',
      lang: 'fr',
      first_name: 'Marc',
      updated_at: 100,
    })
    await patchPrefs({
      request: req('https://x.test/api/me/prefs', {
        method: 'PATCH',
        body: JSON.stringify({ firstName: null }),
      }),
      env,
      params: {},
    } as never)
    expect(mock.user_prefs.get('visitor@x.com')?.first_name).toBeNull()
  })

  it('sets mp_lang cookie on lang change', async () => {
    mockedCurrentEmail.mockResolvedValue('visitor@x.com')
    const env = makeMockEnv()
    const res = await patchPrefs({
      request: req('https://x.test/api/me/prefs', {
        method: 'PATCH',
        body: JSON.stringify({ lang: 'en' }),
      }),
      env,
      params: {},
    } as never)
    expect(res.status).toBe(200)
    const setCookie = res.headers.get('Set-Cookie') ?? ''
    expect(setCookie).toMatch(/mp_lang=en/)
  })

  it('does NOT set mp_lang cookie on a firstName-only PATCH', async () => {
    mockedCurrentEmail.mockResolvedValue('visitor@x.com')
    const env = makeMockEnv()
    const res = await patchPrefs({
      request: req('https://x.test/api/me/prefs', {
        method: 'PATCH',
        body: JSON.stringify({ firstName: 'Marc' }),
      }),
      env,
      params: {},
    } as never)
    const setCookie = res.headers.get('Set-Cookie') ?? ''
    expect(setCookie).not.toMatch(/mp_lang/)
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
