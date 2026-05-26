// PATCH /api/sessions/:id — status transitions + the atomic capacity-cap
// invariant.
//
// CLAUDE.md singles out "the capacity cap is structural, not advisory" —
// the 1-active + 1-triage limit is enforced via an UPDATE…WHERE subselect
// folded into the same SQL statement, closing the read-then-write race
// (AUDIT P1.7). This spec proves the invariant holds when two operators
// (or one operator, two clicks) race to promote a session into a slot
// that's about to fill.
//
// What's covered:
//   - admin draft → triage (slot empty) → 200, statusHistory appended
//   - admin draft → triage when triage is at cap → 409
//   - admin draft → active when active is at cap → 409
//   - visitor cannot change status → 403 (admin-gate, not CSRF)
//   - invalid status string → 400
//   - ifUpdatedAt mismatch → 409 (optimistic concurrency, not capacity)
//   - the race: two concurrent PATCHes promoting drafts to triage with the
//     slot at 0 → exactly one 200, one 409. Repeats enough rounds to
//     trip the race if the SQL ever loses its atomicity.
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

  test('admin can promote triage → active when active slot is empty', async () => {
    const id = `sess_e2e_${randomBytes(6).toString('hex')}`
    seedSession({ id, email: VISITOR_EMAIL, status: 'triage', tier: 1 })

    const headers = forgeAuthHeaders(ADMIN_EMAIL)
    const res = await patchSession(id, { status: 'active' }, headers)
    expect(res.status).toBe(200)
  })

  test('admin promoting a 2nd draft to triage when triage is full → 409', async () => {
    const occupantId = `sess_e2e_${randomBytes(6).toString('hex')}`
    const challengerId = `sess_e2e_${randomBytes(6).toString('hex')}`
    seedSession({ id: occupantId, email: 'occupant@e2e.test', status: 'triage', tier: 1 })
    seedSession({ id: challengerId, email: 'challenger@e2e.test', status: 'draft', tier: 1 })

    const headers = forgeAuthHeaders(ADMIN_EMAIL)
    const res = await patchSession(challengerId, { status: 'triage' }, headers)
    expect(res.status).toBe(409)
    const body = (await res.json()) as { error: string }
    expect(body.error).toMatch(/triage at capacity/i)

    // Challenger row unchanged.
    const history = readStatusHistory(challengerId)
    expect(history).toEqual([])
  })

  test('admin promoting a 2nd draft to active when active is full → 409', async () => {
    const occupantId = `sess_e2e_${randomBytes(6).toString('hex')}`
    const challengerId = `sess_e2e_${randomBytes(6).toString('hex')}`
    seedSession({ id: occupantId, email: 'occ@e2e.test', status: 'active', tier: 1 })
    seedSession({ id: challengerId, email: 'chal@e2e.test', status: 'triage', tier: 1 })

    const headers = forgeAuthHeaders(ADMIN_EMAIL)
    const res = await patchSession(challengerId, { status: 'active' }, headers)
    expect(res.status).toBe(409)
    const body = (await res.json()) as { error: string }
    expect(body.error).toMatch(/active at capacity/i)
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

  test('rejecting a session frees the triage slot for the next promotion', async () => {
    // Lifecycle realism: a triage gets rejected; the now-empty slot must
    // accept a fresh promotion. This is the cleanup half of the cap.
    const firstId = `sess_e2e_${randomBytes(6).toString('hex')}`
    const secondId = `sess_e2e_${randomBytes(6).toString('hex')}`
    seedSession({ id: firstId, email: 'first@e2e.test', status: 'triage', tier: 1 })
    seedSession({ id: secondId, email: 'second@e2e.test', status: 'draft', tier: 1 })

    const headers = forgeAuthHeaders(ADMIN_EMAIL)

    // Confirm the slot is full first.
    const blocked = await patchSession(secondId, { status: 'triage' }, headers)
    expect(blocked.status).toBe(409)

    // Reject the first — frees the slot.
    const reject = await patchSession(firstId, { status: 'rejected' }, headers)
    expect(reject.status).toBe(200)

    // Now the promotion goes through.
    const promote = await patchSession(secondId, { status: 'triage' }, headers)
    expect(promote.status).toBe(200)
  })
})

test.describe('PATCH /api/sessions/:id — atomic capacity race', () => {
  test.beforeEach(() => clearTestRows())

  // We run the race a handful of times back-to-back. Each round seeds two
  // fresh drafts and fires both PATCHes in parallel; the result must be
  // exactly one winner and one 409, no matter how the SQLite scheduler
  // interleaves the UPDATEs. A read-then-write implementation would, on a
  // sufficiently unlucky round, let both succeed — a single-round spec
  // would miss that.
  test('two concurrent promotions to triage — exactly one wins', async () => {
    const headers = forgeAuthHeaders(ADMIN_EMAIL)

    // 5 rounds. The hand-tuned number balances coverage (enough chances
    // for an interleaving to surface) against runtime (each round is two
    // PATCHes, ~50ms total).
    const ROUNDS = 5
    for (let i = 0; i < ROUNDS; i++) {
      // Fresh state per round — wipe any prior round's triage occupant.
      clearTestRows()
      const aId = `sess_e2e_race_a_${i}_${randomBytes(4).toString('hex')}`
      const bId = `sess_e2e_race_b_${i}_${randomBytes(4).toString('hex')}`
      seedSession({ id: aId, email: `race-a-${i}@e2e.test`, status: 'draft', tier: 1 })
      seedSession({ id: bId, email: `race-b-${i}@e2e.test`, status: 'draft', tier: 1 })

      const [resA, resB] = await Promise.all([
        patchSession(aId, { status: 'triage' }, headers),
        patchSession(bId, { status: 'triage' }, headers),
      ])

      const statuses = [resA.status, resB.status].sort()
      // Acceptable outcomes: [200, 409] (atomic), never [200, 200].
      expect(statuses).toEqual([200, 409])
    }
  })

  test('two concurrent promotions to active — exactly one wins', async () => {
    const headers = forgeAuthHeaders(ADMIN_EMAIL)

    const ROUNDS = 5
    for (let i = 0; i < ROUNDS; i++) {
      clearTestRows()
      const aId = `sess_e2e_actrace_a_${i}_${randomBytes(4).toString('hex')}`
      const bId = `sess_e2e_actrace_b_${i}_${randomBytes(4).toString('hex')}`
      seedSession({ id: aId, email: `actrace-a-${i}@e2e.test`, status: 'triage', tier: 1 })
      seedSession({ id: bId, email: `actrace-b-${i}@e2e.test`, status: 'triage', tier: 1 })

      const [resA, resB] = await Promise.all([
        patchSession(aId, { status: 'active' }, headers),
        patchSession(bId, { status: 'active' }, headers),
      ])

      const statuses = [resA.status, resB.status].sort()
      expect(statuses).toEqual([200, 409])
    }
  })
})
