/**
 * /api/health — shallow + deep readiness probes.
 *
 * Coverage focus:
 *   - Shallow (no ?deep=1): unchanged shape, public, D1-only.
 *   - Deep (?deep=1): admin-gated. Runs probes in parallel. Reports
 *     'unconfigured' for missing bindings, 'ok'/'fail' for the rest.
 *   - Overall ok flag: true when every configured probe is ok;
 *     unconfigured probes are neutral.
 *   - Stripe E2E_STUB sentinel reports unconfigured (don't noise the
 *     e2e harness).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeMockEnv } from '../../tests/d1-mock'

vi.mock('../_lib/auth', () => ({
  currentEmail: vi.fn(),
}))

import { currentEmail } from '../_lib/auth'
import { onRequest } from './health'

const mockedCurrentEmail = vi.mocked(currentEmail)

function makeCtx(path: string, opts: { asEmail?: string | null } = {}) {
  const env = makeMockEnv({ MEDIA: undefined, STRIPE_SECRET_KEY: undefined })
  if (opts.asEmail !== undefined) {
    mockedCurrentEmail.mockResolvedValue(opts.asEmail)
  } else {
    mockedCurrentEmail.mockResolvedValue(null)
  }
  return {
    request: new Request(`https://x.test${path}`),
    env,
    params: {},
  } as Parameters<typeof onRequest>[0]
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

// ────────────────────────────────────────────────────────────────────────────
// Shallow probe — unchanged contract, public.
// ────────────────────────────────────────────────────────────────────────────

describe('GET /api/health — shallow (default)', () => {
  it('returns ok:true and db:ok when D1 responds', async () => {
    const ctx = makeCtx('/api/health')
    const res = await onRequest(ctx)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { ok: boolean; db: string; deep?: unknown }
    expect(body.ok).toBe(true)
    expect(body.db).toBe('ok')
    // Shallow probe MUST NOT include the deep field.
    expect(body.deep).toBeUndefined()
  })

  it('does not call currentEmail (probe is public)', async () => {
    const ctx = makeCtx('/api/health')
    await onRequest(ctx)
    expect(mockedCurrentEmail).not.toHaveBeenCalled()
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Deep probe — admin-gated.
// ────────────────────────────────────────────────────────────────────────────

describe('GET /api/health?deep=1 — auth', () => {
  it('returns 401 when not signed in', async () => {
    const ctx = makeCtx('/api/health?deep=1', { asEmail: null })
    const res = await onRequest(ctx)
    expect(res.status).toBe(401)
  })

  it('returns 403 for a non-admin', async () => {
    const ctx = makeCtx('/api/health?deep=1', { asEmail: 'visitor@x.com' })
    const res = await onRequest(ctx)
    expect(res.status).toBe(403)
  })
})

describe('GET /api/health?deep=1 — probe shape', () => {
  it('reports every binding as unconfigured when none are set', async () => {
    const ctx = makeCtx('/api/health?deep=1', { asEmail: 'marc@x.com' })
    // env defaults already strip MEDIA + STRIPE_SECRET_KEY; clear RESEND too.
    ctx.env.RESEND_API_KEY = ''
    const res = await onRequest(ctx)
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      ok: boolean
      deep: Record<string, { status: string }>
    }
    expect(body.ok).toBe(true)
    expect(body.deep.db.status).toBe('ok')
    expect(body.deep.r2.status).toBe('unconfigured')
    expect(body.deep.resend.status).toBe('unconfigured')
    expect(body.deep.stripe.status).toBe('unconfigured')
  })

  it('reports the Stripe e2e stub key as unconfigured (avoids harness noise)', async () => {
    const ctx = makeCtx('/api/health?deep=1', { asEmail: 'marc@x.com' })
    ctx.env.STRIPE_SECRET_KEY = 'sk_test_e2e_stub'
    ctx.env.RESEND_API_KEY = ''
    const res = await onRequest(ctx)
    const body = (await res.json()) as { deep: { stripe: { status: string } } }
    expect(body.deep.stripe.status).toBe('unconfigured')
  })

  it('probes R2 via list({ limit: 1 }) when MEDIA is configured', async () => {
    const ctx = makeCtx('/api/health?deep=1', { asEmail: 'marc@x.com' })
    const listSpy = vi.fn().mockResolvedValue({ objects: [] })
    ctx.env.MEDIA = { list: listSpy } as unknown as R2Bucket
    ctx.env.RESEND_API_KEY = ''
    const res = await onRequest(ctx)
    expect(listSpy).toHaveBeenCalledOnce()
    expect(listSpy.mock.calls[0]?.[0]).toEqual({ limit: 1 })
    const body = (await res.json()) as { deep: { r2: { status: string; latencyMs: number } } }
    expect(body.deep.r2.status).toBe('ok')
    expect(typeof body.deep.r2.latencyMs).toBe('number')
  })

  it('reports R2 fail when list throws', async () => {
    const ctx = makeCtx('/api/health?deep=1', { asEmail: 'marc@x.com' })
    ctx.env.MEDIA = {
      list: vi.fn().mockRejectedValue(new Error('R2 unavailable')),
    } as unknown as R2Bucket
    ctx.env.RESEND_API_KEY = ''
    const res = await onRequest(ctx)
    expect(res.status).toBe(500)
    const body = (await res.json()) as {
      ok: boolean
      deep: { r2: { status: string; error: string } }
    }
    expect(body.ok).toBe(false)
    expect(body.deep.r2.status).toBe('fail')
    expect(body.deep.r2.error).toContain('R2 unavailable')
  })

  it('probes Resend via GET /domains with the bearer token', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchSpy)
    const ctx = makeCtx('/api/health?deep=1', { asEmail: 'marc@x.com' })
    ctx.env.RESEND_API_KEY = 're_test_key'
    await onRequest(ctx)
    const resendCall = fetchSpy.mock.calls.find((c) =>
      String(c[0]).includes('api.resend.com/domains'),
    )
    expect(resendCall).toBeTruthy()
    const headers = (resendCall?.[1] as RequestInit)?.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer re_test_key')
  })

  it('reports Resend fail on non-2xx', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response('unauthorized', { status: 401 }))
    vi.stubGlobal('fetch', fetchSpy)
    const ctx = makeCtx('/api/health?deep=1', { asEmail: 'marc@x.com' })
    ctx.env.RESEND_API_KEY = 're_bad_key'
    const res = await onRequest(ctx)
    expect(res.status).toBe(500)
    const body = (await res.json()) as { deep: { resend: { status: string; error: string } } }
    expect(body.deep.resend.status).toBe('fail')
    expect(body.deep.resend.error).toBe('401')
  })

  it('probes Stripe via GET /v1/balance', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchSpy)
    const ctx = makeCtx('/api/health?deep=1', { asEmail: 'marc@x.com' })
    ctx.env.RESEND_API_KEY = ''
    ctx.env.STRIPE_SECRET_KEY = 'sk_test_real'
    await onRequest(ctx)
    const stripeCall = fetchSpy.mock.calls.find((c) =>
      String(c[0]).includes('api.stripe.com/v1/balance'),
    )
    expect(stripeCall).toBeTruthy()
    const body = (await (await onRequest(ctx)).json()) as {
      deep: { stripe: { status: string } }
    }
    expect(body.deep.stripe.status).toBe('ok')
  })

  it('overall ok=true when all configured probes pass + others unconfigured', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchSpy)
    const ctx = makeCtx('/api/health?deep=1', { asEmail: 'marc@x.com' })
    ctx.env.MEDIA = { list: vi.fn().mockResolvedValue({ objects: [] }) } as unknown as R2Bucket
    ctx.env.RESEND_API_KEY = 're_ok'
    ctx.env.STRIPE_SECRET_KEY = 'sk_test_real'
    const res = await onRequest(ctx)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { ok: boolean }
    expect(body.ok).toBe(true)
  })
})
