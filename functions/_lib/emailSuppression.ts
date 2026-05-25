// Send-time suppression check (consumes email_events from P1.2).
//
// Three events mean "stop sending to this address":
//   - email.complained        — visitor hit Gmail's "Report spam" or similar
//   - email.unsubscribed      — visitor clicked the one-click unsubscribe link
//   - email.bounced (permanent) — mailbox rejected the send hard (account
//                                 closed, address invalid). Transient bounces
//                                 (greylisting, full mailbox) are ignored — they
//                                 recover on their own.
//
// Honoring these isn't just polite. CASL (Canada's Anti-Spam Legislation)
// requires unsubscribe within 10 business days; "the visitor said stop and
// we kept sending" is also the fast track to Gmail/Outlook silently routing
// every future send to spam.
//
// Magic-link sends check this too. A visitor whose address bounces and who
// then tries to log in will get a hint back ("we can't reach this address")
// rather than a silent successful-looking magic-link request — see
// /api/auth/request-link's handling of the SuppressionResult shape.
//
// Marc's own email (env.ADMIN_EMAILS) is always exempt. Suppression on the
// operator address would silently kill admin alerts + the daily digest.

/** Why an address is suppressed. The shape exists for the caller to
 *  surface a useful hint (e.g. magic-link request handler shows "the
 *  address you typed has unsubscribed" vs "the address bounced"). */
export type SuppressionReason = 'complaint' | 'unsubscribed' | 'hard-bounce'

export interface SuppressionResult {
  suppressed: boolean
  reason?: SuppressionReason
}

const NOT_SUPPRESSED: SuppressionResult = { suppressed: false }

/**
 * Return whether an address is suppressed and why. One indexed SELECT
 * against `email_events` per call — the table's email_events_to_idx
 * (to_email, received_at DESC) covers it.
 *
 * Treats admin emails as never-suppressed regardless of stored events —
 * Marc's own address must always reach him.
 */
export async function isAddressSuppressed(
  db: D1Database,
  email: string,
  adminEmails: string,
): Promise<SuppressionResult> {
  if (!email) return NOT_SUPPRESSED
  const normalized = email.trim().toLowerCase()
  const isAdmin = adminEmails
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .includes(normalized)
  if (isAdmin) return NOT_SUPPRESSED

  // The `OR` over (type, subtype) keeps the suppressed-event predicate
  // colocated with the email lookup. The index can serve to_email; the
  // type/subtype filter is in-memory but a single visitor's row count is
  // tiny so the scan is bounded.
  interface Row {
    type: string
    subtype: string | null
  }
  const res = await db
    .prepare(
      `SELECT type, subtype FROM email_events
       WHERE to_email = ?
         AND (
           type IN ('email.complained', 'email.unsubscribed')
           OR (type = 'email.bounced' AND subtype = 'permanent')
         )
       ORDER BY received_at DESC
       LIMIT 1`,
    )
    .bind(normalized)
    .first<Row>()
  if (!res) return NOT_SUPPRESSED
  if (res.type === 'email.complained') return { suppressed: true, reason: 'complaint' }
  if (res.type === 'email.unsubscribed') return { suppressed: true, reason: 'unsubscribed' }
  return { suppressed: true, reason: 'hard-bounce' }
}

/** Convenience predicate when the caller doesn't care about the reason. */
export async function shouldSkipSend(
  db: D1Database,
  email: string,
  adminEmails: string,
): Promise<boolean> {
  return (await isAddressSuppressed(db, email, adminEmails)).suppressed
}

/**
 * Write a synthetic `email.unsubscribed` event into email_events. Called
 * from the /api/unsubscribe handler once the token verifies. Same shape
 * Resend's webhook would write — the suppression check above can't tell
 * the two apart.
 */
export async function recordUnsubscribe(
  db: D1Database,
  email: string,
  source: 'one-click' | 'browser-click',
  rawPayload: string,
  now: number,
): Promise<void> {
  const id = `unsub_${crypto.randomUUID().slice(0, 16)}`
  await db
    .prepare(
      `INSERT INTO email_events (id, to_email, type, subtype, payload, received_at)
       VALUES (?, ?, 'email.unsubscribed', ?, ?, ?)`,
    )
    .bind(id, email.toLowerCase(), source, rawPayload, now)
    .run()
}
