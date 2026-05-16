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

describe('PaymentActions custodian-sub button', () => {
  it('shows "Become custodian" when no subscription exists', async () => {
    mockSummary(mkSummary({ custodianStatus: 'none' }))
    render(<PaymentActions session={mkSession({ tier: null })} lang="en" />)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Become custodian/ })).toBeInTheDocument(),
    )
  })

  it('shows "Become custodian" after a prior sub ended (re-subscribe path)', async () => {
    mockSummary(mkSummary({ custodianStatus: 'switched_to_tout_a_toi' }))
    render(<PaymentActions session={mkSession({ tier: null })} lang="en" />)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Become custodian/ })).toBeInTheDocument(),
    )
  })

  it('shows "Manage subscription" instead when one is active', async () => {
    mockSummary(mkSummary({ custodianStatus: 'active' }))
    render(<PaymentActions session={mkSession({ tier: null })} lang="en" />)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Manage subscription/ })).toBeInTheDocument(),
    )
    expect(screen.queryByRole('button', { name: /Become custodian/ })).not.toBeInTheDocument()
  })
})
