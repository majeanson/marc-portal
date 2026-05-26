// GET /api/admin/audit — operator-only audit-log read endpoint. The
// audit_log table itself is sparse (only tenant/theme.ts writes today),
// but the READ path has three gates that all need to hold:
//   1. signed-in cookie (401 otherwise)
//   2. admin email (403 otherwise)
//   3. tenant.flags.isOperator === true (403 otherwise — the buyer-tenant
//      surface would otherwise leak Marc's operational history)
//
// The endpoint also projects tenant_id → tenant_slug via a JOIN on
// tenants, ordered ts DESC, with a ?limit= clamp (default 50, max 200).
// We seed rows directly to avoid needing the one production writer
// (tenant theme PATCH) in flight here.

import { test, expect } from '@playwright/test'
import { E2E_BASE_URL, E2E_BINDINGS } from './constants'
import { forgeAuthHeaders } from './helpers/auth'
import { clearTestRows, seedAuditLog } from './helpers/db'

const ADMIN_EMAIL = E2E_BINDINGS.ADMIN_EMAILS
const VISITOR_EMAIL = 'visitor-audit@e2e.test'

interface AuditEntryShape {
  id: string
  ts: number
  actorEmail: string
  tenantId: string | null
  tenantSlug: string | null
  action: string
  payload: unknown
}

async function getAudit(headers: Record<string, string> = {}, qs?: string): Promise<Response> {
  return await fetch(`${E2E_BASE_URL}/api/admin/audit${qs ? `?${qs}` : ''}`, {
    method: 'GET',
    headers,
  })
}

test.describe('GET /api/admin/audit — auth wall', () => {
  test.beforeEach(() => clearTestRows())

  test('no cookie → 401', async () => {
    const res = await getAudit()
    expect(res.status).toBe(401)
  })

  test('visitor cookie → 403', async () => {
    const headers = forgeAuthHeaders(VISITOR_EMAIL)
    const res = await getAudit(headers)
    expect(res.status).toBe(403)
  })

  test('admin cookie on the operator tenant → 200', async () => {
    const headers = forgeAuthHeaders(ADMIN_EMAIL)
    const res = await getAudit(headers)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { entries: AuditEntryShape[] }
    expect(Array.isArray(body.entries)).toBe(true)
  })
})

test.describe('GET /api/admin/audit — projection + ordering', () => {
  test.beforeEach(() => clearTestRows())

  test('returns rows in ts DESC order with the projection shape', async () => {
    // Three rows at distinct timestamps; we expect newest-first.
    const now = Math.floor(Date.now() / 1000)
    seedAuditLog({
      actorEmail: ADMIN_EMAIL,
      action: 'theme.update',
      tenantId: 't_marc',
      ts: now - 300,
      payload: { field: 'accent' },
    })
    seedAuditLog({
      actorEmail: ADMIN_EMAIL,
      action: 'theme.update',
      tenantId: 't_marc',
      ts: now - 60,
      payload: { field: 'eyebrow' },
    })
    seedAuditLog({
      actorEmail: ADMIN_EMAIL,
      action: 'theme.update',
      tenantId: 't_marc',
      ts: now - 10,
      payload: { field: 'background' },
    })

    const headers = forgeAuthHeaders(ADMIN_EMAIL)
    const res = await getAudit(headers)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { entries: AuditEntryShape[] }

    expect(body.entries.length).toBeGreaterThanOrEqual(3)
    // Newest first.
    for (let i = 1; i < body.entries.length; i++) {
      expect(body.entries[i - 1].ts).toBeGreaterThanOrEqual(body.entries[i].ts)
    }
    // Projection shape — tenant_slug joined from the tenants table.
    const ours = body.entries.filter((e) => e.action === 'theme.update')
    expect(ours.length).toBeGreaterThanOrEqual(3)
    for (const entry of ours.slice(0, 3)) {
      expect(entry.tenantId).toBe('t_marc')
      expect(entry.tenantSlug).toBe('marc')
      expect(entry.actorEmail).toBe(ADMIN_EMAIL)
    }
  })

  test('?limit=N caps the returned rows (default 50, max 200)', async () => {
    // Seed 5 rows; ask for 3.
    for (let i = 0; i < 5; i++) {
      seedAuditLog({
        actorEmail: ADMIN_EMAIL,
        action: `fixture.${i}`,
        ts: Math.floor(Date.now() / 1000) - i,
      })
    }
    const headers = forgeAuthHeaders(ADMIN_EMAIL)
    const res = await getAudit(headers, 'limit=3')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { entries: AuditEntryShape[] }
    expect(body.entries).toHaveLength(3)
  })

  test('?limit=999 clamps to MAX_LIMIT=200', async () => {
    const headers = forgeAuthHeaders(ADMIN_EMAIL)
    const res = await getAudit(headers, 'limit=999')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { entries: AuditEntryShape[] }
    // We didn't seed 999 rows, so we can't verify the upper bound by
    // counting — but invalid/out-of-range limit must NOT cause a 400.
    expect(body.entries.length).toBeLessThanOrEqual(200)
  })

  test('payload is parsed back into JSON when valid, raw string otherwise', async () => {
    seedAuditLog({
      actorEmail: ADMIN_EMAIL,
      action: 'fixture.json',
      payload: { hello: 'world', n: 42 },
    })
    seedAuditLog({
      actorEmail: ADMIN_EMAIL,
      action: 'fixture.raw',
      // Pass a non-JSON string by stringifying ourselves to a known shape.
      payload: 'not-json-{just-some-text',
    })

    const headers = forgeAuthHeaders(ADMIN_EMAIL)
    const res = await getAudit(headers)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { entries: AuditEntryShape[] }

    const jsonEntry = body.entries.find((e) => e.action === 'fixture.json')
    expect(jsonEntry?.payload).toEqual({ hello: 'world', n: 42 })

    const rawEntry = body.entries.find((e) => e.action === 'fixture.raw')
    // parsePayload returns the raw string when JSON.parse throws.
    expect(rawEntry?.payload).toBe('not-json-{just-some-text')
  })
})
