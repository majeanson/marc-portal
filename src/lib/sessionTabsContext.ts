import { createContext, useContext } from 'react'
import type { Lang } from '../i18n'
import type { SessionTabId } from './sessionTabs'

/**
 * Shared state for the session detail tab switcher. The tab BAR renders inside
 * the sticky <Header> (SessionSubHeader), while the PANELS render in
 * <SessionPage>'s <main>. They're in different subtrees, so the active tab +
 * the present-tab list (which depends on the session's status and the viewer's
 * role — knowledge only SessionPage has) travel through this context rather
 * than props. SessionPage owns the state and wraps its whole tree in the
 * provider; SessionSubHeader is the only consumer outside that body.
 */
export interface SessionTabsState {
  /** Present tabs in reading order — see sessionTabsFor(). */
  tabs: SessionTabId[]
  /** The currently shown tab (always one of `tabs`). */
  activeTab: SessionTabId
  /** Switch tabs. Updates the URL hash without scrolling. */
  onSelect: (id: SessionTabId) => void
  lang: Lang
}

export const SessionTabsContext = createContext<SessionTabsState | null>(null)

/**
 * Returns the tab state, or null when there's no provider above. Null is a
 * valid answer (not an error) because <Header> is shared by every page —
 * SessionSubHeader only mounts in the session variant, but the hook stays
 * null-safe so a stray render is a no-op, not a crash.
 */
export function useSessionTabs(): SessionTabsState | null {
  return useContext(SessionTabsContext)
}
