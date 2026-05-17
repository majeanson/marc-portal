/**
 * POST /api/payments/checkout integration tests.
 *
 * Stripe REST is mocked (we don't fetch the real API in tests). Auth + D1
 * use the same patterns as session-handlers.test.ts. The Locale contract
 * is part of the assertion surface — fr-CA is required for QC visitors
 * (Bill 96 / OQLF).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as StripeLib from '../../_lib/stripe'
import { makeMockEnv } from '../../../tests/d1-mock'

vi.mock('../../_lib/auth', () => ({
  currentEmail: vi.fn(),
}))

vi.mock('../../_lib/stripe', async () => {
  const real = await vi.importActual<typeof StripeLib>('../../_lib/stripe')
  return {
    ...real,
    createOneTimeCheckoutSession: vi.fn(),
    createSubscriptionCheckoutSession: vi.fn(),
  }
})

import { currentEmail } from '../../_lib/auth'
import {
  createOneTimeCheckoutSession,
  createSubscriptionCheckoutSession,
} from '../../_lib/stripe'
import { onRequestPost } from './checkout'

const mockedCurrentEmail = vi.mocked(currentEmail)
const mockedOneTime = vi.mocked(createOneTimeCheckoutSession)
const mockedSub = vi.mocked(createSubscriptionCheckoutSession)

beforeEach(() => {
  vi.clearAllMocks()
  mockedOneTime.mockResolvedValue({ id: 'cs_test_abc', url: 'https://checkout.stripe.com/x' })
  mockedSub.mockResolvedValue({ id: 'cs_test_sub', url: 'https://checkout.stripe.com/sub' })
})

function buildEnv(over: Record<string, unknown> = {}) {
  return makeMockEnv({
    STRIPE_SECRET_KEY: 'sk_test_xxx',
    STRIPE_CUSTODIAN_PRICE_ID: 'price_test_xxx',
    ...over,
  })
}

function seedSession(env: ReturnType<typeof buildEnv>, over: Record<string, unknown> = {}) {
  const id = (over.id as string) ?? 'sess_test'
  env._db.sessions.set(id, {
    id,
    email: (over.email as string) ?? 'visitor@x.com',
    intake_json: null,
    status: 'active',
    created_at: 1700000000,
    updated_at: 1700000000,
    deleted_at: null,
    status_history: null,
    showcased_at: null,
    showcase_title: null,
    showcase_tagline: null,
    ...over,
  })
  return id
}

function postCheckout(env: ReturnType<typeof buildEnv>, body: unknown) {
  return {
    request: new Request('https://portal.test/api/payments/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    env,
    params: {},
  }
}

describe('POST /api/payments/checkout — tier1 (visitor)', () => {
  it('mints a payment row, calls Stripe with fr-CA, returns the URL', async () => {
    const env = buildEnv()
    const sessionId = seedSession(env)
    mockedCurrentEmail.mockResolvedValue('visitor@x.com')

    const res = await onRequestPost(
      postCheckout(env, { sessionId, kind: 'tier1', lang: 'fr' }) as never,
    )
    expect(res.status).toBe(200)
    const json = (await res.json()) as { url: string; paymentId: string }
    expect(json.url).toBe('https://checkout.stripe.com/x')
    expect(json.paymentId).toMatch(/^pay_/)

    // Stripe call shape
    expect(mockedOneTime).toHaveBeenCalledOnce()
    const args = mockedOneTime.mock.calls[0]![0]
    expect(args.amountCents).toBe(30000)
    expect(args.kind).toBe('tier1')
    expect(args.lang).toBe('fr')
    expect(args.visitorEmail).toBe('visitor@x.com')
    expect(args.successUrl).toContain('?paid=1')
    expect(args.cancelUrl).toContain('?paid=0')

    // D1 row written
    const row = [...env._db.payments.values()][0]
    expect(row?.kind).toBe('tier1')
    expect(row?.amount_cents).toBe(30000)
    expect(row?.stripe_checkout_session_id).toBe('cs_test_abc')
  })
})

describe('POST /api/payments/checkout — tier2-deposit', () => {
  it('mints with the deposit amount (75000 cents)', async () => {
    const env = buildEnv()
    const sessionId = seedSession(env)
    mockedCurrentEmail.mockResolvedValue('visitor@x.com')

    await onRequestPost(
      postCheckout(env, { sessionId, kind: 'tier2-deposit', lang: 'fr' }) as never,
    )
    expect(mockedOneTime.mock.calls[0]![0].amountCents).toBe(75000)
    expect(mockedOneTime.mock.calls[0]![0].kind).toBe('tier2-deposit')
  })

  it('mints with the final amount (75000 cents) for tier2-final', async () => {
    const env = buildEnv()
    const sessionId = seedSession(env)
    mockedCurrentEmail.mockResolvedValue('visitor@x.com')

    await onRequestPost(
      postCheckout(env, { sessionId, kind: 'tier2-final', lang: 'fr' }) as never,
    )
    expect(mockedOneTime.mock.calls[0]![0].amountCents).toBe(75000)
    expect(mockedOneTime.mock.calls[0]![0].kind).toBe('tier2-final')
  })
})

describe('POST /api/payments/checkout — custodian-sub', () => {
  it('routes to the subscription path with the configured price id', async () => {
    const env = buildEnv()
    const sessionId = seedSession(env)
    mockedCurrentEmail.mockResolvedValue('visitor@x.com')

    const res = await onRequestPost(
      postCheckout(env, { sessionId, kind: 'custodian-sub', lang: 'fr' }) as never,
    )
    expect(res.status).toBe(200)
    expect(mockedSub).toHaveBeenCalledOnce()
    expect(mockedOneTime).not.toHaveBeenCalled()
    expect(mockedSub.mock.calls[0]![0].priceId).toBe('price_test_xxx')
  })

  it('returns 503 when STRIPE_CUSTODIAN_PRICE_ID is missing', async () => {
    const env = buildEnv({ STRIPE_CUSTODIAN_PRICE_ID: undefined })
    const sessionId = seedSession(env)
    mockedCurrentEmail.mockResolvedValue('visitor@x.com')

    const res = await onRequestPost(
      postCheckout(env, { sessionId, kind: 'custodian-sub', lang: 'fr' }) as never,
    )
    expect(res.status).toBe(503)
  })
})

describe('POST /api/payments/checkout — gating', () => {
  it('returns 401 with no session cookie', async () => {
    const env = buildEnv()
    seedSession(env)
    mockedCurrentEmail.mockResolvedValue(null)

    const res = await onRequestPost(
      postCheckout(env, { sessionId: 'sess_test', kind: 'tier1', lang: 'fr' }) as never,
    )
    expect(res.status).toBe(401)
  })

  it('returns 503 when STRIPE_SECRET_KEY is missing', async () => {
    const env = buildEnv({ STRIPE_SECRET_KEY: undefined })
    seedSession(env)
    mockedCurrentEmail.mockResolvedValue('visitor@x.com')

    const res = await onRequestPost(
      postCheckout(env, { sessionId: 'sess_test', kind: 'tier1', lang: 'fr' }) as never,
    )
    expect(res.status).toBe(503)
  })

  it('returns 404 when the session does not exist', async () => {
    const env = buildEnv()
    mockedCurrentEmail.mockResolvedValue('visitor@x.com')

    const res = await onRequestPost(
      postCheckout(env, { sessionId: 'sess_missing', kind: 'tier1', lang: 'fr' }) as never,
    )
    expect(res.status).toBe(404)
  })

  it('returns 403 when the caller is not the session owner and not admin', async () => {
    const env = buildEnv()
    seedSession(env, { email: 'someone-else@x.com' })
    mockedCurrentEmail.mockResolvedValue('intruder@x.com')

    const res = await onRequestPost(
      postCheckout(env, { sessionId: 'sess_test', kind: 'tier1', lang: 'fr' }) as never,
    )
    expect(res.status).toBe(403)
  })

  it('returns 400 on invalid kind', async () => {
    const env = buildEnv()
    seedSession(env)
    mockedCurrentEmail.mockResolvedValue('visitor@x.com')

    const res = await onRequestPost(
      postCheckout(env, { sessionId: 'sess_test', kind: 'bogus', lang: 'fr' }) as never,
    )
    expect(res.status).toBe(400)
  })
})

describe('POST /api/payments/checkout — admin tier3 override', () => {
  it('admin can override tier3 amount within bounds', async () => {
    const env = buildEnv({ ADMIN_EMAILS: 'marc@x.com' })
    seedSession(env, { id: 'sess_test', email: 'visitor@x.com' })
    mockedCurrentEmail.mockResolvedValue('marc@x.com')

    await onRequestPost(
      postCheckout(env, {
        sessionId: 'sess_test',
        kind: 'tier3',
        lang: 'fr',
        amountCadOverride: 5000,
      }) as never,
    )
    expect(mockedOneTime.mock.calls[0]![0].amountCents).toBe(500_000)
  })

  it('admin override out of range → 400', async () => {
    const env = buildEnv({ ADMIN_EMAILS: 'marc@x.com' })
    seedSession(env)
    mockedCurrentEmail.mockResolvedValue('marc@x.com')

    const res = await onRequestPost(
      postCheckout(env, {
        sessionId: 'sess_test',
        kind: 'tier3',
        lang: 'fr',
        amountCadOverride: 99,
      }) as never,
    )
    expect(res.status).toBe(400)
  })
})
