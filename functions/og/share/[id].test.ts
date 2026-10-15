/**
 * /og/share/:id — dynamic per-project OG card.
 *
 * Coverage:
 *   - missing id → fallback redirect (302)
 *   - session not found → fallback redirect
 *   - soft-deleted session → fallback redirect
 *   - non-showcased session → fallback redirect
 *   - debug mode returns JSON (not a PNG) with the resolved fields
 *
 * The actual workers-og PNG render is NOT exercised in unit tests (requires
 * the satori/resvg WASM runtime). Snapshot tests on the rendered PNG bytes
 * are a separate concern — listed as P3.13 in AUDIT.md.
 */

import { describe, expect, it, vi } from 'vitest'
import { makeMockEnv } from '../../../tests/d1-mock'

// workers-og imports satori + resvg WASM at module load; mock the package
// out completely so the test runtime never tries to bootstrap them. The
// arrayBuffer stub stands in for the rendered PNG so the R2 read-through
// path (og-cache) can be exercised without a real render.
vi.mock('workers-og', () => ({
  ImageResponse: class {
    constructor(
      public html: string,
      public init: { width: number; height: number },
    ) {}
    async arrayBuffer(): Promise<ArrayBuffer> {
      return new ArrayBuffer(32)
    }
  },
}))

// The font loader fetches /fonts/*.ttf from the request origin, which does
// not exist under happy-dom; the mocked ImageResponse above ignores fonts
// anyway, so stub the loader out.
vi.mock('../../_lib/og-fonts', () => ({
  loadOgFonts: async () => [],
}))

import { onRequestGet } from './[id]'

function ctx(
  id: string,
  envOver: Record<string, unknown> = {},
  search = '',
): Parameters<typeof onRequestGet>[0] {
  return {
    request: new Request(`https://x.test/og/share/${id}${search}`, { method: 'GET' }),
    env: makeMockEnv(envOver),
    params: { id },
  } as unknown as Parameters<typeof onRequestGet>[0]
}

describe('GET /og/share/:id', () => {
  it('redirects to fallback when id is empty', async () => {
    const c = ctx('', {})
    c.params = { id: '' }
    const res = await onRequestGet(c)
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toContain('/og-image.png')
    expect(res.headers.get('x-og-fallback')).toBe('missing-id')
  })

  it('redirects to fallback when session is not found', async () => {
    const res = await onRequestGet(ctx('ghost'))
    expect(res.status).toBe(302)
    expect(res.headers.get('x-og-fallback')).toBe('not-showcased-or-missing')
  })

  it('redirects to fallback when session is soft-deleted', async () => {
    const c = ctx('s1')
    // Seed a deleted session
    ;(c.env as ReturnType<typeof makeMockEnv>)._db.sessions.set('s1', {
      id: 's1',
      email: 'a@x.com',
      intake_json: null,
      status: 'shipped',
      created_at: 1,
      updated_at: 1,
      deleted_at: 100,
      status_history: null,
      showcased_at: 2,
      showcase_title: 't',
      showcase_tagline: 'g',
    })
    const res = await onRequestGet(c)
    expect(res.status).toBe(302)
    expect(res.headers.get('x-og-fallback')).toBe('not-showcased-or-missing')
  })

  it('redirects to fallback when session is not showcased', async () => {
    const c = ctx('s2')
    ;(c.env as ReturnType<typeof makeMockEnv>)._db.sessions.set('s2', {
      id: 's2',
      email: 'a@x.com',
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
    const res = await onRequestGet(c)
    expect(res.status).toBe(302)
    expect(res.headers.get('x-og-fallback')).toBe('not-showcased-or-missing')
  })

  it('debug=1 returns JSON with resolved fields on a happy showcase', async () => {
    const c = ctx('s3', {}, '?debug=1')
    ;(c.env as ReturnType<typeof makeMockEnv>)._db.sessions.set('s3', {
      id: 's3',
      email: 'a@x.com',
      intake_json: null,
      status: 'shipped',
      created_at: 1,
      updated_at: 1,
      deleted_at: null,
      status_history: null,
      showcased_at: 2,
      showcase_title: 'Truck Notes',
      showcase_tagline: 'Voice → invoice',
    })
    const res = await onRequestGet(c)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('application/json')
    const body = (await res.json()) as { ok: boolean; fields: { title: string } }
    expect(body.ok).toBe(true)
    expect(body.fields.title).toBe('Truck Notes')
  })

  it('debug=1 surfaces the reason on missing showcase', async () => {
    const res = await onRequestGet(ctx('ghost', {}, '?debug=1'))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { ok: boolean; reason: string }
    expect(body.ok).toBe(false)
    expect(body.reason).toBe('not-showcased-or-missing')
  })

  it('renders once into R2, then serves the stored PNG (x-og-cache: r2)', async () => {
    const store = new Map<string, ArrayBuffer>()
    const media = {
      async get(key: string) {
        const v = store.get(key)
        return v ? { arrayBuffer: async () => v } : null
      },
      async put(key: string, val: ArrayBuffer) {
        store.set(key, val)
      },
    }
    const seed = (c: ReturnType<typeof ctx>) => {
      ;(c.env as ReturnType<typeof makeMockEnv>)._db.sessions.set('s4', {
        id: 's4',
        email: 'a@x.com',
        intake_json: null,
        status: 'shipped',
        created_at: 1,
        updated_at: 77,
        deleted_at: null,
        status_history: null,
        showcased_at: 2,
        showcase_title: 'Horizon',
        showcase_tagline: 'Quand la retraite ?',
      })
    }

    const c1 = ctx('s4', { MEDIA: media })
    seed(c1)
    const first = await onRequestGet(c1)
    expect(first.status).toBe(200)
    expect(first.headers.get('content-type')).toBe('image/png')
    expect(first.headers.get('x-og-cache')).toBe('render')
    // The key embeds updated_at so copy edits mint a new object.
    expect([...store.keys()]).toEqual(['og/share/s4-fr-77.png'])

    const c2 = ctx('s4', { MEDIA: media })
    seed(c2)
    const second = await onRequestGet(c2)
    expect(second.status).toBe(200)
    expect(second.headers.get('x-og-cache')).toBe('r2')
  })
})
