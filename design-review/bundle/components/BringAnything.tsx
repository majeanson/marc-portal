import type { Lang } from '../i18n'
import { DICT } from '../i18n'
import { HOME_FOLIOS } from '../lib/folios'
import { HOME_SECTION_FEATURE } from '../lib/features'
import { SectionEyebrow } from './SectionEyebrow'

/**
 * "Apporte-moi n'importe quoi" — sits directly after the vibe do/don't
 * lists to neutralize the self-filter those lists can trigger in a hesitant
 * visitor. Marc's framing: I want every idea to come in; the triage is my
 * job, not the visitor's. The examples are aspirational ("things I'd
 * happily take"), not fake-historic — Marc has no client work yet, so the
 * copy never claims "I've shipped these." It paints range and gives
 * permission instead.
 *
 * Visual: editorial section in the home's section--editorial cadence. The
 * examples are a horizontal scroller of ruled-notepad cards — one card per
 * theme (everyday, gifts, work, hardware, weird). Range matters more than a
 * single tidy list: a visitor scans across categories and finds the one
 * that sounds like their idea. Scroll-snap, keyboard-scrollable, peeks the
 * next card so the scroll affordance is obvious.
 */
export function BringAnything({ lang }: { lang: Lang }) {
  const t = DICT[lang].bringAnything
  const ctaHref = lang === 'fr' ? '/intake' : '/en/intake'
  const feature = HOME_SECTION_FEATURE['bring-anything']
  return (
    <section
      className="section section--editorial bring-anything"
      id="bring-anything"
      data-feature={feature}
    >
      <div className="section__inner">
        <header className="section__head">
          <div className="section__folio mono" aria-hidden="true">
            {HOME_FOLIOS.bringAnything}
          </div>
          <SectionEyebrow lang={lang} feature={feature}>
            {t.eyebrow}
          </SectionEyebrow>
          <h2 className="section__display">{t.title}</h2>
          <p className="section__lead">{t.body}</p>
        </header>

        <div className="bring-anything__examples">
          <div className="bring-anything__examples-head">
            <span className="bring-anything__examples-tab mono">{t.examplesTitle}</span>
            <span className="bring-anything__scroll-hint mono" aria-hidden="true">
              {t.scrollHint}
            </span>
          </div>
          <div
            className="bring-anything__scroller"
            role="group"
            aria-label={t.examplesTitle}
            // tabIndex=0 makes the overflow container keyboard-scrollable (arrow
            // keys) for non-pointer users — a focusable scroll region is a
            // WCAG-sanctioned pattern this a11y rule is conservative about.
            // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
            tabIndex={0}
          >
            {t.exampleGroups.map((group, gi) => (
              <div key={gi} className="bring-anything__note">
                <div className="bring-anything__note-label mono">{group.label}</div>
                <ul className="bring-anything__list">
                  {group.items.map((ex, i) => (
                    <li key={i} className="bring-anything__item">
                      <span className="bring-anything__bullet mono" aria-hidden="true">
                        ·
                      </span>
                      <span>{ex}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
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
