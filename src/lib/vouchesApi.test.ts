import { describe, expect, it } from 'vitest'
import { partitionAdminVouches, type AdminVouch } from './vouchesApi'

function mk(overrides: Partial<AdminVouch>): AdminVouch {
  return {
    id: overrides.id ?? 'id-' + Math.random().toString(36).slice(2, 8),
    author_name: 'Test',
    author_relationship: 'client',
    body: 'Some sufficiently long body text for the test fixture.',
    link_url: null,
    session_id: null,
    created_at: 1_700_000_000,
    author_email: 'test@example.com',
    status: 'pending',
    approved_at: null,
    deleted_at: null,
    ...overrides,
  }
}

describe('partitionAdminVouches', () => {
  it('returns four empty buckets for an empty input', () => {
    const r = partitionAdminVouches([])
    expect(r.pending).toEqual([])
    expect(r.approved).toEqual([])
    expect(r.rejected).toEqual([])
    expect(r.trash).toEqual([])
  })

  it('groups by status when nothing is soft-deleted', () => {
    const p = mk({ id: 'p1', status: 'pending' })
    const a = mk({ id: 'a1', status: 'approved' })
    const r = mk({ id: 'r1', status: 'rejected' })
    const out = partitionAdminVouches([p, a, r])
    expect(out.pending).toEqual([p])
    expect(out.approved).toEqual([a])
    expect(out.rejected).toEqual([r])
    expect(out.trash).toEqual([])
  })

  it('routes soft-deleted rows to trash regardless of status', () => {
    // The status column can hold its last value when a row is deleted —
    // a deleted-while-pending vouch should still surface under Trash, not
    // under Pending. Otherwise the operator can't tell what's in the
    // active queue at a glance.
    const deletedPending = mk({ id: 'dp', status: 'pending', deleted_at: 1_700_000_500 })
    const deletedApproved = mk({ id: 'da', status: 'approved', deleted_at: 1_700_000_600 })
    const stillPending = mk({ id: 'sp', status: 'pending' })
    const out = partitionAdminVouches([deletedPending, deletedApproved, stillPending])
    expect(out.pending).toEqual([stillPending])
    expect(out.approved).toEqual([])
    expect(out.trash).toEqual([deletedPending, deletedApproved])
  })

  it('preserves input order within each bucket', () => {
    const first = mk({ id: 'first', status: 'pending', created_at: 100 })
    const second = mk({ id: 'second', status: 'pending', created_at: 200 })
    const third = mk({ id: 'third', status: 'pending', created_at: 300 })
    const out = partitionAdminVouches([first, second, third])
    expect(out.pending).toEqual([first, second, third])
  })
})
