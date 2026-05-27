/**
 * Unit tests for appendAuditLog.
 *
 * The helper is best-effort by contract: a D1 hiccup must NOT propagate
 * to the caller, since the parent mutation has already committed. These
 * tests pin that behavior + the row shape.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { D1Mock } from '../../tests/d1-mock'
import { appendAuditLog } from './auditLog'

function makeEnv() {
  const db = new D1Mock()
  return { DB: db as unknown as D1Database, _db: db }
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('appendAuditLog — happy path', () => {
  it('inserts a row with the supplied fields', async () => {
    const env = makeEnv()
    await appendAuditLog(env, {
      actorEmail: 'marc@x.com',
      tenantId: 't_marc',
      action: 'session.status',
      payload: { sessionId: 's1', from: 'triage', to: 'active' },
    })
    expect(env._db.audit_log.size).toBe(1)
    const row = [...env._db.audit_log.values()][0]
    expect(row.actor_email).toBe('marc@x.com')
    expect(row.tenant_id).toBe('t_marc')
    expect(row.action).toBe('session.status')
    expect(row.payload).toBe(JSON.stringify({ sessionId: 's1', from: 'triage', to: 'active' }))
    expect(typeof row.ts).toBe('number')
    expect(row.id).toMatch(/^aud_/)
  })

  it('stores tenant_id as null when not provided', async () => {
    const env = makeEnv()
    await appendAuditLog(env, {
      actorEmail: 'marc@x.com',
      tenantId: null,
      action: 'session.tier',
      payload: { sessionId: 's1', from: null, to: 2 },
    })
    const row = [...env._db.audit_log.values()][0]
    expect(row.tenant_id).toBeNull()
  })

  it('stores payload as null when undefined', async () => {
    const env = makeEnv()
    await appendAuditLog(env, {
      actorEmail: 'marc@x.com',
      tenantId: null,
      action: 'session.undelete',
      payload: undefined,
    })
    const row = [...env._db.audit_log.values()][0]
    expect(row.payload).toBeNull()
  })
})

describe('appendAuditLog — error swallowing', () => {
  it('does not throw when the underlying INSERT fails', async () => {
    const env = makeEnv()
    // Force the next prepare().bind().run() chain to throw at run().
    const original = env.DB.prepare.bind(env.DB)
    vi.spyOn(env.DB, 'prepare').mockImplementationOnce((sql: string) => {
      const stmt = original(sql)
      const bind = stmt.bind.bind(stmt)
      stmt.bind = ((...args: unknown[]) => {
        const bound = bind(...(args as Parameters<typeof bind>))
        bound.run = () => {
          throw new Error('simulated D1 failure')
        }
        return bound
      }) as typeof stmt.bind
      return stmt
    })
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(
      appendAuditLog(env, {
        actorEmail: 'marc@x.com',
        tenantId: null,
        action: 'session.status',
        payload: { sessionId: 's1' },
      }),
    ).resolves.toBeUndefined()

    expect(env._db.audit_log.size).toBe(0)
    expect(errorSpy).toHaveBeenCalled()
  })
})
