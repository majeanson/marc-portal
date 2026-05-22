import type { Lang } from '../../i18n'
import { DICT } from '../../i18n'
import { SectionEyebrow } from '../SectionEyebrow'
import { SCHEMAS } from '../../lib/intakeSchemas'
import type { ProblemType } from '../../lib/intakeSchemas'
import { localized } from '../../lib/intakeSchemas'

const TYPES: ProblemType[] = ['paperasse', 'suivi', 'coordination', 'autre', 'rescue']

export function TypePicker({
  lang,
  selected,
  onPick,
}: {
  lang: Lang
  selected?: ProblemType
  onPick: (t: ProblemType) => void
}) {
  const t = DICT[lang].intake.typePicker
  return (
    <div className="intake__step">
      <SectionEyebrow lang={lang} feature="intake">
        {t.eyebrow}
      </SectionEyebrow>
      <h2>{t.title}</h2>
      <p>{t.body}</p>
      <div className="type-grid">
        {TYPES.map((type) => {
          const schema = SCHEMAS[type]
          const isSelected = selected === type
          return (
            <button
              key={type}
              type="button"
              className={`type-card${isSelected ? ' type-card--selected' : ''}`}
              onClick={() => onPick(type)}
            >
              <div className="type-card__name mono">{type}</div>
              <h3>{localized(schema.title, lang)}</h3>
              <p>{localized(schema.description, lang)}</p>
            </button>
          )
        })}
      </div>
    </div>
  )
}
