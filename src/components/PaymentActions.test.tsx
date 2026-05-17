import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { fireEvent } from '@testing-library/react'
import { PaymentActions } from './PaymentActions'
import * as paymentsApi from '../lib/paymentsApi'
import * as sessionsApi from '../lib/sessionsApi'
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
    tier3_amount_cents: null,
    custodian_status: null,
    all_yours_acknowledged_at: null,
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
  it('shows the "Activate custodian mode" CTA at delivery (status=shipped)', async () => {
    // Gating now matches /handoff's promise: the ownership decision (All
    // yours vs Custodian) belongs at delivery, not mid-build. The trigger
    // is session.status === 'shipped', not hasPaidDeposit.
    mockSummary(
      mkSummary({
        custodianStatus: 'none',
        hasPaidDeposit: true,
        rows: [mkRow({ kind: 'tier1' })],
      }),
    )
    render(<PaymentActions session={mkSession({ tier: 1, status: 'shipped' })} lang="en" />)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Activate custodian mode/ })).toBeInTheDocument(),
    )
    expect(screen.getByRole('heading', { name: /Custodian mode/ })).toBeInTheDocument()
    // The All-yours block renders too, as the explicit "current mode"
    // counterpart so the visitor sees the choice as a pair.
    expect(screen.getByRole('heading', { name: /All yours/ })).toBeInTheDocument()
  })

  it('hides the custodian section mid-build (active, deposit paid, no sub)', async () => {
    // Even after deposit is paid, the custodian decision is held back until
    // the project actually ships. Mirrors /handoff: "decided at delivery".
    mockSummary(
      mkSummary({
        custodianStatus: 'none',
        hasPaidDeposit: true,
        rows: [mkRow({ kind: 'tier1' })],
      }),
    )
    render(<PaymentActions session={mkSession({ tier: 1, status: 'active' })} lang="en" />)
    await waitFor(() =>
      expect(screen.getByText(/Paid · \$300\.00/)).toBeInTheDocument(),
    )
    expect(screen.queryByRole('heading', { name: /Custodian mode/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /All yours/ })).not.toBeInTheDocument()
  })

  it('hides the custodian section pre-engagement (active, no payment, no sub)', async () => {
    mockSummary(mkSummary({ custodianStatus: 'none' }))
    render(<PaymentActions session={mkSession({ tier: 1, status: 'active' })} lang="en" />)
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

describe('PaymentActions All-yours acknowledgment', () => {
  it('decision-pending: Custodian is primary (renders first), All-yours requires checkbox + confirm', async () => {
    mockSummary(mkSummary({ custodianStatus: 'none', hasPaidDeposit: true }))
    render(
      <PaymentActions session={mkSession({ tier: 1, status: 'shipped' })} lang="en" />,
    )
    // Both sections present
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /Custodian mode/ })).toBeInTheDocument(),
    )
    expect(screen.getByRole('heading', { name: /All yours/ })).toBeInTheDocument()
    // Skills heading + ack copy visible
    expect(screen.getByText(/I can handle:/)).toBeInTheDocument()
    expect(screen.getByText(/Cloudflare Pages/)).toBeInTheDocument()
    // Confirm button disabled until checkbox is ticked.
    const confirm = screen.getByRole('button', { name: /Confirm "All yours"/ })
    expect(confirm).toBeDisabled()
    fireEvent.click(screen.getByRole('checkbox'))
    expect(confirm).not.toBeDisabled()
  })

  it('clicking Confirm patches the session and renders "Confirmed on X"', async () => {
    mockSummary(mkSummary({ custodianStatus: 'none', hasPaidDeposit: true }))
    // Patch returns the same row with all_yours_acknowledged_at set.
    const ackedAt = 1730000000
    vi.spyOn(sessionsApi, 'patchSession').mockResolvedValue({
      session: {
        ...mkSession({ tier: 1, status: 'shipped' }),
        all_yours_acknowledged_at: ackedAt,
      },
    })
    render(
      <PaymentActions session={mkSession({ tier: 1, status: 'shipped' })} lang="en" />,
    )
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Confirm "All yours"/ })).toBeInTheDocument(),
    )
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: /Confirm "All yours"/ }))
    await waitFor(() =>
      expect(screen.getByText(/Confirmed on/)).toBeInTheDocument(),
    )
    // Once acked, the checkbox + Confirm button disappear.
    expect(screen.queryByRole('button', { name: /Confirm "All yours"/ })).not.toBeInTheDocument()
    expect(sessionsApi.patchSession).toHaveBeenCalledWith(expect.any(String), {
      acknowledgeAllYours: true,
    })
  })

  it('already-acked session: shows "Confirmed on X" without ack UI', async () => {
    mockSummary(mkSummary({ custodianStatus: 'none' }))
    render(
      <PaymentActions
        session={{
          ...mkSession({ tier: 1, status: 'shipped' }),
          all_yours_acknowledged_at: 1730000000,
        }}
        lang="en"
      />,
    )
    await waitFor(() => expect(screen.getByText(/Confirmed on/)).toBeInTheDocument())
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Confirm "All yours"/ })).not.toBeInTheDocument()
  })

  it('mid-build (active, no ship) does NOT render either ownership section', async () => {
    mockSummary(mkSummary({ custodianStatus: 'none', hasPaidDeposit: true }))
    render(
      <PaymentActions session={mkSession({ tier: 1, status: 'active' })} lang="en" />,
    )
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /Project payment/ })).toBeInTheDocument(),
    )
    expect(screen.queryByRole('heading', { name: /Custodian mode/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /All yours/ })).not.toBeInTheDocument()
  })

  it('custodian active: All-yours section hidden (manage via Stripe portal only)', async () => {
    mockSummary(mkSummary({ custodianStatus: 'active' }))
    render(
      <PaymentActions session={mkSession({ tier: 1, status: 'shipped' })} lang="en" />,
    )
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Manage subscription/ })).toBeInTheDocument(),
    )
    expect(screen.queryByRole('heading', { name: /All yours/ })).not.toBeInTheDocument()
  })
})
