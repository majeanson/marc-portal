import { Link } from 'react-router-dom'
import type { Lang } from '../../i18n'

/** Reserved formData key (not a schema field) that carries the choice. Same
 *  key the intake form used to write, so older sessions keep working and the
 *  recap row in IntakeSummary still reads it. */
export const HANDOFF_MODE_KEY = '__handoff_mode'

export type HandoffMode = 'tout-a-toi' | 'je-men-occupe' | 'on-en-parle'

// Single-use copy, so it lives here rather than in i18n.ts (house pattern 2).
// Plain words on purpose: this used to be intake step 4 and asked a
// food-truck owner about DNS, Cloudflare and Resend right before « Soumettre ».
// It now appears once I've said yes and a price is on the table.
const COPY = {
  fr: {
    label: 'Qui s’occupe de l’hébergement après la livraison ?',
    hint: 'L’hébergement, le nom de domaine et les courriels : les petits tuyaux qui font tenir le site. Rien à décider tout de suite, et « Tout à toi » demande une confirmation à la livraison.',
    learnMore: 'Voir comment ça finit →',
    optionJe: 'Je m’en occupe pour toi (forfait annuel, recommandé)',
    optionTout: 'Je te remets tout et tu t’en occupes',
    optionParle: 'On en parle plus tard',
    saving: 'Enregistrement…',
  },
  en: {
    label: 'Who looks after hosting after delivery?',
    hint: 'Hosting, the domain name and email: the plumbing that keeps the site up. Nothing to decide right now, and “All yours” asks for a confirmation at delivery.',
    learnMore: 'See how it ends →',
    optionJe: 'I look after it for you (annual plan, recommended)',
    optionTout: 'I hand you everything and you look after it',
    optionParle: 'Let’s talk later',
    saving: 'Saving…',
  },
} as const

/**
 * Hosting-preference picker for the visitor's session page. Shown while the
 * session is active (after triage, once a price is on the table). Saving goes
 * through the same intake patch the recap uses, so the choice stays in the
 * stored request and the operator sees it in the recap.
 */
export function HandoffPreference({
  lang,
  value,
  busy,
  onPick,
}: {
  lang: Lang
  value: string | undefined
  busy: boolean
  onPick: (next: HandoffMode) => void
}) {
  const t = COPY[lang]
  const current = (value as HandoffMode | undefined) ?? 'on-en-parle'
  const handoffHref = lang === 'fr' ? '/handoff' : '/en/handoff'
  const options: Array<[HandoffMode, string]> = [
    ['je-men-occupe', t.optionJe],
    ['tout-a-toi', t.optionTout],
    ['on-en-parle', t.optionParle],
  ]
  return (
    <fieldset className="surface field field--handoff" disabled={busy}>
      <legend className="field__label">{t.label}</legend>
      <p className="field__hint">
        {t.hint}{' '}
        <Link to={handoffHref} className="mono">
          {t.learnMore}
        </Link>
      </p>
      <div className="radio-group">
        {options.map(([mode, label]) => (
          <label className="radio" key={mode}>
            <input
              type="radio"
              name={HANDOFF_MODE_KEY}
              value={mode}
              checked={current === mode}
              onChange={() => onPick(mode)}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>
      {busy && (
        <p className="field__hint" role="status">
          {t.saving}
        </p>
      )}
    </fieldset>
  )
}
