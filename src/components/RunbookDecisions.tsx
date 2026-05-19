/**
 * Decisions renderer. Each strategic question becomes a card with:
 *   - the question
 *   - context (why this matters)
 *   - bulleted options to consider
 *   - a textarea for the operator's answer (persisted to localStorage)
 *   - a small "unlocks" footer showing what answering enables downstream
 *
 * Used by the Decisions tab on /admin/runbook. Public /template doesn't
 * render this — strategic decisions are operator-only.
 */

import type { Lang } from '../i18n'
import { decisions } from '../lib/runbook/decisions'
import type { Decision } from '../lib/runbook/types'
import { bi, biList } from '../lib/runbook/types'
import { useDecisionAnswer } from '../lib/runbook/useProgress'

export function RunbookDecisions({ lang }: { lang: Lang }) {
  const lede =
    lang === 'fr'
      ? 'Avant de vendre le template, réponds à ces 8 questions. Une réponse vide bloque la copie correspondante sur /template — pas un blocage technique, un blocage de cohérence.'
      : 'Before selling the template, answer these 8 questions. An empty answer blocks the matching copy on /template — not a technical block, a coherence block.'

  return (
    <section className="runbook-decisions" aria-label={lang === 'fr' ? 'Décisions' : 'Decisions'}>
      <header className="runbook-decisions__head">
        <div className="section__eyebrow">{lang === 'fr' ? 'décisions' : 'decisions'}</div>
        <h2 className="runbook-decisions__title">
          {lang === 'fr' ? 'Ce que tu dois décider' : 'What you owe yourself'}
        </h2>
        <p className="runbook-decisions__sub">{lede}</p>
      </header>

      <ol className="runbook-decisions__list">
        {decisions.map((d) => (
          <DecisionCard key={d.id} decision={d} lang={lang} />
        ))}
      </ol>
    </section>
  )
}

function DecisionCard({ decision, lang }: { decision: Decision; lang: Lang }) {
  const [answer, setAnswer] = useDecisionAnswer(decision.id)
  const answered = answer.trim().length > 0

  return (
    <li
      className={`runbook-decision${answered ? ' runbook-decision--answered' : ''}`}
    >
      <header className="runbook-decision__head">
        <span className="runbook-decision__num mono" aria-hidden="true">
          {decision.num}
        </span>
        <h3 className="runbook-decision__question">{bi(decision.question, lang)}</h3>
        {answered && (
          <span className="runbook-decision__badge mono">
            {lang === 'fr' ? 'répondu' : 'answered'}
          </span>
        )}
      </header>

      <p className="runbook-decision__context">{bi(decision.context, lang)}</p>

      <div className="runbook-decision__options">
        <div className="runbook-decision__options-label mono">
          {lang === 'fr' ? 'Options à considérer' : 'Options to consider'}
        </div>
        <ul className="runbook-decision__options-list">
          {biList(decision.options, lang).map((opt, i) => (
            <li key={i}>{opt}</li>
          ))}
        </ul>
      </div>

      <label className="runbook-decision__answer">
        <span className="runbook-decision__answer-label">
          {lang === 'fr' ? 'Ta réponse' : 'Your answer'}
        </span>
        <textarea
          className="runbook-decision__answer-input"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder={
            lang === 'fr'
              ? 'Écris ta décision ici — c’est sauvé automatiquement.'
              : 'Write your decision here — auto-saved.'
          }
          rows={3}
        />
      </label>

      <footer className="runbook-decision__foot">
        <span className="mono runbook-decision__unlocks-label">
          {lang === 'fr' ? 'Débloque' : 'Unlocks'}
        </span>
        <span className="runbook-decision__unlocks">{bi(decision.unlocks, lang)}</span>
      </footer>
    </li>
  )
}

