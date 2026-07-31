import type { SessionStatus } from './sessionsApi'

/**
 * The session detail surface is a one-section-at-a-time tab switcher. These
 * pure helpers decide WHICH tabs exist for a given session+viewer and which
 * one is active from the URL hash — kept out of the component so the branching
 * is unit-testable and the same answer drives both the tab bar (in the sticky
 * Header) and the panel that renders below it.
 */

export type SessionTabId =
  | 'session-statut'
  | 'session-conversation'
  | 'session-paiement'
  | 'session-builds'
  | 'session-intake'
  | 'session-operateur'

/**
 * Tabs present for a session, in reading order. Statut + Conversation +
 * Suivi + Intake are always there; Paiement only once there's money in play
 * (active/shipped — the same gate the page used to render PaymentActions
 * inline); Opérateur only for the admin.
 */
export function sessionTabsFor({
  status,
  isAdmin,
}: {
  status: SessionStatus
  isAdmin: boolean
}): SessionTabId[] {
  const tabs: SessionTabId[] = ['session-statut', 'session-conversation']
  if (status === 'active' || status === 'shipped') tabs.push('session-paiement')
  tabs.push('session-builds', 'session-intake')
  if (isAdmin) tabs.push('session-operateur')
  return tabs
}

/**
 * Resolve the active tab from a URL hash (with or without the leading '#').
 * Falls back to the first present tab when the hash is empty or names a tab
 * that isn't on this session (e.g. a #session-paiement deep link into a triage
 * session, where the Paiement tab doesn't exist). `tabs` is always non-empty.
 */
export function resolveActiveTab(hash: string, tabs: SessionTabId[]): SessionTabId {
  const id = hash.replace(/^#/, '') as SessionTabId
  return tabs.includes(id) ? id : tabs[0]
}
