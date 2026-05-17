import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { PaymentActions } from './PaymentActions'
import * as paymentsApi from '../lib/paymentsApi'
import type { PaymentSummary, PaymentRow } from '../lib/paymentsApi'
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
    ...overrides,
  }
}

function mkSummary(overrides: Partial<PaymentSummary> = {}): PaymentSummary {
  return {
    rows: [],
    hasPaidDeposit: false,
    custodianStatus: 'none',
    stripeMode: 'test',
    ...overrides,
  }
}

function mkRow(overrides: Partial<PaymentRow>): PaymentRow {
  return {
    id: 'pay_test',
    session_id: 'sess_test',
    kind: 'tier1',
    amount_cents: 30000,
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
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Pay Tier 1/ })).toBeInTheDocument(),
    )
    expect(screen.queryByText('TEST MODE')).not.toBeInTheDocument()
  })
})

describe('PaymentActions tier 2 split flow', () => {
  it('shows the final-balance button after deposit is paid', async () => {
    mockSummary(
      mkSummary({
        rows: [mkRow({ kind: 'tier2-deposit', amount_cents: 75000 })],
        hasPaidDeposit: true,
      }),
    )
    render(<PaymentActions session={mkSession({ tier: 2 })} lang="en" />)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Pay final balance/ })).toBeInTheDocument(),
    )
  })

  it('shows "Paid · $1,500.00" once both legs are paid (sum, not single row)', async () => {
    mockSummary(
      mkSummary({
        rows: [
          mkRow({ id: 'pay_dep', kind: 'tier2-deposit', amount_cents: 75000 }),
          mkRow({ id: 'pay_fin', kind: 'tier2-final', amount_cents: 75000 }),
        ],
        hasPaidDeposit: true,
      }),
    )
    render(<PaymentActions session={mkSession({ tier: 2 })} lang="en" />)
    await waitFor(() => expect(screen.getByText(/Paid · \$1,500\.00/)).toBeInTheDocument())
  })
})

describe('PaymentActions custodian section', () => {
  it('shows the "Activate custodian mode" CTA after deposit is paid', async () => {
    // Gating tightened: custodian section only surfaces once the visitor has
    // paid for work (or already has a sub). A tier-1 visitor who paid their
    // $300 deposit is the canonical "ready to consider custodian" moment.
    mockSummary(
      mkSummary({
        custodianStatus: 'none',
        hasPaidDeposit: true,
        rows: [mkRow({ kind: 'tier1' })],
      }),
    )
    render(<PaymentActions session={mkSession({ tier: 1 })} lang="en" />)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Activate custodian mode/ })).toBeInTheDocument(),
    )
    expect(screen.getByRole('heading', { name: /Custodian mode/ })).toBeInTheDocument()
  })

  it('hides the custodian section pre-engagement (no deposit yet, no sub)', async () => {
    mockSummary(mkSummary({ custodianStatus: 'none' }))
    render(<PaymentActions session={mkSession({ tier: 1 })} lang="en" />)
    // Project section renders (tier=1, no payment yet)
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /Project payment/ })).toBeInTheDocument(),
    )
    // But custodian section should NOT render — premature upsell.
    expect(screen.queryByRole('heading', { name: /Custodian mode/ })).not.toBeInTheDocument()
  })

  it('shows "Re-activate subscription" after a prior sub ended', async () => {
    mockSummary(mkSummary({ custodianStatus: 'switched_to_tout_a_toi' }))
    render(<PaymentActions session={mkSession({ tier: null })} lang="en" />)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Re-activate subscription/ })).toBeInTheDocument(),
    )
    // 'ended' tag is on the section header — scope to it so the body's
    // "subscription has ended" doesn't double-match.
    const sect = screen.getByRole('region', { name: /Custodian mode/ })
    expect(sect.querySelector('.me-portal__pay-section-tag')?.textContent).toMatch(/ended/)
  })

  it('shows "Manage subscription" when one is active', async () => {
    mockSummary(mkSummary({ custodianStatus: 'active' }))
    render(<PaymentActions session={mkSession({ tier: null })} lang="en" />)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Manage subscription/ })).toBeInTheDocument(),
    )
    expect(
      screen.queryByRole('button', { name: /Activate custodian mode/ }),
    ).not.toBeInTheDocument()
  })

  it('shows "Update payment method" when sub is past_due', async () => {
    mockSummary(mkSummary({ custodianStatus: 'past_due' }))
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

  it('hides project section entirely for tier-0 (free engagement)', async () => {
    mockSummary(mkSummary({ custodianStatus: 'active' }))
    render(<PaymentActions session={mkSession({ tier: 0 })} lang="en" />)
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /Custodian mode/ })).toBeInTheDocument(),
    )
    expect(screen.queryByRole('heading', { name: /Project payment/ })).not.toBeInTheDocument()
  })
})
