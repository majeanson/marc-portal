/**
 * POST /api/payments/checkout integration tests (pricing v2 — decoupled model).
 *
 * Stripe REST is mocked. The endpoint derives the installment server-side, so
 * the client body is just { sessionId, kind, custodianPlan? }. Auth + D1 use
 * the same patterns as session-handlers.test.ts.
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
import { createOneTimeCheckoutSession, createSubscriptionCheckoutSession } from '../../_lib/stripe'
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
    STRIPE_CUSTODIAN_WATCH_PRICE_ID: 'price_watch_xxx',
    STRIPE_CUSTODIAN_CARE_PRICE_ID: 'price_care_xxx',
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
    tier: 1,
    tier4_amount_cents: null,
    tier3_split: null,
    ...over,
  })
  return id
}

let payCounter = 0
function seedPayment(env: ReturnType<typeof buildEnv>, over: Record<string, unknown>) {
  const id = (over.id as string) ?? `pay_seed_${payCounter++}`
  env._db.payments.set(id, {
    id,
    session_id: 'sess_test',
    kind: 'build',
    tier: null,
    installment_index: null,
    installment_of: null,
    custodian_plan: null,
    amount_cents: 0,
    currency: 'cad',
    status: 'paid',
    stripe_checkout_session_id: null,
    stripe_payment_intent_id: null,
    stripe_subscription_id: null,
    stripe_invoice_id: null,
    stripe_customer_id: null,
    created_at: 1700000000,
    paid_at: 1700000001,
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

describe('POST /api/payments/checkout — build installments', () => {
  it('tier 1 mints a single $750 installment', async () => {
    const env = buildEnv()
    const sessionId = seedSession(env, { tier: 1 })
    mockedCurrentEmail.mockResolvedValue('visitor@x.com')

    const res = await onRequestPost(
      postCheckout(env, { sessionId, kind: 'build', lang: 'fr' }) as never,
    )
    expect(res.status).toBe(200)
    const json = (await res.json()) as { url: string; paymentId: string }
    expect(json.url).toBe('https://checkout.stripe.com/x')

    const args = mockedOneTime.mock.calls[0]![0]
    expect(args.amountCents).toBe(75000)
    expect(args.lang).toBe('fr')
    expect(args.visitorEmail).toBe('visitor@x.com')
    expect(args.meta.kind).toBe('build')
    expect(args.meta.installment_index).toBe('1')
    expect(args.meta.installment_of).toBe('1')
    expect(args.successUrl).toContain('?paid=1')

    const row = [...env._db.payments.values()][0]
    expect(row?.kind).toBe('build')
    expect(row?.tier).toBe(1)
    expect(row?.amount_cents).toBe(75000)
    expect(row?.stripe_checkout_session_id).toBe('cs_test_abc')
  })

  it('tier 2 first leg is the $900 deposit, second leg the $900 balance', async () => {
    const env = buildEnv()
    const sessionId = seedSession(env, { tier: 2 })
    mockedCurrentEmail.mockResolvedValue('visitor@x.com')

    await onRequestPost(postCheckout(env, { sessionId, kind: 'build', lang: 'fr' }) as never)
    expect(mockedOneTime.mock.calls[0]![0].amountCents).toBe(90000)
    expect(mockedOneTime.mock.calls[0]![0].meta.installment_index).toBe('1')

    // Mark leg 1 paid → next checkout resolves to leg 2.
    seedPayment(env, { kind: 'build', status: 'paid', installment_index: 1, installment_of: 2 })
    await onRequestPost(postCheckout(env, { sessionId, kind: 'build', lang: 'fr' }) as never)
    expect(mockedOneTime.mock.calls[1]![0].amountCents).toBe(90000)
    expect(mockedOneTime.mock.calls[1]![0].meta.installment_index).toBe('2')
  })

  it('tier 3 defaults to a 50/50 split', async () => {
    const env = buildEnv()
    const sessionId = seedSession(env, { tier: 3 })
    mockedCurrentEmail.mockResolvedValue('visitor@x.com')

    await onRequestPost(postCheckout(env, { sessionId, kind: 'build', lang: 'fr' }) as never)
    expect(mockedOneTime.mock.calls[0]![0].amountCents).toBe(180000)
    expect(mockedOneTime.mock.calls[0]![0].meta.installment_of).toBe('2')
  })

  it('tier 3 with a 40/40/20 split mints $1440 first', async () => {
    const env = buildEnv()
    const sessionId = seedSession(env, { tier: 3, tier3_split: '40-40-20' })
    mockedCurrentEmail.mockResolvedValue('visitor@x.com')

    await onRequestPost(postCheckout(env, { sessionId, kind: 'build', lang: 'fr' }) as never)
    expect(mockedOneTime.mock.calls[0]![0].amountCents).toBe(144000)
    expect(mockedOneTime.mock.calls[0]![0].meta.installment_of).toBe('3')
  })

  it('returns 409 when every installment is already paid', async () => {
    const env = buildEnv()
    const sessionId = seedSession(env, { tier: 1 })
    seedPayment(env, { kind: 'build', status: 'paid', installment_index: 1, installment_of: 1 })
    mockedCurrentEmail.mockResolvedValue('visitor@x.com')

    const res = await onRequestPost(
      postCheckout(env, { sessionId, kind: 'build', lang: 'fr' }) as never,
    )
    expect(res.status).toBe(409)
  })

  it('returns 400 when the session has no paid tier', async () => {
    const env = buildEnv()
    const sessionId = seedSession(env, { tier: null })
    mockedCurrentEmail.mockResolvedValue('visitor@x.com')

    const res = await onRequestPost(
      postCheckout(env, { sessionId, kind: 'build', lang: 'fr' }) as never,
    )
    expect(res.status).toBe(400)
  })

  it('returns 409 for a Tier 4 build with no quote yet', async () => {
    const env = buildEnv()
    const sessionId = seedSession(env, { tier: 4, tier4_amount_cents: null })
    mockedCurrentEmail.mockResolvedValue('visitor@x.com')

    const res = await onRequestPost(
      postCheckout(env, { sessionId, kind: 'build', lang: 'fr' }) as never,
    )
    expect(res.status).toBe(409)
  })
})

describe('POST /api/payments/checkout — scoping report', () => {
  it('mints a $250 scoping payment', async () => {
    const env = buildEnv()
    const sessionId = seedSession(env, { tier: null, status: 'triage' })
    mockedCurrentEmail.mockResolvedValue('visitor@x.com')

    const res = await onRequestPost(
      postCheckout(env, { sessionId, kind: 'scoping', lang: 'fr' }) as never,
    )
    expect(res.status).toBe(200)
    expect(mockedOneTime.mock.calls[0]![0].amountCents).toBe(25000)
    expect(mockedOneTime.mock.calls[0]![0].meta.kind).toBe('scoping')
  })

  it('credits a paid scoping report against the first build installment', async () => {
    const env = buildEnv()
    const sessionId = seedSession(env, { tier: 1 })
    seedPayment(env, { kind: 'scoping', status: 'paid', amount_cents: 25000 })
    mockedCurrentEmail.mockResolvedValue('visitor@x.com')

    await onRequestPost(postCheckout(env, { sessionId, kind: 'build', lang: 'fr' }) as never)
    // $750 first leg − $250 scoping credit = $500.
    expect(mockedOneTime.mock.calls[0]![0].amountCents).toBe(50000)
  })

  it('refuses a second scoping report once one is paid', async () => {
    const env = buildEnv()
    const sessionId = seedSession(env, { tier: null, status: 'triage' })
    seedPayment(env, { kind: 'scoping', status: 'paid', amount_cents: 25000 })
    mockedCurrentEmail.mockResolvedValue('visitor@x.com')

    const res = await onRequestPost(
      postCheckout(env, { sessionId, kind: 'scoping', lang: 'fr' }) as never,
    )
    expect(res.status).toBe(409)
  })
})

describe('POST /api/payments/checkout — custodian', () => {
  it('Watch routes to the subscription path with the watch price id', async () => {
    const env = buildEnv()
    const sessionId = seedSession(env)
    mockedCurrentEmail.mockResolvedValue('visitor@x.com')

    const res = await onRequestPost(
      postCheckout(env, {
        sessionId,
        kind: 'custodian',
        custodianPlan: 'watch',
        lang: 'fr',
      }) as never,
    )
    expect(res.status).toBe(200)
    expect(mockedSub).toHaveBeenCalledOnce()
    expect(mockedOneTime).not.toHaveBeenCalled()
    expect(mockedSub.mock.calls[0]![0].priceId).toBe('price_watch_xxx')
  })

  it('Care uses the care price id', async () => {
    const env = buildEnv()
    const sessionId = seedSession(env)
    mockedCurrentEmail.mockResolvedValue('visitor@x.com')

    await onRequestPost(
      postCheckout(env, {
        sessionId,
        kind: 'custodian',
        custodianPlan: 'care',
        lang: 'fr',
      }) as never,
    )
    expect(mockedSub.mock.calls[0]![0].priceId).toBe('price_care_xxx')
  })

  it('returns 503 when the Watch price id is missing', async () => {
    const env = buildEnv({ STRIPE_CUSTODIAN_WATCH_PRICE_ID: undefined })
    const sessionId = seedSession(env)
    mockedCurrentEmail.mockResolvedValue('visitor@x.com')

    const res = await onRequestPost(
      postCheckout(env, {
        sessionId,
        kind: 'custodian',
        custodianPlan: 'watch',
        lang: 'fr',
      }) as never,
    )
    expect(res.status).toBe(503)
  })

  it('returns 400 with no custodianPlan', async () => {
    const env = buildEnv()
    const sessionId = seedSession(env)
    mockedCurrentEmail.mockResolvedValue('visitor@x.com')

    const res = await onRequestPost(
      postCheckout(env, { sessionId, kind: 'custodian', lang: 'fr' }) as never,
    )
    expect(res.status).toBe(400)
  })
})

describe('POST /api/payments/checkout — gating', () => {
  it('returns 401 with no session cookie', async () => {
    const env = buildEnv()
    seedSession(env)
    mockedCurrentEmail.mockResolvedValue(null)

    const res = await onRequestPost(
      postCheckout(env, { sessionId: 'sess_test', kind: 'build' }) as never,
    )
    expect(res.status).toBe(401)
  })

  it('returns 503 when STRIPE_SECRET_KEY is missing', async () => {
    const env = buildEnv({ STRIPE_SECRET_KEY: undefined })
    seedSession(env)
    mockedCurrentEmail.mockResolvedValue('visitor@x.com')

    const res = await onRequestPost(
      postCheckout(env, { sessionId: 'sess_test', kind: 'build' }) as never,
    )
    expect(res.status).toBe(503)
  })

  it('returns 404 when the session does not exist', async () => {
    const env = buildEnv()
    mockedCurrentEmail.mockResolvedValue('visitor@x.com')

    const res = await onRequestPost(
      postCheckout(env, { sessionId: 'sess_missing', kind: 'build' }) as never,
    )
    expect(res.status).toBe(404)
  })

  it('returns 403 when the caller is neither owner nor admin', async () => {
    const env = buildEnv()
    seedSession(env, { email: 'someone-else@x.com' })
    mockedCurrentEmail.mockResolvedValue('intruder@x.com')

    const res = await onRequestPost(
      postCheckout(env, { sessionId: 'sess_test', kind: 'build' }) as never,
    )
    expect(res.status).toBe(403)
  })

  it('returns 400 on an invalid kind', async () => {
    const env = buildEnv()
    seedSession(env)
    mockedCurrentEmail.mockResolvedValue('visitor@x.com')

    const res = await onRequestPost(
      postCheckout(env, { sessionId: 'sess_test', kind: 'bogus' }) as never,
    )
    expect(res.status).toBe(400)
  })
})

describe('POST /api/payments/checkout — admin Tier 4 override', () => {
  it('admin override sets the quoted total and splits it 40/40/20', async () => {
    const env = buildEnv({ ADMIN_EMAILS: 'marc@x.com' })
    seedSession(env, { id: 'sess_test', email: 'visitor@x.com', tier: 4 })
    mockedCurrentEmail.mockResolvedValue('marc@x.com')

    await onRequestPost(
      postCheckout(env, {
        sessionId: 'sess_test',
        kind: 'build',
        lang: 'fr',
        amountCadOverride: 10000,
      }) as never,
    )
    // $10,000 total → first leg is 40% = $4,000.
    expect(mockedOneTime.mock.calls[0]![0].amountCents).toBe(400000)
  })

  it('admin override out of range → 400', async () => {
    const env = buildEnv({ ADMIN_EMAILS: 'marc@x.com' })
    seedSession(env, { tier: 4 })
    mockedCurrentEmail.mockResolvedValue('marc@x.com')

    const res = await onRequestPost(
      postCheckout(env, {
        sessionId: 'sess_test',
        kind: 'build',
        lang: 'fr',
        amountCadOverride: 99,
      }) as never,
    )
    expect(res.status).toBe(400)
  })
})
