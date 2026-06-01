// PATCH /api/sessions/:id — status transitions + the atomic active-cap
// invariant.
//
// CLAUDE.md singles out "the capacity cap is structural, not advisory" — the
// 2-active-build limit is enforced via an UPDATE…WHERE subselect folded into
// the same SQL statement, closing the read-then-write race (AUDIT P1.7).
// Triage is uncapped: the queue is not a scarce slot, so promotions into
// `triage` are never refused. This spec proves the active invariant holds
// when two operators (or one operator, two clicks) race to promote a session
// into the last open build slot.
//
// What's covered:
//   - admin draft → triage (allowed, even with the queue already non-empty)
//   - admin triage → active when a build slot is open → 200
//   - the cap is 2, not 1: a 2nd active build is allowed
//   - admin promoting a 3rd build when both slots are full → 409
//   - visitor cannot change status → 403 (admin-gate, not CSRF)
//   - invalid status string → 400
//   - ifUpdatedAt mismatch → 409 (optimistic concurrency, not capacity)
//   - shipping a build frees the slot for the next promotion
//   - the race: two concurrent promotions into the last open active slot →
//     exactly one 200, one 409. Repeats enough rounds to trip the race if
//     the SQL ever loses its atomicity.
//
// What's deliberately NOT here:
//   - non-status PATCH branches (showcase, tier, communityDiscount, etc.)
//     — each has its own unit-test coverage; piling them all into a single
//     e2e spec would dilute the focus.
//   - intakeJson edits — visitor-side concern, covered in full-visitor-
//     journey for the success path.

import { test, expect } from '@playwright/test'
import { randomBytes } from 'node:crypto'
import { E2E_BASE_URL, E2E_BINDINGS } from './constants'
import { forgeAuthHeaders } from './helpers/auth'
import { clearTestRows, readStatusHistory, seedSession } from './helpers/db'

const ADMIN_EMAIL = E2E_BINDINGS.ADMIN_EMAILS
const VISITOR_EMAIL = 'visitor-lifecycle@e2e.test'

async function patchSession(
  id: string,
  body: object,
  headers: Record<string, string>,
): Promise<Response> {
  return await fetch(`${E2E_BASE_URL}/api/sessions/${id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(body),
  })
}

test.describe('PATCH /api/sessions/:id — status transitions', () => {
  test.beforeEach(() => clearTestRows())

  test('admin can promote a draft to triage when the slot is empty', async () => {
    const id = `sess_e2e_${randomBytes(6).toString('hex')}`
    seedSession({ id, email: VISITOR_EMAIL, status: 'draft', tier: 1 })

    const headers = forgeAuthHeaders(ADMIN_EMAIL)
    const res = await patchSession(id, { status: 'triage' }, headers)
    expect(res.status).toBe(200)

    const history = readStatusHistory(id)
    expect(history).toHaveLength(1)
    expect(history[0].from).toBe('draft')
    expect(history[0].to).toBe('triage')
    expect(history[0].by).toBe(ADMIN_EMAIL)
  })

  test('admin can promote a draft to triage even when the queue is non-empty (triage uncapped)', async () => {
    // Triage has no cap — a second (and third, and tenth) session can join
    // the queue. This is the inverse of the old "triage full → 409" guard.
    const occupantId = `sess_e2e_${randomBytes(6).toString('hex')}`
    const challengerId = `sess_e2e_${randomBytes(6).toString('hex')}`
    seedSession({ id: occupantId, email: 'occupant@e2e.test', status: 'triage', tier: 1 })
    seedSession({ id: challengerId, email: 'challenger@e2e.test', status: 'draft', tier: 1 })

    const headers = forgeAuthHeaders(ADMIN_EMAIL)
    const res = await patchSession(challengerId, { status: 'triage' }, headers)
    expect(res.status).toBe(200)

    const history = readStatusHistory(challengerId)
    expect(history).toHaveLength(1)
    expect(history[0].to).toBe('triage')
  })

  test('admin can promote triage → active when an active slot is open', async () => {
    const id = `sess_e2e_${randomBytes(6).toString('hex')}`
    seedSession({ id, email: VISITOR_EMAIL, status: 'triage', tier: 1 })

    const headers = forgeAuthHeaders(ADMIN_EMAIL)
    const res = await patchSession(id, { status: 'active' }, headers)
    expect(res.status).toBe(200)
  })

  test('admin can run a 2nd active build (the cap is 2, not 1)', async () => {
    const occupantId = `sess_e2e_${randomBytes(6).toString('hex')}`
    const challengerId = `sess_e2e_${randomBytes(6).toString('hex')}`
    seedSession({ id: occupantId, email: 'occ@e2e.test', status: 'active', tier: 1 })
    seedSession({ id: challengerId, email: 'chal@e2e.test', status: 'triage', tier: 1 })

    const headers = forgeAuthHeaders(ADMIN_EMAIL)
    const res = await patchSession(challengerId, { status: 'active' }, headers)
    expect(res.status).toBe(200)
  })

  test('admin promoting a 3rd build when both active slots are full → 409', async () => {
    const occ1 = `sess_e2e_${randomBytes(6).toString('hex')}`
    const occ2 = `sess_e2e_${randomBytes(6).toString('hex')}`
    const challengerId = `sess_e2e_${randomBytes(6).toString('hex')}`
    seedSession({ id: occ1, email: 'occ1@e2e.test', status: 'active', tier: 1 })
    seedSession({ id: occ2, email: 'occ2@e2e.test', status: 'active', tier: 1 })
    seedSession({ id: challengerId, email: 'chal@e2e.test', status: 'triage', tier: 1 })

    const headers = forgeAuthHeaders(ADMIN_EMAIL)
    const res = await patchSession(challengerId, { status: 'active' }, headers)
    expect(res.status).toBe(409)
    const body = (await res.json()) as { error: string }
    expect(body.error).toMatch(/active at capacity/i)

    // Challenger row unchanged.
    const history = readStatusHistory(challengerId)
    expect(history).toEqual([])
  })

  test('visitor cannot change status (admin-only)', async () => {
    const id = `sess_e2e_${randomBytes(6).toString('hex')}`
    seedSession({ id, email: VISITOR_EMAIL, status: 'draft', tier: 1 })

    const headers = forgeAuthHeaders(VISITOR_EMAIL)
    const res = await patchSession(id, { status: 'triage' }, headers)
    expect(res.status).toBe(403)
  })

  test('invalid status string → 400', async () => {
    const id = `sess_e2e_${randomBytes(6).toString('hex')}`
    seedSession({ id, email: VISITOR_EMAIL, status: 'draft', tier: 1 })

    const headers = forgeAuthHeaders(ADMIN_EMAIL)
    const res = await patchSession(id, { status: 'completed' }, headers)
    expect(res.status).toBe(400)
  })

  test('ifUpdatedAt mismatch → 409 (optimistic concurrency)', async () => {
    const id = `sess_e2e_${randomBytes(6).toString('hex')}`
    seedSession({ id, email: VISITOR_EMAIL, status: 'draft', tier: 1 })

    const headers = forgeAuthHeaders(ADMIN_EMAIL)
    // Stale ifUpdatedAt — far past now — must trip the optimistic check.
    const res = await patchSession(id, { status: 'triage', ifUpdatedAt: 100 }, headers)
    expect(res.status).toBe(409)
    const body = (await res.json()) as { error: string }
    expect(body.error).toMatch(/changed since/i)
  })

  test('shipping a build frees the active slot for the next promotion', async () => {
    // Lifecycle realism: both slots are full; one build ships; the now-open
    // slot must accept a fresh promotion. This is the cleanup half of the cap.
    const occId = `sess_e2e_${randomBytes(6).toString('hex')}`
    const firstId = `sess_e2e_${randomBytes(6).toString('hex')}`
    const secondId = `sess_e2e_${randomBytes(6).toString('hex')}`
    seedSession({ id: occId, email: 'occ@e2e.test', status: 'active', tier: 1 })
    seedSession({ id: firstId, email: 'first@e2e.test', status: 'active', tier: 1 })
    seedSession({ id: secondId, email: 'second@e2e.test', status: 'triage', tier: 1 })

    const headers = forgeAuthHeaders(ADMIN_EMAIL)

    // Both slots full — promotion is blocked.
    const blocked = await patchSession(secondId, { status: 'active' }, headers)
    expect(blocked.status).toBe(409)

    // Ship one — frees a slot.
    const ship = await patchSession(firstId, { status: 'shipped' }, headers)
    expect(ship.status).toBe(200)

    // Now the promotion goes through.
    const promote = await patchSession(secondId, { status: 'active' }, headers)
    expect(promote.status).toBe(200)
  })
})

test.describe('PATCH /api/sessions/:id — atomic capacity race', () => {
  test.beforeEach(() => clearTestRows())

  // Race for the LAST open active slot. We seed one active occupant (1 of 2
  // taken) plus two triage challengers, then fire both promotions to `active`
  // in parallel. The result must be exactly one winner and one 409, no matter
  // how the SQLite scheduler interleaves the UPDATEs. A read-then-write
  // implementation would, on an unlucky round, let both succeed and put three
  // builds active — a single-round spec would miss that.
  //
  // Triage is uncapped, so there is no triage race worth testing — two
  // concurrent promotions into the queue both legitimately succeed.
  test('two concurrent promotions into the last active slot — exactly one wins', async () => {
    const headers = forgeAuthHeaders(ADMIN_EMAIL)

    // 5 rounds. The hand-tuned number balances coverage (enough chances for
    // an interleaving to surface) against runtime (each round is two PATCHes).
    const ROUNDS = 5
    for (let i = 0; i < ROUNDS; i++) {
      // Fresh state per round.
      clearTestRows()
      const occId = `sess_e2e_occ_${i}_${randomBytes(4).toString('hex')}`
      const aId = `sess_e2e_actrace_a_${i}_${randomBytes(4).toString('hex')}`
      const bId = `sess_e2e_actrace_b_${i}_${randomBytes(4).toString('hex')}`
      // One slot already taken — only ONE of the two challengers can win.
      seedSession({ id: occId, email: `occ-${i}@e2e.test`, status: 'active', tier: 1 })
      seedSession({ id: aId, email: `actrace-a-${i}@e2e.test`, status: 'triage', tier: 1 })
      seedSession({ id: bId, email: `actrace-b-${i}@e2e.test`, status: 'triage', tier: 1 })

      const [resA, resB] = await Promise.all([
        patchSession(aId, { status: 'active' }, headers),
        patchSession(bId, { status: 'active' }, headers),
      ])

      const statuses = [resA.status, resB.status].sort()
      // Acceptable outcomes: [200, 409] (atomic), never [200, 200].
      expect(statuses).toEqual([200, 409])
    }
  })
})
