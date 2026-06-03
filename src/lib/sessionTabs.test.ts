import { describe, expect, it } from 'vitest'
import { resolveActiveTab, sessionTabsFor, type SessionTabId } from './sessionTabs'

describe('sessionTabsFor', () => {
  it('triage visitor: no Paiement, no Opérateur', () => {
    expect(sessionTabsFor({ status: 'triage', isAdmin: false })).toEqual([
      'session-statut',
      'session-conversation',
      'session-builds',
      'session-intake',
    ])
  })

  it('active visitor: Paiement appears', () => {
    const tabs = sessionTabsFor({ status: 'active', isAdmin: false })
    expect(tabs).toContain('session-paiement')
    expect(tabs).not.toContain('session-operateur')
  })

  it('shipped visitor: Paiement present (custodian/handoff lives there)', () => {
    expect(sessionTabsFor({ status: 'shipped', isAdmin: false })).toContain('session-paiement')
  })

  it('rejected visitor: no Paiement', () => {
    expect(sessionTabsFor({ status: 'rejected', isAdmin: false })).not.toContain('session-paiement')
  })

  it('admin always gets the Opérateur tab, kept last', () => {
    for (const status of ['draft', 'triage', 'active', 'shipped', 'rejected'] as const) {
      const tabs = sessionTabsFor({ status, isAdmin: true })
      expect(tabs).toContain('session-operateur')
      expect(tabs[tabs.length - 1]).toBe('session-operateur')
    }
  })

  it('reading order: Statut and Conversation come first', () => {
    const tabs = sessionTabsFor({ status: 'active', isAdmin: true })
    expect(tabs[0]).toBe('session-statut')
    expect(tabs[1]).toBe('session-conversation')
  })
})

describe('resolveActiveTab', () => {
  const tabs: SessionTabId[] = ['session-statut', 'session-conversation', 'session-intake']

  it('returns the tab named by the hash (with #)', () => {
    expect(resolveActiveTab('#session-conversation', tabs)).toBe('session-conversation')
  })

  it('tolerates a hash without the leading #', () => {
    expect(resolveActiveTab('session-intake', tabs)).toBe('session-intake')
  })

  it('falls back to the first tab on an empty hash', () => {
    expect(resolveActiveTab('', tabs)).toBe('session-statut')
  })

  it('falls back to the first tab when the hash names an absent tab', () => {
    // e.g. a #session-paiement deep link into a triage session.
    expect(resolveActiveTab('#session-paiement', tabs)).toBe('session-statut')
  })
})
