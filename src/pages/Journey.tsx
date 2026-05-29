import { useEffect } from 'react'
import type { Lang } from '../i18n'
import { DICT } from '../i18n'
import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import { FeatureContinue } from '../components/FeatureContinue'
import { PageMast } from '../components/PageMast'
import { SectionEyebrow } from '../components/SectionEyebrow'
import { PAGE_FOLIOS } from '../lib/folios'
import { PAGE_FEATURE } from '../lib/features'
import { frPunct } from '../lib/frPunct'

/**
 * The full journey — a visual, phased walkthrough from "stranger lands on the
 * site" all the way to "shipped, paid, and either handed off or in custodian
 * mode". Twelve steps, four phases, alternating left/right along a center
 * spine on desktop; collapses to a single column on mobile. Each step is
 * tagged with an actor (you / me / both) so the visitor can see at a glance
 * that they only carry half the steps.
 */
export function Journey({ lang }: { lang: Lang }) {
  const t = DICT[lang]
  const j = t.journey
  const intakeHref = lang === 'fr' ? '/intake' : '/en/intake'
  const homeHref = lang === 'fr' ? '/' : '/en'

  useEffect(() => {
    document.documentElement.lang = t.langCode
    document.title = `${j.pageTitle} — Marc`
    const meta = document.querySelector('meta[name="description"]')
    if (meta) meta.setAttribute('content', j.metaDescription)
  }, [t, j])

  // Build a Map from step number → which side of the spine the card lands
  // on. Indices accumulate across phases so the snake alternation is
  // continuous, not reset at every phase boundary. Done up-front rather
  // than via a mutable counter inside render so the hooks linter stays
  // happy (no reassignment after render completes).
  const sideByNum = new Map<string, 'left' | 'right'>()
  let cursor = 0
  for (const phase of j.phases) {
    for (const step of phase.steps) {
      sideByNum.set(step.num, cursor % 2 === 0 ? 'left' : 'right')
      cursor += 1
    }
  }

  return (
    <div className="app" data-feature={PAGE_FEATURE['page.journey']}>
      <Header lang={lang} />
      <main id="main-content">
        <article className="section journey">
          <div className="section__inner">
            <PageMast
              folio={
                lang === 'fr'
                  ? `№ ${PAGE_FOLIOS.journey} — le parcours`
                  : `№ ${PAGE_FOLIOS.journey} — the journey`
              }
              stampLabel={lang === 'fr' ? 'XII ÉTAPES' : 'XII STEPS'}
              stampSub={lang === 'fr' ? 'TOI · MOI · NOUS' : 'YOU · ME · BOTH'}
              back={{ href: homeHref, label: j.backHome }}
              feature={PAGE_FEATURE['page.journey']}
              lang={lang}
            >
              <SectionEyebrow lang={lang} feature={PAGE_FEATURE['page.journey']}>
                {j.eyebrow}
              </SectionEyebrow>
              <h1 className="journey__title">{j.title}</h1>
              <p className="journey__sub">{j.sub}</p>
              {/* Stats + legend sit inside the masthead block as a small
                  centered intermezzo (max-width 720px, auto-margin). Keeps
                  the whole top of the page reading as one editorial unit
                  instead of "left-mast, centered-stats, alternating-cards". */}
              <div className="journey__head journey__head--in-mast">
                <dl className="journey__stats" aria-label={j.eyebrow}>
                  <div className="surface journey__stat journey__stat--you">
                    <dt className="journey__stat-label">{j.statYou}</dt>
                    <dd className="journey__stat-val">
                      <span className="journey__stat-num">{j.statYouVal}</span>
                      <span className="journey__stat-unit">{j.statYouUnit}</span>
                    </dd>
                  </div>
                  <div className="surface journey__stat journey__stat--time">
                    <dt className="journey__stat-label">{j.statTime}</dt>
                    <dd className="journey__stat-val">
                      <span className="journey__stat-num">{j.statTimeVal}</span>
                      <span className="journey__stat-unit">{j.statTimeUnit}</span>
                    </dd>
                  </div>
                  <div className="surface journey__stat journey__stat--calls">
                    <dt className="journey__stat-label">{j.statCalls}</dt>
                    <dd className="journey__stat-val">
                      <span className="journey__stat-num">{j.statCallsVal}</span>
                      <span className="journey__stat-unit">{j.statCallsUnit}</span>
                    </dd>
                  </div>
                </dl>

                <ul className="journey__legend mono" aria-label={j.legendTitle}>
                  <li className="journey__legend-item journey__legend-item--you">
                    <span className="journey__legend-dot" aria-hidden="true" />
                    {j.legendYou}
                  </li>
                  <li className="journey__legend-item journey__legend-item--me">
                    <span className="journey__legend-dot" aria-hidden="true" />
                    {j.legendMe}
                  </li>
                  <li className="journey__legend-item journey__legend-item--both">
                    <span className="journey__legend-dot" aria-hidden="true" />
                    {j.legendBoth}
                  </li>
                </ul>
              </div>
            </PageMast>

            <div className="journey__path">
              {/* Chart frame + cartouche + compass + boat — pure cartographic
                  decoration that reframes the 12-step ladder as a nautical
                  voyage. All aria-hidden. The boat sails down the spine on
                  scroll (scroll-driven CSS animation); chrome shrinks/folds
                  on narrow viewports so the cards never get crowded. */}
              <div className="journey__chart-frame" aria-hidden="true" />
              <div className="surface journey__cartouche" aria-hidden="true">
                <div className="journey__cartouche-row mono">
                  <span>{lang === 'fr' ? 'CARTE' : 'CHART'}</span>
                  <span>№ {PAGE_FOLIOS.journey}</span>
                </div>
                <div className="journey__cartouche-title">
                  {lang === 'fr' ? 'le parcours' : 'the voyage'}
                </div>
                <div className="journey__cartouche-row mono">
                  <span>XII PORTS</span>
                  <span>·</span>
                  <span>{lang === 'fr' ? 'MARC.PORTAIL' : 'MARC.PORTAL'}</span>
                </div>
              </div>
              <svg className="journey__compass" viewBox="0 0 80 80" aria-hidden="true">
                <circle
                  cx="40"
                  cy="40"
                  r="34"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  opacity="0.45"
                />
                <circle
                  cx="40"
                  cy="40"
                  r="27"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="0.7"
                  opacity="0.35"
                />
                <path d="M 40 8 L 44 38 L 40 40 L 36 38 Z" fill="currentColor" opacity="0.78" />
                <path d="M 40 72 L 44 42 L 40 40 L 36 42 Z" fill="currentColor" opacity="0.32" />
                <path d="M 8 40 L 38 36 L 40 40 L 38 44 Z" fill="currentColor" opacity="0.32" />
                <path d="M 72 40 L 42 36 L 40 40 L 42 44 Z" fill="currentColor" opacity="0.32" />
                <circle cx="40" cy="40" r="2" fill="currentColor" opacity="0.8" />
                <text
                  x="40"
                  y="6"
                  textAnchor="middle"
                  fontSize="6"
                  fontFamily="serif"
                  fontStyle="italic"
                  fill="currentColor"
                >
                  N
                </text>
              </svg>
              <svg className="journey__boat" viewBox="0 0 36 38" aria-hidden="true">
                {/* Colors set via CSS (.journey__boat-*) so the sprite
                    adapts to night mode — hardcoded fills were leaving the
                    dark sage hull + dark mast invisible on the night surface. */}
                <path className="journey__boat-hull" d="M 4 26 L 32 26 L 28 34 L 8 34 Z" />
                <path className="journey__boat-rigging" d="M 4 26 L 32 26" strokeWidth="0.8" />
                <path
                  className="journey__boat-rigging"
                  d="M 18 6 L 18 26"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <path
                  className="journey__boat-sail"
                  d="M 18 8 L 30 24 L 18 24 Z"
                  strokeWidth="0.9"
                />
                <path className="journey__boat-pennant" d="M 18 6 L 24 8 L 18 10 Z" />
              </svg>
              {/* Animated sage spine — draws in as the visitor scrolls the
                  path through the viewport. Decorative, paired with the
                  dashed ::before pseudo as the static base layer. */}
              <div className="journey__spine" aria-hidden="true" />
              {j.phases.map((phase) => (
                <section
                  key={phase.roman}
                  className="journey__phase"
                  aria-labelledby={`phase-${phase.roman}`}
                >
                  <header className="journey__phase-head">
                    <div className="journey__phase-roman mono" aria-hidden="true">
                      {phase.roman}
                    </div>
                    <div className="journey__phase-text">
                      <h2 id={`phase-${phase.roman}`} className="journey__phase-name">
                        {phase.name}
                      </h2>
                      <p className="journey__phase-sub">{phase.sub}</p>
                    </div>
                  </header>

                  <ol className="journey__steps">
                    {phase.steps.map((step) => {
                      const side = sideByNum.get(step.num) ?? 'left'
                      const actorLabel =
                        step.actor === 'you'
                          ? j.actor.you
                          : step.actor === 'me'
                            ? j.actor.me
                            : j.actor.both
                      return (
                        <li
                          key={step.num}
                          className={`journey__step journey__step--${step.actor} journey__step--${side}`}
                        >
                          <span className="journey__step-dot" aria-hidden="true" />
                          <article className="surface journey__card">
                            <div className="journey__card-head">
                              <span className="journey__step-num mono" aria-hidden="true">
                                {step.num}
                              </span>
                              <div className="journey__step-meta">
                                <span className="journey__step-actor mono">{actorLabel}</span>
                                <span className="journey__step-duration mono">{step.duration}</span>
                                <span className="journey__step-where mono">{step.where}</span>
                              </div>
                            </div>
                            <h3 className="journey__step-title">{frPunct(step.title)}</h3>
                            <p className="journey__step-body">{step.body}</p>
                          </article>
                        </li>
                      )
                    })}
                  </ol>
                </section>
              ))}
            </div>

            <footer className="journey__outro">
              <h2 className="journey__outro-title">{j.outro.title}</h2>
              <p className="journey__outro-body">{j.outro.body}</p>
              <a className="hero__cta" href={intakeHref}>
                {j.outro.cta}
              </a>
            </footer>
          </div>
        </article>
      </main>
      <FeatureContinue page="page.journey" lang={lang} />
      <Footer lang={lang} />
    </div>
  )
}
