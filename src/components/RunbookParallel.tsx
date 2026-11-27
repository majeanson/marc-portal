/**
 * Parallel renderer for Track A + Track B. Renders both tracks side-by-side
 * on desktop, stacked on mobile (CSS media query).
 *
 * The parallel framing is the load-bearing UX: each Track-B step that has
 * a `dependsOn` links visually to its Track-A prerequisite. When the
 * prerequisite is unchecked, the B row gets a red flag — making it obvious
 * which user-journey steps will silently break if the handoff is left half-
 * done.
 *
 * Single shared view toggle controls both tracks (summary vs detail).
 */

import { useState } from 'react'
import type { Lang } from '../i18n'
import { DICT } from '../i18n'
import { trackA } from '../lib/runbook/trackA'
import { trackB } from '../lib/runbook/trackB'
import { Runbook } from './Runbook'

type ViewMode = 'summary' | 'detail'

export function RunbookParallel({ lang }: { lang: Lang }) {
  // Local controller for "Expand both" / "Collapse both" — we don't pipe it
  // into the child <Runbook> via initialView, because each Runbook owns its
  // own toggle. The shared button below just rapid-fires the per-track
  // toggle. Simpler: use a controlled flag and pass via key remount.
  const [view, setView] = useState<ViewMode>('summary')
  const t = DICT[lang].runbook.parallel

  return (
    <div className="runbook-parallel">
      <div className="surface runbook-parallel__bar">
        <p className="runbook-parallel__lede">{t.lede}</p>
        <div
          className="runbook-toggle runbook-toggle--shared"
          role="group"
          aria-label={t.sharedView}
        >
          <button
            type="button"
            className={`runbook-toggle__btn${view === 'summary' ? ' runbook-toggle__btn--active' : ''}`}
            aria-pressed={view === 'summary'}
            onClick={() => setView('summary')}
          >
            {t.collapseAll}
          </button>
          <button
            type="button"
            className={`runbook-toggle__btn${view === 'detail' ? ' runbook-toggle__btn--active' : ''}`}
            aria-pressed={view === 'detail'}
            onClick={() => setView('detail')}
          >
            {t.expandAll}
          </button>
        </div>
      </div>

      <div className="runbook-parallel__grid">
        {/* `key={view}` remount is intentional: it forces the child Runbook
            to re-initialize its internal view state to the shared one. Cost:
            per-step expand collapses on toggle. Worth it for the shared bar. */}
        <Runbook key={`A-${view}`} track={trackA} lang={lang} initialView={view} />
        <Runbook key={`B-${view}`} track={trackB} lang={lang} initialView={view} showDependencies />
      </div>
    </div>
  )
}
