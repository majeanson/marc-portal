/**
 * One-page proposal sheet — a print-composed brief of what the visitor
 * submitted through intake.
 *
 * The confirmation step already shows an on-screen IntakeSummary; this is
 * its print counterpart: hidden on screen (see the @media rules in
 * styles.css), it becomes the entire printed page when the visitor uses
 * the "save as PDF" button, so they can keep or forward a clean brief.
 *
 * It reads the same intake data the confirmation holds — no network — and
 * resolves select/radio answers through the schema so a stored option
 * value prints as its human label. Print colours are hard-coded ink-on-
 * paper: the site's dark theme must not bleed into a printed document.
 */

import type { Lang } from '../../i18n'
import type { Account } from './AccountStep'
import type { FieldDef, ProblemType } from '../../lib/intakeSchemas'
import { getSchemaForType, localized } from '../../lib/intakeSchemas'
import type { FormData } from './TypeForm'
import { formatDate } from '../../lib/format'

const COPY = {
  fr: {
    docTitle: 'Dossier de projet',
    preparedFor: 'Préparé pour',
    projectType: 'Type de projet',
    submitted: 'Soumis le',
    place: 'marc.portal · Québec',
    noAnswer: 'Pas de réponse',
  },
  en: {
    docTitle: 'Project brief',
    preparedFor: 'Prepared for',
    projectType: 'Project type',
    submitted: 'Submitted',
    place: 'marc.portal · Québec',
    noAnswer: 'No answer',
  },
} as const

/** A stored answer rendered for reading — select/radio values resolve to
 *  their human label; everything else prints as typed. */
function answerFor(field: FieldDef, raw: string, lang: Lang, dash: string): string {
  const value = (raw ?? '').trim()
  if (!value) return dash
  if ((field.type === 'select' || field.type === 'radio') && field.options) {
    const option = field.options.find((o) => o.value === value)
    return option ? localized(option.label, lang) : value
  }
  return value
}

export function ProposalSheet({
  lang,
  account,
  type,
  values,
  submittedAt,
}: {
  lang: Lang
  account: Account
  type: ProblemType
  values: FormData
  submittedAt: string
}) {
  const t = COPY[lang]
  const schema = getSchemaForType(type)
  const preparedFor = account.name?.trim() || account.email
  const date = formatDate(submittedAt, lang)

  return (
    <article className="proposal-sheet">
      <header className="proposal-sheet__mast">
        <span className="proposal-sheet__brand">
          marc<span className="proposal-sheet__dot">.</span>portal
        </span>
        <span className="proposal-sheet__date mono">{date}</span>
      </header>

      <h1 className="proposal-sheet__title">{t.docTitle}</h1>

      <dl className="proposal-sheet__meta">
        <div>
          <dt className="mono">{t.preparedFor}</dt>
          <dd>{preparedFor}</dd>
        </div>
        <div>
          <dt className="mono">{t.projectType}</dt>
          <dd>{localized(schema.title, lang)}</dd>
        </div>
      </dl>

      <p className="proposal-sheet__intro">{localized(schema.description, lang)}</p>

      <dl className="proposal-sheet__answers">
        {schema.fields.map((field) => (
          <div key={field.id} className="proposal-sheet__qa">
            <dt>{localized(field.label, lang)}</dt>
            <dd>{answerFor(field, values[field.id] ?? '', lang, t.noAnswer)}</dd>
          </div>
        ))}
      </dl>

      <footer className="proposal-sheet__foot mono">
        {t.submitted} {date} · {t.place}
      </footer>
    </article>
  )
}
