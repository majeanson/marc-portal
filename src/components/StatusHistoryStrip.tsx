import type { Lang } from '../i18n'
import { DICT } from '../i18n'
import type { FeatureJson } from '../lib/showcases'
import { getStatusHistory } from '../lib/showcases'

const LIFECYCLE: Array<'draft' | 'active' | 'frozen'> = ['draft', 'active', 'frozen']

/**
 * Horizontal lifecycle strip showing where the feature is in its draft → active → frozen
 * progression. Past transitions render as filled dots with their real dates; the current
 * status is highlighted; future transitions render as outlined dots labeled as targets.
 * Honesty: targets are clearly distinguished from history.
 */
export function StatusHistoryStrip({
  feature,
  lang,
  targetShipDate,
}: {
  feature: FeatureJson
  lang: Lang
  targetShipDate?: string | null
}) {
  const t = DICT[lang].showcase.lifecycle
  const transitions = getStatusHistory(feature)
  const currentIdx = LIFECYCLE.indexOf(feature.status as 'draft' | 'active' | 'frozen')

  return (
    <div className="lifecycle" aria-label={t.label}>
      {LIFECYCLE.map((stage, i) => {
        const isPast = i < currentIdx
        const isCurrent = i === currentIdx
        const transition = transitions.find((tr) => tr.to === stage)
        const date = transition?.date
        const isTarget = !isPast && !isCurrent && stage === 'frozen' && targetShipDate

        let mode: 'past' | 'current' | 'target' | 'future' = 'future'
        if (isPast) mode = 'past'
        else if (isCurrent) mode = 'current'
        else if (isTarget) mode = 'target'

        return (
          <div key={stage} className={`lifecycle__node lifecycle__node--${mode}`}>
            <span className="lifecycle__dot" aria-hidden="true" />
            <div className="lifecycle__label">
              <div className="lifecycle__stage mono">{t.stages[stage]}</div>
              <div className="lifecycle__date mono">
                {date ?? (isTarget ? `→ ${targetShipDate}` : isCurrent ? t.today : '—')}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
