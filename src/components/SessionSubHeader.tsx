import { useRef } from 'react'
import { SESSION_TAB_FEATURE, SESSION_TAB_LABEL } from '../lib/features'
import type { SessionTabId } from '../lib/sessionTabs'
import { useSessionTabs } from '../lib/sessionTabsContext'
import { FeatureDot } from './FeatureDot'

/**
 * Sticky tab bar rendered below the slim session Header on /session/:id. It's
 * a real one-section-at-a-time switcher: clicking a tab swaps the panel that
 * <SessionPage> renders in <main>, it does NOT scroll a long page (the old
 * scroll-spy behaviour is gone). State lives in <SessionPage> and reaches this
 * component through SessionTabsContext — the present-tab list depends on the
 * session's status and the viewer's role, which only the page knows.
 *
 * Which tabs exist is decided by sessionTabsFor() (e.g. Paiement only for
 * active/shipped, Opérateur only for the admin), so a tab is never rendered
 * pointing at a panel that wouldn't show.
 *
 * ARIA tabs pattern: role="tablist" with role="tab" children, roving tabindex,
 * and Left/Right/Home/End to move between tabs (selection follows focus). The
 * matching role="tabpanel" elements live in SessionPage.
 */
export function SessionSubHeader() {
  // Everything (including lang) rides on the context so the bar and the panels
  // can never disagree about which tab is live.
  const ctx = useSessionTabs()
  const tabRefs = useRef<Partial<Record<SessionTabId, HTMLButtonElement | null>>>({})

  // No provider (non-session render) or no tabs yet → render nothing.
  if (!ctx || ctx.tabs.length === 0) return null
  const { tabs, activeTab, onSelect, lang } = ctx

  const focusTab = (id: SessionTabId) => {
    onSelect(id)
    // Move focus to the newly selected tab so keyboard users land where they
    // expect; the ref may be null for a frame, hence the optional chain.
    tabRefs.current[id]?.focus()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    const i = tabs.indexOf(activeTab)
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault()
      const delta = e.key === 'ArrowRight' ? 1 : -1
      // Wrap around the ends — the canonical tablist behaviour.
      focusTab(tabs[(i + delta + tabs.length) % tabs.length])
    } else if (e.key === 'Home') {
      e.preventDefault()
      focusTab(tabs[0])
    } else if (e.key === 'End') {
      e.preventDefault()
      focusTab(tabs[tabs.length - 1])
    }
  }

  return (
    <nav className="session-subheader" aria-label="Session sections">
      <div className="session-subheader__inner" role="tablist">
        {tabs.map((id) => {
          const isActive = id === activeTab
          // Tab borrows --ft-color from SESSION_TAB_FEATURE so the active
          // underline / hover colour matches the section it leads to — same
          // one-feature-one-hue story the page-mast folio + /carte cluster
          // carry. session-operateur is undefined (it crosses features) and
          // renders a neutral hollow dot.
          const feature = SESSION_TAB_FEATURE[id]
          return (
            <button
              key={id}
              ref={(el) => {
                tabRefs.current[id] = el
              }}
              type="button"
              role="tab"
              id={`${id}-tab`}
              aria-controls={`${id}-panel`}
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              data-feature={feature}
              className={`session-subheader__tab mono${isActive ? ' session-subheader__tab--active' : ''}`}
              onClick={() => onSelect(id)}
              onKeyDown={onKeyDown}
            >
              <FeatureDot
                feature={feature}
                lang={lang}
                size="sm"
                decorative
                className="session-subheader__tab-dot"
              />
              {SESSION_TAB_LABEL[id][lang]}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
