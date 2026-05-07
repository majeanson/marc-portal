import type { Lang } from '../../i18n'
import { DICT } from '../../i18n'
import type { Account } from './AccountStep'
import type { ProblemType } from '../../lib/intakeSchemas'
import { getSchemaForType, localized } from '../../lib/intakeSchemas'
import type { FormData } from './TypeForm'

export function Confirmation({
  lang,
  account,
  type,
  values,
  waitlist,
  submittedAt,
  onStartOver,
}: {
  lang: Lang
  account: Account
  type: ProblemType
  values: FormData
  waitlist: boolean
  submittedAt: string
  onStartOver: () => void
}) {
  const t = DICT[lang].intake.confirmation
  const schema = getSchemaForType(type)

  return (
    <div className="intake__step">
      <div className="section__eyebrow">{waitlist ? t.eyebrowWaitlist : t.eyebrowAccepted}</div>
      <h2>{waitlist ? t.titleWaitlist : t.titleAccepted}</h2>
      <p>{waitlist ? t.bodyWaitlist : t.bodyAccepted}</p>

      <div className="confirmation__sla">
        <span className="mono" style={{ color: 'var(--accent-warm)' }}>
          {t.sla}
        </span>
      </div>

      <section className="showcase-page__block">
        <h3 style={{ marginBottom: 12 }}>{t.summaryTitle}</h3>
        <dl className="summary">
          <dt>{t.summaryEmail}</dt>
          <dd className="mono">{account.email}</dd>
          {account.name && (
            <>
              <dt>{t.summaryName}</dt>
              <dd>{account.name}</dd>
            </>
          )}
          <dt>{t.summaryType}</dt>
          <dd>{localized(schema.title, lang)}</dd>
          <dt>{t.summarySubmittedAt}</dt>
          <dd className="mono">{submittedAt}</dd>
        </dl>

        <h3 style={{ marginTop: 24, marginBottom: 12 }}>{t.summaryAnswers}</h3>
        <dl className="summary">
          {schema.fields.map((field) => {
            const v = values[field.id]
            if (!v) return null
            return (
              <div key={field.id} style={{ marginBottom: 10 }}>
                <dt>{localized(field.label, lang)}</dt>
                <dd>{v}</dd>
              </div>
            )
          })}
        </dl>
      </section>

      <button type="button" className="link-btn mono" onClick={onStartOver}>
        {t.startOver}
      </button>
    </div>
  )
}
