// Direct SQLite access to the local D1 file Miniflare writes under
// .wrangler-e2e/v3/d1/miniflare-D1DatabaseObject/<hash>.sqlite. Uses the
// experimental node:sqlite module shipped with Node 22+ — no native build
// step, no new devDep, no @emnapi platform-lockfile drama.
//
// Two access modes are normally needed:
//   1. Test setup writes a seed row (sessions, user_prefs, …) before the
//      spec drives the browser.
//   2. Test assertions read a row to confirm the loop closed (a payments
//      row arrived at status='paid' after the synthetic webhook).
//
// SQLite is in WAL mode here, so a writer outside Miniflare AND Miniflare's
// reader coexist correctly. Writes commit immediately; the wrangler-side
// reader sees them on next query.

import { readdirSync } from 'node:fs'
import { resolve } from 'node:path'
// @ts-expect-error — node:sqlite is experimental; types not yet shipped.
import { DatabaseSync } from 'node:sqlite'
import { E2E_PERSIST_DIR } from '../constants'

const D1_SUBPATH = 'v3/d1/miniflare-D1DatabaseObject'

/**
 * Resolve the absolute path to the Miniflare-managed D1 SQLite file. The
 * filename is a content-hash chosen by Miniflare — we glob the directory
 * rather than hardcode it, because the hash changes if the binding name
 * or db name ever changes in wrangler.toml.
 */
export function resolveD1Path(): string {
  const dir = resolve(E2E_PERSIST_DIR, D1_SUBPATH)
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch (err) {
    throw new Error(
      `e2e: D1 SQLite dir not found at ${dir} — did you run \`npm run e2e:backend:setup\` first? (${(err as Error).message})`,
    )
  }
  // Skip Miniflare's bookkeeping file (metadata.sqlite) — the real D1 file
  // is the hash-named one alongside it.
  const sqlite = entries.find((name) => name.endsWith('.sqlite') && name !== 'metadata.sqlite')
  if (!sqlite) {
    throw new Error(`e2e: no .sqlite file under ${dir} — migrations may have failed silently`)
  }
  return resolve(dir, sqlite)
}

/**
 * Open a fresh DatabaseSync handle. Callers should close() when done — the
 * handle holds an OS-level file descriptor.
 */
export function openD1(): InstanceType<typeof DatabaseSync> {
  return new DatabaseSync(resolveD1Path())
}

interface SeedSessionOpts {
  id: string
  email: string
  /** 0 (Tier 0 free) through 4. Default 1 — Phase 1 spec's case. */
  tier?: number
  /** Session lifecycle status. Default 'active' (post-triage). */
  status?: 'draft' | 'triage' | 'active' | 'shipped' | 'rejected'
  /** Stored as the JSON column. Default '{}'. */
  intakeJson?: string
  /** Optional showcase title — surfaces in payment line-item labels. */
  showcaseTitle?: string | null
}

/**
 * Insert a minimal session row plus the columns later migrations add. Any
 * column not exposed here keeps its schema default — see the migrations
 * under functions/db/migrations/ for the canonical list.
 */
export function seedSession(opts: SeedSessionOpts): void {
  const now = Math.floor(Date.now() / 1000)
  const db = openD1()
  try {
    db.prepare(
      `INSERT INTO sessions (id, email, intake_json, status, tier, showcase_title, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      opts.id,
      opts.email.toLowerCase(),
      opts.intakeJson ?? '{}',
      opts.status ?? 'active',
      opts.tier ?? 1,
      opts.showcaseTitle ?? null,
      now,
      now,
    )
  } finally {
    db.close()
  }
}

/**
 * Returns the row currently in the payments table for a given paymentId, or
 * undefined if none. Used by assertions to confirm webhook → DB landed.
 */
export interface PaymentRow {
  id: string
  session_id: string
  kind: string
  status: string
  amount_cents: number
  paid_at: number | null
  stripe_checkout_session_id: string | null
  stripe_payment_intent_id: string | null
}

export function readPayment(paymentId: string): PaymentRow | undefined {
  const db = openD1()
  try {
    return db
      .prepare(
        `SELECT id, session_id, kind, status, amount_cents, paid_at,
                stripe_checkout_session_id, stripe_payment_intent_id
           FROM payments WHERE id = ?`,
      )
      .get(paymentId) as PaymentRow | undefined
  } finally {
    db.close()
  }
}

/**
 * Best-effort wipe between tests — keeps the schema, drops the data. Useful
 * when a spec runs multiple sub-cases on the same db file.
 */
export function clearTestRows(): void {
  const db = openD1()
  try {
    db.exec('DELETE FROM payments; DELETE FROM webhook_events; DELETE FROM sessions;')
  } finally {
    db.close()
  }
}
