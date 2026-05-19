import type { Lang } from '../i18n'
import { DICT } from '../i18n'

/**
 * "Apporte-moi n'importe quoi" — sits directly after the vibe do/don't
 * lists to neutralize the self-filter those lists can trigger in a hesitant
 * visitor. Marc's framing: I want every idea to come in; the triage is my
 * job, not the visitor's. The examples are aspirational ("things I'd
 * happily take"), not fake-historic — Marc has no client work yet, so the
 * copy never claims "I've shipped these." It paints range and gives
 * permission instead.
 *
 * Visual: editorial section in the home's section--editorial cadence, with
 * a card-style examples block that reads like a quick notes page (sage
 * left-rule, soft cream surface). Two-column example grid on desktop,
 * stacks on mobile.
 */
export function BringAnything({ lang }: { lang: Lang }) {
  const t = DICT[lang].bringAnything
  const ctaHref = lang === 'fr' ? '/intake' : '/en/intake'
  return (
    <section className="section section--editorial bring-anything" id="bring-anything">
      <div className="section__inner">
        <header className="section__head">
          <div className="section__folio mono" aria-hidden="true">
            V·b
          </div>
          <div className="section__eyebrow">{t.eyebrow}</div>
          <h2 className="section__display">{t.title}</h2>
          <p className="section__lead">{t.body}</p>
        </header>

        <div className="bring-anything__examples">
          <div className="bring-anything__examples-tab mono" aria-hidden="true">
            {t.examplesTitle}
          </div>
          <ul className="bring-anything__list" aria-label={t.examplesTitle}>
            {t.examples.map((ex, i) => (
              <li key={i} className="bring-anything__item">
                <span className="bring-anything__bullet mono" aria-hidden="true">
                  ·
                </span>
                <span>{ex}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="bring-anything__reassure">{t.reassure}</p>

        <div className="bring-anything__cta-row">
          <a className="hero__cta" href={ctaHref}>
            {t.cta}
          </a>
        </div>
      </div>
    </section>
  )
}
