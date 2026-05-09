import type { Lang } from '../i18n'

const LOCALES: Record<Lang, string> = { fr: 'fr-CA', en: 'en-CA' }

/**
 * Format a date for display.
 *
 * Accepts:
 *   - unix seconds (number) — typical D1 timestamp
 *   - ISO date string ('YYYY-MM-DD') — what intake.submittedAt stores
 *   - full ISO datetime string — falls through to Date parsing
 *
 * Returns a localized "short" date like "Apr 22, 2026" / "22 avr. 2026".
 */
export function formatDate(input: number | string | null | undefined, lang: Lang): string {
  const d = toDate(input)
  if (!d) return ''
  // Date-only inputs are anchored to UTC midnight in toDate(); format them in
  // UTC too so a Quebec visitor doesn't see "Apr 21" for an "Apr 22" intake.
  // Numeric/datetime inputs format in local TZ — that's the right semantics
  // for "X minutes ago"-style timestamps.
  const isDateOnly = typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input)
  return d.toLocaleDateString(LOCALES[lang], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...(isDateOnly ? { timeZone: 'UTC' } : {}),
  })
}

/**
 * Format a date+time. Used for timeline + thread message timestamps.
 */
export function formatDateTime(input: number | string | null | undefined, lang: Lang): string {
  const d = toDate(input)
  if (!d) return ''
  return d.toLocaleString(LOCALES[lang], {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

/**
 * The 72-hour SLA Marc promises in the intake confirmation copy. Applies
 * while the session is in 'draft' or 'triage' status. Once it moves to
 * 'active' the build itself takes over from the response window.
 */
export const SLA_HOURS = 72

export interface SlaInfo {
  /** Unix seconds — when the SLA reply is due. */
  deadline: number
  /** ms remaining until deadline. Negative if overdue. */
  msLeft: number
  /** True iff the SLA is overdue. */
  overdue: boolean
  /** True iff the SLA is in scope for this session's current status. */
  active: boolean
}

export function computeSla(session: { created_at: number; status: string }): SlaInfo {
  const active = session.status === 'draft' || session.status === 'triage'
  const deadline = session.created_at + SLA_HOURS * 3600
  const msLeft = deadline * 1000 - Date.now()
  return { deadline, msLeft, overdue: msLeft < 0, active }
}

/**
 * "in 23h", "12h overdue", "in 2 days" — short, single-line, locale-aware.
 * For SLA pills on the session list and detail.
 */
export function formatRelativeWindow(msLeft: number, lang: Lang): string {
  const overdue = msLeft < 0
  const hours = Math.abs(msLeft) / 3_600_000
  const rtf = new Intl.RelativeTimeFormat(LOCALES[lang], { numeric: 'auto' })
  const sign = overdue ? -1 : 1
  if (hours < 1) {
    const mins = Math.max(1, Math.round(Math.abs(msLeft) / 60_000))
    return rtf.format(sign * mins, 'minute')
  }
  if (hours < 36) return rtf.format(sign * Math.round(hours), 'hour')
  return rtf.format(sign * Math.round(hours / 24), 'day')
}

function toDate(input: number | string | null | undefined): Date | null {
  if (input == null) return null
  if (typeof input === 'number') {
    // Heuristic: anything below 10^12 is unix seconds, else milliseconds.
    return new Date(input < 1e12 ? input * 1000 : input)
  }
  if (typeof input === 'string' && input.length > 0) {
    // Date-only ('YYYY-MM-DD') — pin to UTC midnight to avoid TZ shifting.
    if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return new Date(`${input}T00:00:00Z`)
    const parsed = new Date(input)
    return isNaN(parsed.getTime()) ? null : parsed
  }
  return null
}
