import { describe, expect, it } from 'vitest'
import { D1Mock } from '../../tests/d1-mock'
import type { D1Database } from '@cloudflare/workers-types'
import { getLang, getLangExplicit, isValidLang, setLang, setLangIfAbsent } from './userPrefs'

function db(): D1Database {
  return new D1Mock() as unknown as D1Database
}

describe('isValidLang', () => {
  it('accepts fr and en', () => {
    expect(isValidLang('fr')).toBe(true)
    expect(isValidLang('en')).toBe(true)
  })
  it('rejects everything else', () => {
    expect(isValidLang('de')).toBe(false)
    expect(isValidLang('')).toBe(false)
    expect(isValidLang(null)).toBe(false)
    expect(isValidLang(undefined)).toBe(false)
    expect(isValidLang(1)).toBe(false)
  })
})

describe('getLang fallback chain', () => {
  it('falls back to fr when nothing is stored', async () => {
    const d = db()
    expect(await getLang(d, 'nobody@x.com')).toBe('fr')
  })

  it('returns user_prefs.lang when set', async () => {
    const d = db()
    await setLang(d, 'visitor@x.com', 'en')
    expect(await getLang(d, 'visitor@x.com')).toBe('en')
  })

  it('lowercases the email key', async () => {
    const d = db()
    await setLang(d, 'Visitor@X.com', 'en')
    expect(await getLang(d, 'visitor@x.com')).toBe('en')
    expect(await getLang(d, 'VISITOR@X.COM')).toBe('en')
  })

  it('falls back to latest session intake_json.lang when user_prefs missing', async () => {
    const d = db()
    const mock = d as unknown as D1Mock
    mock.sessions.set('s1', {
      id: 's1',
      email: 'visitor@x.com',
      intake_json: JSON.stringify({ lang: 'en' }),
      status: 'draft',
      created_at: 100,
      updated_at: 100,
      deleted_at: null,
      status_history: null,
      showcased_at: null,
      showcase_title: null,
      showcase_tagline: null,
    })
    expect(await getLang(d, 'visitor@x.com')).toBe('en')
  })

  it('uses the most recently updated session when multiple exist', async () => {
    const d = db()
    const mock = d as unknown as D1Mock
    mock.sessions.set('s_old', {
      id: 's_old',
      email: 'visitor@x.com',
      intake_json: JSON.stringify({ lang: 'fr' }),
      status: 'draft',
      created_at: 100,
      updated_at: 100,
      deleted_at: null,
      status_history: null,
      showcased_at: null,
      showcase_title: null,
      showcase_tagline: null,
    })
    mock.sessions.set('s_new', {
      id: 's_new',
      email: 'visitor@x.com',
      intake_json: JSON.stringify({ lang: 'en' }),
      status: 'draft',
      created_at: 200,
      updated_at: 200,
      deleted_at: null,
      status_history: null,
      showcased_at: null,
      showcase_title: null,
      showcase_tagline: null,
    })
    expect(await getLang(d, 'visitor@x.com')).toBe('en')
  })

  it('explicit pref beats intake_json fallback', async () => {
    const d = db()
    const mock = d as unknown as D1Mock
    mock.sessions.set('s1', {
      id: 's1',
      email: 'visitor@x.com',
      intake_json: JSON.stringify({ lang: 'en' }),
      status: 'draft',
      created_at: 100,
      updated_at: 100,
      deleted_at: null,
      status_history: null,
      showcased_at: null,
      showcase_title: null,
      showcase_tagline: null,
    })
    await setLang(d, 'visitor@x.com', 'fr')
    expect(await getLang(d, 'visitor@x.com')).toBe('fr')
  })

  it('falls back to fr for an empty email', async () => {
    const d = db()
    expect(await getLang(d, '')).toBe('fr')
    expect(await getLang(d, '   ')).toBe('fr')
  })

  it('falls back to fr when intake_json has an unknown lang', async () => {
    const d = db()
    const mock = d as unknown as D1Mock
    mock.sessions.set('s1', {
      id: 's1',
      email: 'visitor@x.com',
      intake_json: JSON.stringify({ lang: 'pt' }),
      status: 'draft',
      created_at: 100,
      updated_at: 100,
      deleted_at: null,
      status_history: null,
      showcased_at: null,
      showcase_title: null,
      showcase_tagline: null,
    })
    expect(await getLang(d, 'visitor@x.com')).toBe('fr')
  })

  it('falls back to fr when intake_json is malformed', async () => {
    const d = db()
    const mock = d as unknown as D1Mock
    mock.sessions.set('s1', {
      id: 's1',
      email: 'visitor@x.com',
      intake_json: '{not json',
      status: 'draft',
      created_at: 100,
      updated_at: 100,
      deleted_at: null,
      status_history: null,
      showcased_at: null,
      showcase_title: null,
      showcase_tagline: null,
    })
    expect(await getLang(d, 'visitor@x.com')).toBe('fr')
  })
})

describe('getLangExplicit', () => {
  it('returns null when nothing is stored (lets caller distinguish from fr default)', async () => {
    const d = db()
    expect(await getLangExplicit(d, 'nobody@x.com')).toBeNull()
  })

  it('returns the user_prefs lang when set', async () => {
    const d = db()
    await setLang(d, 'a@b.com', 'fr')
    expect(await getLangExplicit(d, 'a@b.com')).toBe('fr')
  })

  it('returns intake_json lang as the legacy fallback', async () => {
    const d = db()
    const mock = d as unknown as D1Mock
    mock.sessions.set('s1', {
      id: 's1',
      email: 'visitor@x.com',
      intake_json: JSON.stringify({ lang: 'en' }),
      status: 'draft',
      created_at: 100,
      updated_at: 100,
      deleted_at: null,
      status_history: null,
      showcased_at: null,
      showcase_title: null,
      showcase_tagline: null,
    })
    expect(await getLangExplicit(d, 'visitor@x.com')).toBe('en')
  })

  it('returns null when intake_json is malformed (no false positives)', async () => {
    const d = db()
    const mock = d as unknown as D1Mock
    mock.sessions.set('s1', {
      id: 's1',
      email: 'visitor@x.com',
      intake_json: '{not json',
      status: 'draft',
      created_at: 100,
      updated_at: 100,
      deleted_at: null,
      status_history: null,
      showcased_at: null,
      showcase_title: null,
      showcase_tagline: null,
    })
    expect(await getLangExplicit(d, 'visitor@x.com')).toBeNull()
  })
})

describe('setLang', () => {
  it('upserts — second call overwrites first', async () => {
    const d = db()
    await setLang(d, 'a@b.com', 'fr')
    expect(await getLang(d, 'a@b.com')).toBe('fr')
    await setLang(d, 'a@b.com', 'en')
    expect(await getLang(d, 'a@b.com')).toBe('en')
  })

  it('noop on empty email', async () => {
    const d = db()
    await setLang(d, '', 'en')
    expect(await getLang(d, '')).toBe('fr')
  })
})

describe('setLangIfAbsent', () => {
  it('seeds when missing', async () => {
    const d = db()
    await setLangIfAbsent(d, 'a@b.com', 'en')
    expect(await getLang(d, 'a@b.com')).toBe('en')
  })

  it('does not overwrite an explicit choice', async () => {
    const d = db()
    await setLang(d, 'a@b.com', 'fr')
    await setLangIfAbsent(d, 'a@b.com', 'en')
    expect(await getLang(d, 'a@b.com')).toBe('fr')
  })
})
