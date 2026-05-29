import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Lang } from '../i18n'
import { DICT } from '../i18n'
import type { ProblemType } from '../lib/intakeSchemas'
import { loadDraft, saveDraft } from '../lib/draft'

const TYPES: ProblemType[] = ['paperasse', 'suivi', 'coordination', 'autre', 'rescue']
// On phones the full 5-card stack is half the viewport; gate "autre" + "rescue"
// behind a "+ autre chose ?" link so the visitor's eye lands on the three
// concrete categories first. PRIMARY_COUNT is the cutoff. Desktop is
// unaffected (CSS short-circuits the gate).
const PRIMARY_COUNT = 3

/**
 * Type-picker grid for the final CTA section. Visitor picks a project type
 * and gets shuttled into /intake with the choice already recorded in the
 * draft, so the type-picker step inside the intake flow is skipped. The
 * Vibe gate still runs (one-way fit check) and the account step still asks
 * for an email — the win is two steps becoming one in the visitor's
 * perception.
 *
 * Previously rendered as its own .section on the home page above the final
 * CTA; folded INTO the CTA panel in the R3 design pass so the home doesn't
 * stack two competing CTA panels back-to-back. Renders just the grid (no
 * section wrapper, no h2/eyebrow/lead) — the CTA section provides those.
 *
 * The draft we write here uses the same `intake-draft` localStorage key
 * the Intake page reads; if there's an existing draft we merge so we never
 * stomp partial work in progress.
 */
export function InlineIntakeTeaser({ lang }: { lang: Lang }) {
  const t = DICT[lang].inlineTeaser
  const navigate = useNavigate()
  const [picked, setPicked] = useState<ProblemType | null>(null)
  const [revealedAll, setRevealedAll] = useState(false)
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
    <div className="inline-teaser__inner">
      <p className="inline-teaser__sub">{t.sub}</p>
      <div
        className={`inline-teaser__grid${revealedAll ? ' is-expanded' : ''}`}
        role="group"
        aria-label={t.title}
      >
        {TYPES.map((type, i) => {
          const isPicked = picked === type
          const isSecondary = i >= PRIMARY_COUNT
          return (
            <button
              key={type}
              type="button"
              className={`surface inline-teaser__card${isPicked ? ' is-picked' : ''}${isSecondary ? ' inline-teaser__card--secondary' : ''}`}
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
      {!revealedAll && (
        <button
          type="button"
          className="inline-teaser__more mono"
          onClick={() => setRevealedAll(true)}
          aria-expanded={revealedAll}
        >
          {t.moreTypes}
        </button>
      )}
      <a className="inline-teaser__napkin-link mono" href={`${langPrefix}/intake`}>
        {DICT[lang].napkin.homeTeaser}
      </a>
    </div>
  )
}
