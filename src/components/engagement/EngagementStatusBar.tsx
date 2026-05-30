import type { Lang } from '../../i18n'
import { DICT } from '../../i18n'
import type { EngagementStage, StageEvent } from '../../lib/engagements'
import { Surface } from '../Surface'

const ORDER: EngagementStage[] = ['triage', 'planning', 'building', 'review', 'shipped']

export function EngagementStatusBar({ lang, stages }: { lang: Lang; stages: StageEvent[] }) {
  const t = DICT[lang].engagement.stages
  return (
    <Surface className="eng-status" aria-label={DICT[lang].engagement.statusBarLabel}>
      {ORDER.map((stage) => {
        const event = stages.find((s) => s.stage === stage)
        const isCurrent = event?.current ?? false
        const isDone = event?.completed ?? false
        const mode: 'past' | 'current' | 'future' = isDone
          ? 'past'
          : isCurrent
            ? 'current'
            : 'future'
        return (
          <div key={stage} className={`eng-status__node eng-status__node--${mode}`}>
            <span className="eng-status__dot" aria-hidden="true" />
            <div className="eng-status__label mono">
              <div className="eng-status__stage">{t[stage]}</div>
              <div className="eng-status__date">{event?.date ?? '—'}</div>
            </div>
          </div>
        )
      })}
    </Surface>
  )
}
