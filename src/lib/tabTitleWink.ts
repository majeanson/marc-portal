import { useEffect } from 'react'

/**
 * Swap the browser tab title when the visitor switches away, restore it when
 * they come back. Quirky little "come back" wave that fits Marc's handmade
 * voice — also a low-cost retention nudge for visitors who tab-park the site
 * while shopping around.
 *
 * Scope is intentionally Home-only — admin/intake/session pages have task-
 * specific titles (unread counts, session names) where a generic "reviens-moi"
 * would be confusing.
 *
 * Re-arms whenever `awayTitle` changes (e.g. language switch on /en).
 */
export function useTabTitleWink(awayTitle: string): void {
  useEffect(() => {
    if (typeof document === 'undefined') return
    let restoreTo = document.title

    const onChange = () => {
      if (document.visibilityState === 'hidden') {
        // Capture the latest title at hide-time — another effect may have
        // updated it after mount (lang switch, route remount, etc).
        restoreTo = document.title
        document.title = awayTitle
      } else {
        document.title = restoreTo
      }
    }

    document.addEventListener('visibilitychange', onChange)
    return () => {
      document.removeEventListener('visibilitychange', onChange)
    }
  }, [awayTitle])
}
