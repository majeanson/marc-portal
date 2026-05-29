/**
 * Coverage for the SessionWhatsNext state machine. This strip mirrors the
 * lifecycle so a visitor never has to guess what's expected of them next, and
 * the branch selection (status → tier → build summary → custodian) is exactly
 * the kind of mapping that regresses silently under a refactor. We assert the
 * branch each state lands on, not the exact prose.
 */

import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { SessionWhatsNext } from './SessionWhatsNext'
import type { SessionRow } from '../lib/sessionsApi'
import type { BuildSummary, PaymentSummary } from '../lib/paymentsApi'

function sess(over: Partial<SessionRow> = {}): SessionRow {
  return {
    id: 's1',
    status: 'active',
    tier: 1,
    all_yours_acknowledged_at: null,
    created_at: Math.floor(Date.now() / 1000),
    ...over,
  } as unknown as SessionRow
}

function summary(over: Partial<PaymentSummary> = {}): PaymentSummary {
  return {
    rows: [],
    custodianStatus: 'none',
    stripeMode: 'test',
    build: null,
    scoping: { paid: false },
    ...over,
  } as unknown as PaymentSummary
}

function build(over: Partial<BuildSummary> = {}): BuildSummary {
  return {
    tier: 1,
    installmentCount: 1,
    paidCount: 0,
    nextIndex: 1,
    nextAmountCents: 75000,
    quotePending: false,
    community: false,
    ...over,
  }
}

function whatsNext(args: {
  session: SessionRow
  summary?: PaymentSummary | null
  isAdmin?: boolean
}) {
  return render(
    <SessionWhatsNext
      session={args.session}
      summary={args.summary ?? null}
      isAdmin={args.isAdmin ?? false}
      lang="en"
    />,
  )
}

describe('SessionWhatsNext', () => {
  it('renders nothing for admins', () => {
    const { container } = whatsNext({ session: sess({ status: 'triage' }), isAdmin: true })
    expect(container.querySelector('.session-whats-next')).toBeNull()
  })

  it('shows the triage reply expectation in triage', () => {
    const { getByText } = whatsNext({ session: sess({ status: 'triage' }) })
    expect(getByText(/tell me more/i)).toBeInTheDocument()
  })

  it('shows a muted message when rejected', () => {
    const { container, getByText } = whatsNext({ session: sess({ status: 'rejected' }) })
    expect(getByText(/declined/i)).toBeInTheDocument()
    expect(container.querySelector('.session-whats-next--muted')).not.toBeNull()
  })

  it('asks the visitor to wait for sizing when active with no tier', () => {
    const { getByText } = whatsNext({ session: sess({ status: 'active', tier: null }) })
    expect(getByText(/sizing it/i)).toBeInTheDocument()
  })

  it('points to the thread for a Tier 0 redirect', () => {
    const { getByText } = whatsNext({ session: sess({ status: 'active', tier: 0 }) })
    expect(getByText(/pattern\/template/i)).toBeInTheDocument()
  })

  it('shows a loading line while the build summary is still in flight', () => {
    const { getByText } = whatsNext({ session: sess({ status: 'active', tier: 1 }), summary: null })
    expect(getByText(/loading payment details/i)).toBeInTheDocument()
  })

  it('prompts payment when active with an unpaid build', () => {
    const { getByText } = whatsNext({
      session: sess({ status: 'active', tier: 1 }),
      summary: summary({ build: build({ paidCount: 0, nextIndex: 1, installmentCount: 1 }) }),
    })
    expect(getByText(/pay below to start/i)).toBeInTheDocument()
  })

  it('confirms wrap-up when active and fully paid', () => {
    const { getByText } = whatsNext({
      session: sess({ status: 'active', tier: 1 }),
      summary: summary({ build: build({ paidCount: 1, nextIndex: null }) }),
    })
    expect(getByText(/fully paid/i)).toBeInTheDocument()
  })

  it('reports active custodian mode on a shipped session', () => {
    const { getByText } = whatsNext({
      session: sess({ status: 'shipped' }),
      summary: summary({ custodianStatus: 'active' }),
    })
    expect(getByText(/custodian mode active/i)).toBeInTheDocument()
  })

  it('renders nothing for a shipped session with no ownership decision yet', () => {
    const { container } = whatsNext({
      session: sess({ status: 'shipped', all_yours_acknowledged_at: null }),
      summary: summary({ custodianStatus: 'none' }),
    })
    expect(container.querySelector('.session-whats-next')).toBeNull()
  })
})
