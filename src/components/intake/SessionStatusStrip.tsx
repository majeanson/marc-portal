import type { Lang } from '../../i18n'
import type { SessionStatus } from '../../lib/sessionsApi'

const COPY = {
  fr: {
    label: 'Étape de la session',
    draft: 'Brouillon',
    triage: 'Triage',
    active: 'En cours',
    shipped: 'Livré',
    rejected: 'Refusé',
  },
  en: {
    label: 'Session stage',
    draft: 'Draft',
    triage: 'Triage',
    active: 'In progress',
    shipped: 'Shipped',
    rejected: 'Rejected',
  },
} as const

const FLOW: SessionStatus[] = ['draft', 'triage', 'active', 'shipped']

/**
 * Visual mirror of `intake__progress` for live sessions. Shares pill styling so
 * the /intake confirmation step and /session/:id read as one continuous flow.
 *
 * `rejected` is a terminal off-rail state — rendered as a single trailing pill
 * rather than a numbered step.
 */
export function SessionStatusStrip({
  lang,
  status,
  onPick,
}: {
  lang: Lang
  status: SessionStatus
  /** Admin only — when provided, each step pill becomes a button. */
  onPick?: (next: SessionStatus) => void
}) {
  const t = COPY[lang]
  const currentIdx = FLOW.indexOf(status)
  // When status is 'rejected', the rail is locked — show no progress.
  const railIdx = status === 'rejected' ? -1 : currentIdx

  return (
    <ol
      className="intake__progress session-strip"
      aria-label={t.label}
      role={onPick ? 'group' : undefined}
    >
      {FLOW.map((s, i) => {
        const isCurrent = s === status
        const isDone = railIdx >= 0 && i < railIdx
        const stepClass = `intake__progress-step${isDone || isCurrent ? ' intake__progress-step--done' : ''}${isCurrent ? ' intake__progress-step--current' : ''}`
        const label = `0${i + 1} · ${t[s]}`
        return (
          <li key={s} className="intake__progress-item">
            {onPick ? (
              <button
                type="button"
                className={`${stepClass} mono`}
                onClick={() => onPick(s)}
                disabled={isCurrent}
                aria-current={isCurrent ? 'step' : undefined}
              >
                {label}
              </button>
            ) : (
              <span className={`${stepClass} mono`} aria-current={isCurrent ? 'step' : undefined}>
                {label}
              </span>
            )}
          </li>
        )
      })}
      {(status === 'rejected' || onPick) && (
        <li className="intake__progress-item session-strip__off-rail">
          {onPick ? (
            <button
              type="button"
              className={`intake__progress-step session-strip__rejected mono${status === 'rejected' ? ' session-strip__rejected--on' : ''}`}
              onClick={() => onPick('rejected')}
              disabled={status === 'rejected'}
              aria-current={status === 'rejected' ? 'step' : undefined}
            >
              ✕ {t.rejected}
            </button>
          ) : (
            <span
              className="intake__progress-step session-strip__rejected session-strip__rejected--on mono"
              aria-current="step"
            >
              ✕ {t.rejected}
            </span>
          )}
        </li>
      )}
    </ol>
  )
}
