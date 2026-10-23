// POST /api/questions — anonymous « pose une question ». CSRF-exempt like
// /api/vouches (no cookie context for a stranger), so the defences are the
// validators and the per-email / per-IP rate limits.
//
// What's covered:
//   - happy path writes one admin_alerts row (kind 'visitor-question') that
//     carries the visitor's address and the question, with no cookie and no
//     CSRF header
//   - field validation → 400 and no row
//   - 3rd question from the same address within the hour → 429
//
// What's NOT here: the email to Marc. Resend is stubbed in this harness and
// the handler swallows a send failure on purpose, because the alert row is the
// durable copy the digest surfaces.

import { test, expect } from '@playwright/test'
import { randomBytes } from 'node:crypto'
import { E2E_BASE_URL } from './constants'
import { clearTestRows, countRowsWhere, openD1 } from './helpers/db'

async function ask(body: Record<string, unknown>): Promise<Response> {
  return await fetch(`${E2E_BASE_URL}/api/questions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function freshEmail(): string {
  return `ask-${randomBytes(3).toString('hex')}@e2e.test`
}

test.describe('POST /api/questions', () => {
  test.beforeEach(() => clearTestRows())

  test('stores the question as an admin alert, with no CSRF cookie', async () => {
    const email = freshEmail()
    const res = await ask({ email, body: 'Est-ce le genre de truc que tu fais ?' })
    expect(res.status).toBe(200)

    const db = openD1()
    try {
      const rows = db
        .prepare(`SELECT kind, body, resolved_at FROM admin_alerts WHERE kind = 'visitor-question'`)
        .all() as Array<{ kind: string; body: string; resolved_at: number | null }>
      expect(rows).toHaveLength(1)
      expect(rows[0].body).toContain(email)
      expect(rows[0].body).toContain('genre de truc')
      expect(rows[0].resolved_at).toBeNull()
    } finally {
      db.close()
    }
  })

  test('rejects a bad email, a missing body and a too-short body', async () => {
    expect((await ask({ email: 'nope', body: 'une vraie question ici' })).status).toBe(400)
    expect((await ask({ email: freshEmail() })).status).toBe(400)
    expect((await ask({ email: freshEmail(), body: 'court' })).status).toBe(400)
    expect(
      countRowsWhere(`SELECT COUNT(*) AS c FROM admin_alerts WHERE kind = 'visitor-question'`),
    ).toBe(0)
  })

  test('third question from the same address in an hour → 429', async () => {
    const email = freshEmail()
    expect((await ask({ email, body: 'première question assez longue' })).status).toBe(200)
    expect((await ask({ email, body: 'deuxième question assez longue' })).status).toBe(200)
    expect((await ask({ email, body: 'troisième question assez longue' })).status).toBe(429)
  })
})
