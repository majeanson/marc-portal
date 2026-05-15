import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Lang } from '../i18n'
import { DICT } from '../i18n'
import type { ProblemType } from '../lib/intakeSchemas'
import { loadDraft, saveDraft } from '../lib/draft'

const TYPES: ProblemType[] = ['paperasse', 'suivi', 'coordination', 'autre']

/**
 * Soft on-ramp surfaced on the home page. Visitor picks a project type and
 * gets shuttled into /intake with the choice already recorded in the draft,
 * so the type-picker step inside the intake flow is skipped. The Vibe gate
 * still runs (one-way fit check) and the account step still asks for an
 * email — the win is two steps becoming one in the visitor's perception.
 *
 * The draft we write here uses the same `intake-draft` localStorage key
 * the Intake page reads; if there's an existing draft we merge so we never
 * stomp partial work in progress.
 */
export function InlineIntakeTeaser({ lang }: { lang: Lang }) {
  const t = DICT[lang].inlineTeaser
  const navigate = useNavigate()
  const [picked, setPicked] = useState<ProblemType | null>(null)
  const langPrefix = lang === 'en' ? '/en' : ''

  function commit(type: ProblemType) {
    setPicked(type)
    type IntakeDraftShape = {
      formData: Record<string, unknown>
      type?: ProblemType
      account?: { email: string; name?: string }
    }
    const existing = loadDraft<IntakeDraftShape>('intake-draft') ?? { formData: {} }
    // Reset formData only if the visitor changes type — keeps any in-flight
    // answers for the same type intact.
    const formData = existing.type === type ? (existing.formData ?? {}) : {}
    saveDraft('intake-draft', { ...existing, type, formData })
    // Small visual confirmation before nav so the pick feels acknowledged.
    setTimeout(() => navigate(`${langPrefix}/intake`), 220)
  }

  return (
    <section className="section section--editorial inline-teaser" id="start">
      <div className="section__inner inline-teaser__inner">
        <div className="section__eyebrow">{t.eyebrow}</div>
        <h2 className="inline-teaser__title">{t.title}</h2>
        <p className="inline-teaser__sub">{t.sub}</p>
        <div className="inline-teaser__grid" role="group" aria-label={t.title}>
          {TYPES.map((type) => {
            const isPicked = picked === type
            return (
              <button
                key={type}
                type="button"
                className={`inline-teaser__card${isPicked ? ' is-picked' : ''}`}
                onClick={() => commit(type)}
                disabled={picked !== null && !isPicked}
              >
                <span className="inline-teaser__card-name mono">{type}</span>
                <span className="inline-teaser__card-title">{t.types[type]}</span>
                <span className="inline-teaser__card-cta mono" aria-hidden="true">
                  {t.cta}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
