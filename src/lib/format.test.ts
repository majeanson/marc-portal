import { describe, expect, it, vi, afterEach } from 'vitest'
import { computeSla, formatDate, formatDateTime, formatRelativeWindow, SLA_HOURS } from './format'

describe('formatDate', () => {
  it('returns empty string for null/undefined/empty', () => {
    expect(formatDate(null, 'fr')).toBe('')
    expect(formatDate(undefined, 'fr')).toBe('')
    expect(formatDate('', 'fr')).toBe('')
  })

  it('formats unix seconds in en-CA short style', () => {
    const unix = Math.floor(new Date('2026-04-22T12:00:00Z').getTime() / 1000)
    const out = formatDate(unix, 'en')
    // Allow either "Apr 22, 2026" or locale variants — month name, day, year all present
    expect(out).toMatch(/Apr/)
    expect(out).toMatch(/22/)
    expect(out).toMatch(/2026/)
  })

  it('treats numbers >1e12 as milliseconds', () => {
    const ms = new Date('2026-04-22T12:00:00Z').getTime()
    const out = formatDate(ms, 'en')
    expect(out).toMatch(/2026/)
  })

  it('parses ISO date-only strings as UTC midnight (no TZ shift)', () => {
    const out = formatDate('2026-04-22', 'en')
    // Should be Apr 22 regardless of host TZ
    expect(out).toMatch(/Apr/)
    expect(out).toMatch(/22/)
  })

  it('returns empty string for unparseable input', () => {
    expect(formatDate('not a date', 'fr')).toBe('')
  })

  it('respects French locale', () => {
    const unix = Math.floor(new Date('2026-04-22T12:00:00Z').getTime() / 1000)
    const out = formatDate(unix, 'fr')
    // fr-CA short month: "avr."
    expect(out.toLowerCase()).toMatch(/avr/)
  })
})

describe('formatDateTime', () => {
  it('includes time component', () => {
    const unix = Math.floor(new Date('2026-04-22T12:34:00Z').getTime() / 1000)
    const out = formatDateTime(unix, 'en')
    // Some digit pair before/after — locale may pad differently
    expect(out).toMatch(/\d{1,2}:\d{2}/)
  })

  it('returns empty string on bad input', () => {
    expect(formatDateTime(null, 'fr')).toBe('')
  })
})

describe('computeSla', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('marks active for draft and triage', () => {
    const created = Math.floor(Date.now() / 1000)
    expect(computeSla({ created_at: created, status: 'draft' }).active).toBe(true)
    expect(computeSla({ created_at: created, status: 'triage' }).active).toBe(true)
  })

  it('marks inactive for active/shipped/rejected', () => {
    const created = Math.floor(Date.now() / 1000)
    expect(computeSla({ created_at: created, status: 'active' }).active).toBe(false)
    expect(computeSla({ created_at: created, status: 'shipped' }).active).toBe(false)
    expect(computeSla({ created_at: created, status: 'rejected' }).active).toBe(false)
  })

  it('overdue once past 72h since created_at', () => {
    vi.useFakeTimers()
    const created = Math.floor(Date.now() / 1000)
    // Jump 73h forward
    vi.setSystemTime(new Date(Date.now() + 73 * 3600 * 1000))
    const sla = computeSla({ created_at: created, status: 'triage' })
    expect(sla.overdue).toBe(true)
    expect(sla.msLeft).toBeLessThan(0)
  })

  it('not overdue at 71h', () => {
    vi.useFakeTimers()
    const created = Math.floor(Date.now() / 1000)
    vi.setSystemTime(new Date(Date.now() + 71 * 3600 * 1000))
    const sla = computeSla({ created_at: created, status: 'triage' })
    expect(sla.overdue).toBe(false)
    expect(sla.msLeft).toBeGreaterThan(0)
  })

  it('deadline = created_at + SLA_HOURS', () => {
    const created = 1_700_000_000
    expect(computeSla({ created_at: created, status: 'triage' }).deadline).toBe(
      created + SLA_HOURS * 3600,
    )
  })
})

describe('formatRelativeWindow', () => {
  it('uses minutes when under 1h', () => {
    const out = formatRelativeWindow(30 * 60_000, 'en')
    expect(out).toMatch(/min/i)
  })

  it('uses hours under 36h', () => {
    const out = formatRelativeWindow(10 * 3_600_000, 'en')
    expect(out).toMatch(/hour/i)
  })

  it('uses days at 36h+', () => {
    const out = formatRelativeWindow(50 * 3_600_000, 'en')
    expect(out).toMatch(/day/i)
  })

  it('formats negative values as past', () => {
    const out = formatRelativeWindow(-5 * 3_600_000, 'en')
    expect(out).toMatch(/ago|hour/i)
  })
})
