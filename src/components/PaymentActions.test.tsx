import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { fireEvent } from '@testing-library/react'
import { PaymentActions } from './PaymentActions'
import * as paymentsApi from '../lib/paymentsApi'
import * as sessionsApi from '../lib/sessionsApi'
import type { BuildSummary, PaymentSummary, PaymentRow } from '../lib/paymentsApi'
import type { SessionRow } from '../lib/sessionsApi'

function mkSession(overrides: Partial<SessionRow> = {}): SessionRow {
  return {
    id: 'sess_test',
    email: 'v@example.com',
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
    custodian_status: null,
    all_yours_acknowledged_at: null,
    decline_note: null,
    ...overrides,
  }
}

function mkBuild(overrides: Partial<BuildSummary> = {}): BuildSummary {
  return {
    tier: 1,
    installmentCount: 1,
    paidCount: 0,
    nextIndex: 1,
    nextAmountCents: 75000,
    quotePending: false,
    ...overrides,
  }
}

function mkSummary(overrides: Partial<PaymentSummary> = {}): PaymentSummary {
  return {
    rows: [],
    custodianStatus: 'none',
    stripeMode: 'test',
    build: mkBuild(),
    scoping: { paid: false },
    ...overrides,
  }
}

function mkRow(overrides: Partial<PaymentRow>): PaymentRow {
  return {
    id: 'pay_test',
    session_id: 'sess_test',
    kind: 'build',
    tier: 1,
    installment_index: 1,
    installment_of: 1,
    custodian_plan: null,
    amount_cents: 75000,
    currency: 'cad',
    status: 'paid',
    stripe_checkout_session_id: null,
    stripe_payment_intent_id: 'pi_test',
    stripe_subscription_id: null,
    stripe_invoice_id: null,
    stripe_customer_id: null,
    created_at: 1700000000,
    paid_at: 1700000010,
    refunded_at: null,
    refunded_amount_cents: 0,
    ...overrides,
  }
}

function mockSummary(s: PaymentSummary) {
  vi.spyOn(paymentsApi, 'getPaymentSummary').mockResolvedValue(s)
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('PaymentActions test/live mode pill', () => {
  it('renders TEST MODE pill when stripeMode=test', async () => {
    mockSummary(mkSummary({ stripeMode: 'test' }))
    render(<PaymentActions session={mkSession()} lang="en" />)
    await waitFor(() => expect(screen.getByText('TEST MODE')).toBeInTheDocument())
  })

  it('hides the pill when stripeMode=live', async () => {
    mockSummary(mkSummary({ stripeMode: 'live' }))
    render(<PaymentActions session={mkSession()} lang="en" />)
    await waitFor(() => expect(screen.getByRole('button', { name: /Pay/ })).toBeInTheDocument())
    expect(screen.queryByText('TEST MODE')).not.toBeInTheDocument()
  })
})

describe('PaymentActions build installments', () => {
  it('shows a single Pay button for a Tier 1 build', async () => {
    mockSummary(
      mkSummary({ build: mkBuild({ tier: 1, installmentCount: 1, nextAmountCents: 75000 }) }),
    )
    render(<PaymentActions session={mkSession({ tier: 1 })} lang="en" />)
    await waitFor(() => expect(screen.getByRole('button', { name: /Pay \(/ })).toBeInTheDocument())
  })

  it('labels the next installment leg for a Tier 2 build', async () => {
    mockSummary(
      mkSummary({
        build: mkBuild({
          tier: 2,
          installmentCount: 2,
          paidCount: 1,
          nextIndex: 2,
          nextAmountCents: 90000,
        }),
      }),
    )
    render(<PaymentActions session={mkSession({ tier: 2 })} lang="en" />)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Pay installment 2\/2/ })).toBeInTheDocument(),
    )
  })

  it('shows "Paid · $1,800" once both legs are paid (sum, not single row)', async () => {
    mockSummary(
      mkSummary({
        build: mkBuild({
          tier: 2,
          installmentCount: 2,
          paidCount: 2,
          nextIndex: null,
          nextAmountCents: null,
        }),
        rows: [
          mkRow({
            id: 'p1',
            tier: 2,
            installment_index: 1,
            installment_of: 2,
            amount_cents: 90000,
          }),
          mkRow({
            id: 'p2',
            tier: 2,
            installment_index: 2,
            installment_of: 2,
            amount_cents: 90000,
          }),
        ],
      }),
    )
    render(<PaymentActions session={mkSession({ tier: 2 })} lang="en" />)
    await waitFor(() => expect(screen.getByText(/Paid · \$1,800\b/)).toBeInTheDocument())
  })

  it('shows the quote-pending hint for a Tier 4 build with no quote', async () => {
    mockSummary(
      mkSummary({
        build: mkBuild({
          tier: 4,
          installmentCount: 0,
          nextIndex: null,
          nextAmountCents: null,
          quotePending: true,
        }),
      }),
    )
    render(<PaymentActions session={mkSession({ tier: 4 })} lang="en" />)
    await waitFor(() => expect(screen.getByText(/Tier 4 quote pending/)).toBeInTheDocument())
  })
})

describe('PaymentActions custodian section', () => {
  it('shows the Watch + Care CTAs at delivery (status=shipped)', async () => {
    mockSummary(
      mkSummary({
        custodianStatus: 'none',
        build: mkBuild({ nextIndex: null, nextAmountCents: null, paidCount: 1 }),
        rows: [mkRow({})],
      }),
    )
    render(<PaymentActions session={mkSession({ tier: 1, status: 'shipped' })} lang="en" />)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Activate Watch/ })).toBeInTheDocument(),
    )
    expect(screen.getByRole('button', { name: /Activate Care/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Custodian mode/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /All yours/ })).toBeInTheDocument()
  })

  it('hides the custodian section mid-build (active, no sub)', async () => {
    mockSummary(
      mkSummary({
        custodianStatus: 'none',
        build: mkBuild({ nextIndex: null, nextAmountCents: null, paidCount: 1 }),
        rows: [mkRow({})],
      }),
    )
    render(<PaymentActions session={mkSession({ tier: 1, status: 'active' })} lang="en" />)
    await waitFor(() => expect(screen.getByText(/Paid · \$750\b/)).toBeInTheDocument())
    expect(screen.queryByRole('heading', { name: /Custodian mode/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /All yours/ })).not.toBeInTheDocument()
  })

  it('re-activation after a prior sub ended shows Watch + Care', async () => {
    mockSummary(mkSummary({ custodianStatus: 'switched_to_tout_a_toi', build: null }))
    render(<PaymentActions session={mkSession({ tier: null })} lang="en" />)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Activate Watch/ })).toBeInTheDocument(),
    )
    const sect = screen.getByRole('region', { name: /Custodian mode/ })
    expect(sect.querySelector('.me-portal__pay-section-tag')?.textContent).toMatch(/ended/)
  })

  it('shows "Manage subscription" when one is active', async () => {
    mockSummary(mkSummary({ custodianStatus: 'active', build: null }))
    render(<PaymentActions session={mkSession({ tier: null })} lang="en" />)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Manage subscription/ })).toBeInTheDocument(),
    )
    expect(screen.queryByRole('button', { name: /Activate Watch/ })).not.toBeInTheDocument()
  })

  it('shows "Update payment method" when sub is past_due', async () => {
    mockSummary(mkSummary({ custodianStatus: 'past_due', build: null }))
    render(<PaymentActions session={mkSession({ tier: null })} lang="en" />)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Update payment method/ })).toBeInTheDocument(),
    )
  })
})

describe('PaymentActions project section', () => {
  it('renders the project section when tier is set', async () => {
    mockSummary(mkSummary())
    render(<PaymentActions session={mkSession({ tier: 1 })} lang="en" />)
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /Project payment/ })).toBeInTheDocument(),
    )
  })

  it('hides the project section for tier-0 (free engagement)', async () => {
    mockSummary(mkSummary({ custodianStatus: 'active', build: null }))
    render(<PaymentActions session={mkSession({ tier: 0 })} lang="en" />)
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /Custodian mode/ })).toBeInTheDocument(),
    )
    expect(screen.queryByRole('heading', { name: /Project payment/ })).not.toBeInTheDocument()
  })

  it('offers the scoping report during triage', async () => {
    mockSummary(mkSummary({ build: null, scoping: { paid: false } }))
    render(<PaymentActions session={mkSession({ tier: null, status: 'triage' })} lang="en" />)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Pay the scoping report/ })).toBeInTheDocument(),
    )
  })
})

describe('PaymentActions All-yours acknowledgment', () => {
  it('decision-pending: All-yours requires checkbox + confirm', async () => {
    mockSummary(
      mkSummary({
        custodianStatus: 'none',
        build: mkBuild({ nextIndex: null, nextAmountCents: null }),
      }),
    )
    render(<PaymentActions session={mkSession({ tier: 1, status: 'shipped' })} lang="en" />)
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /Custodian mode/ })).toBeInTheDocument(),
    )
    expect(screen.getByRole('heading', { name: /All yours/ })).toBeInTheDocument()
    expect(screen.getByText(/I can handle:/)).toBeInTheDocument()
    const confirm = screen.getByRole('button', { name: /Confirm "All yours"/ })
    expect(confirm).toBeDisabled()
    fireEvent.click(screen.getByRole('checkbox'))
    expect(confirm).not.toBeDisabled()
  })

  it('clicking Confirm patches the session and renders "Confirmed on X"', async () => {
    mockSummary(
      mkSummary({
        custodianStatus: 'none',
        build: mkBuild({ nextIndex: null, nextAmountCents: null }),
      }),
    )
    const ackedAt = 1730000000
    vi.spyOn(sessionsApi, 'patchSession').mockResolvedValue({
      session: { ...mkSession({ tier: 1, status: 'shipped' }), all_yours_acknowledged_at: ackedAt },
    })
    render(<PaymentActions session={mkSession({ tier: 1, status: 'shipped' })} lang="en" />)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Confirm "All yours"/ })).toBeInTheDocument(),
    )
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: /Confirm "All yours"/ }))
    await waitFor(() => expect(screen.getByText(/Confirmed on/)).toBeInTheDocument())
    expect(sessionsApi.patchSession).toHaveBeenCalledWith(expect.any(String), {
      acknowledgeAllYours: true,
    })
  })

  it('custodian active: All-yours section hidden (manage via Stripe portal only)', async () => {
    mockSummary(mkSummary({ custodianStatus: 'active', build: null }))
    render(<PaymentActions session={mkSession({ tier: 1, status: 'shipped' })} lang="en" />)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Manage subscription/ })).toBeInTheDocument(),
    )
    expect(screen.queryByRole('heading', { name: /All yours/ })).not.toBeInTheDocument()
  })
})
