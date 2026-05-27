import { describe, expect, it } from 'vitest'
import { inferNextAction, type NextActionContext } from './nextAction'
import type { SessionRow } from './sessions'

function makeSession(over: Partial<SessionRow> = {}): SessionRow {
  return {
    id: 's1',
    email: 'visitor@x.com',
    intake_json: null,
    status: 'active',
    created_at: 1_700_000_000,
    updated_at: 1_700_000_000,
    deleted_at: null,
    status_history: null,
    showcased_at: null,
    showcase_title: null,
    showcase_tagline: null,
    tier: 1,
    tier4_amount_cents: null,
    tier3_split: null,
    custodian_status: null,
    custodian_plan: null,
    all_yours_acknowledged_at: null,
    decline_note: null,
    community_discount: 0,
    napkin_attachment_id: null,
    ...over,
  }
}

function ctx(over: Partial<NextActionContext> = {}): NextActionContext {
  return {
    nowS: 1_700_100_000,
    lastVisitorMessageAtS: null,
    lastMarcMessageAtS: null,
    paidBuildLegs: 0,
    stalePendingBuildLegs: 0,
    statusEnteredAtS: null,
    ...over,
  }
}

describe('inferNextAction — terminal states', () => {
  it('rejected sessions are muted with no action', () => {
    const a = inferNextAction(makeSession({ status: 'rejected' }), ctx())
    expect(a.code).toBe('rejected')
    expect(a.severity).toBe('muted')
  })

  it('shipped with both custodian + ack decisions made is shipped_done', () => {
    const a = inferNextAction(
      makeSession({ status: 'shipped', custodian_status: 'active', custodian_plan: 'watch' }),
      ctx(),
    )
    expect(a.code).toBe('shipped_done')
  })

  it('shipped within 30 days with no decision is handoff_pending (warn)', () => {
    const nowS = 1_700_000_000 + 10 * 24 * 3600
    const a = inferNextAction(
      makeSession({ status: 'shipped', updated_at: 1_700_000_000 }),
      ctx({ nowS }),
    )
    expect(a.code).toBe('shipped_handoff_pending')
    expect(a.severity).toBe('warn')
  })

  it('shipped past 30 days without decision falls back to shipped_done (no nag)', () => {
    const nowS = 1_700_000_000 + 31 * 24 * 3600
    const a = inferNextAction(
      makeSession({ status: 'shipped', updated_at: 1_700_000_000 }),
      ctx({ nowS }),
    )
    expect(a.code).toBe('shipped_done')
  })

  it('all_yours_acknowledged_at counts as a decision and skips handoff prompt', () => {
    const a = inferNextAction(
      makeSession({ status: 'shipped', all_yours_acknowledged_at: 1_700_050_000 }),
      ctx({ nowS: 1_700_100_000 }),
    )
    expect(a.code).toBe('shipped_done')
  })
})

describe('inferNextAction — custodian past_due wins across statuses', () => {
  it('past_due on a shipped session is urgent', () => {
    const a = inferNextAction(
      makeSession({ status: 'shipped', custodian_status: 'past_due' }),
      ctx(),
    )
    expect(a.code).toBe('custodian_past_due')
    expect(a.severity).toBe('urgent')
  })

  it('past_due wins even when reply is also overdue', () => {
    const nowS = 1_700_000_000
    const a = inferNextAction(
      makeSession({ status: 'active', custodian_status: 'past_due' }),
      ctx({ nowS, lastVisitorMessageAtS: nowS - 48 * 3600 }),
    )
    expect(a.code).toBe('custodian_past_due')
  })
})

describe('inferNextAction — active session precedence', () => {
  const baseNow = 1_700_000_000

  it('reply_overdue when visitor wrote >24h ago and Marc has not replied since', () => {
    const a = inferNextAction(
      makeSession({ status: 'active', tier: 2 }),
      ctx({
        nowS: baseNow,
        lastVisitorMessageAtS: baseNow - 25 * 3600,
        lastMarcMessageAtS: baseNow - 30 * 3600,
      }),
    )
    expect(a.code).toBe('reply_overdue')
    expect(a.severity).toBe('urgent')
  })

  it('reply_overdue NOT triggered when Marc replied after the visitor', () => {
    const a = inferNextAction(
      makeSession({ status: 'active', tier: 2 }),
      ctx({
        nowS: baseNow,
        lastVisitorMessageAtS: baseNow - 26 * 3600,
        lastMarcMessageAtS: baseNow - 1 * 3600,
      }),
    )
    expect(a.code).not.toBe('reply_overdue')
  })

  it('tier_missing on an active session with no tier', () => {
    const a = inferNextAction(makeSession({ status: 'active', tier: null }), ctx())
    expect(a.code).toBe('tier_missing')
    expect(a.severity).toBe('urgent')
  })

  it('tier4_quote_missing fires when tier=4 but no amount', () => {
    const a = inferNextAction(
      makeSession({ status: 'active', tier: 4, tier4_amount_cents: null }),
      ctx(),
    )
    expect(a.code).toBe('tier4_quote_missing')
  })

  it('tier4 with quote present does not trip the quote-missing branch', () => {
    const a = inferNextAction(
      makeSession({ status: 'active', tier: 4, tier4_amount_cents: 1_000_000 }),
      ctx(),
    )
    expect(a.code).not.toBe('tier4_quote_missing')
  })

  it('installment_unpaid after 7d with no paid leg', () => {
    const enteredAt = 1_700_000_000
    const nowS = enteredAt + 8 * 24 * 3600
    const a = inferNextAction(
      makeSession({ status: 'active', tier: 2 }),
      ctx({ nowS, paidBuildLegs: 0, statusEnteredAtS: enteredAt }),
    )
    expect(a.code).toBe('installment_unpaid')
    expect(a.severity).toBe('warn')
  })

  it('installment_unpaid skipped when a build leg is paid', () => {
    const enteredAt = 1_700_000_000
    const nowS = enteredAt + 8 * 24 * 3600
    const a = inferNextAction(
      makeSession({ status: 'active', tier: 2 }),
      ctx({ nowS, paidBuildLegs: 1, statusEnteredAtS: enteredAt }),
    )
    expect(a.code).toBe('ok')
  })

  it('check_in_due when last message was >14 days ago', () => {
    const lastAt = 1_700_000_000
    const nowS = lastAt + 15 * 24 * 3600
    const a = inferNextAction(
      makeSession({ status: 'active', tier: 1 }),
      ctx({
        nowS,
        lastMarcMessageAtS: lastAt,
        lastVisitorMessageAtS: lastAt,
        paidBuildLegs: 1,
      }),
    )
    expect(a.code).toBe('check_in_due')
  })
})

describe('inferNextAction — triage and draft', () => {
  it('triage_overdue past 48h', () => {
    const createdAt = 1_700_000_000
    const a = inferNextAction(
      makeSession({ status: 'triage', created_at: createdAt, tier: null }),
      ctx({ nowS: createdAt + 49 * 3600 }),
    )
    expect(a.code).toBe('triage_overdue')
    expect(a.severity).toBe('urgent')
  })

  it('triage_pending under 48h is warn', () => {
    const createdAt = 1_700_000_000
    const a = inferNextAction(
      makeSession({ status: 'triage', created_at: createdAt, tier: null }),
      ctx({ nowS: createdAt + 3600 }),
    )
    expect(a.code).toBe('triage_pending')
    expect(a.severity).toBe('warn')
  })

  it('ready_to_start fires when triage + a build leg has been paid', () => {
    const createdAt = 1_700_000_000
    const a = inferNextAction(
      makeSession({ status: 'triage', created_at: createdAt, tier: 2 }),
      ctx({ nowS: createdAt + 3600, paidBuildLegs: 1 }),
    )
    expect(a.code).toBe('ready_to_start')
    expect(a.severity).toBe('urgent')
  })

  it('ready_to_start outranks triage_overdue when a leg has been paid', () => {
    const createdAt = 1_700_000_000
    const a = inferNextAction(
      makeSession({ status: 'triage', created_at: createdAt, tier: 2 }),
      ctx({ nowS: createdAt + 49 * 3600, paidBuildLegs: 1 }),
    )
    expect(a.code).toBe('ready_to_start')
  })

  it('draft_stalled past 12h', () => {
    const updatedAt = 1_700_000_000
    const a = inferNextAction(
      makeSession({ status: 'draft', updated_at: updatedAt }),
      ctx({ nowS: updatedAt + 13 * 3600 }),
    )
    expect(a.code).toBe('draft_stalled')
    expect(a.severity).toBe('info')
  })

  it('fresh draft (<12h) is ok / muted', () => {
    const updatedAt = 1_700_000_000
    const a = inferNextAction(
      makeSession({ status: 'draft', updated_at: updatedAt }),
      ctx({ nowS: updatedAt + 5 * 3600 }),
    )
    expect(a.code).toBe('ok')
  })
})
