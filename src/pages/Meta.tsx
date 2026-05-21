/**
 * /meta (FR canonical) — the portal documents itself in its own format.
 *
 * Reads src/data/lac-features.json (generated at prebuild by
 * scripts/build-lac-meta.mjs) and renders a public grid of the portal's
 * features. Each feature.json now lives co-located next to the code it
 * documents (src/.../<Component>.feature.json) and is written from what
 * that code actually does. Clicking a card expands it in place to show
 * the readable feature.json — problem, how it's built, decisions, success
 * criteria, known limitations, the state history — plus a "voir en direct"
 * link to the live surface.
 *
 * Why this exists: Marc's tool of trade (the Life-as-Code ecosystem) is
 * built around feature.json as a structured artifact. The portal uses it
 * on itself. Publishing the result is (a) honest "build in public", (b)
 * very low-competition long-tail SEO, (c) defensive — no other solo-dev
 * portal can clone it without adopting LAC first.
 *
 * No runtime API call — the manifest is static at deploy time.
 */

import { useEffect, useState } from 'react'
import type { Lang } from '../i18n'
import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import { FeatureContinue } from '../components/FeatureContinue'
import { PageMast } from '../components/PageMast'
import { Scorecard } from '../components/Scorecard'
import manifest from '../data/lac-features.json'
import { formatDate } from '../lib/format'
import { PAGE_FOLIOS } from '../lib/folios'

interface Decision {
  decision: string
  rationale: string
  recommendation: string
  alternativesConsidered?: string[]
}

interface StatusTransition {
  from: string
  to: string
  date: string
  reason?: string
}

interface FeatureRow {
  featureKey: string
  title: string
  status: string
  domain: string | null
  tags: string[]
  /** Path to the code this feature.json is co-located with. */
  componentFile: string | null
  /** In-app route where the feature can be seen running. */
  liveUrl: string | null
  problem: string
  analysis: string
  decisions: Decision[]
  successCriteria: string
  knownLimitations: string[]
  statusHistory: StatusTransition[]
  lastTransitionDate: string | null
}

interface Manifest {
  features: FeatureRow[]
  generatedAt: string
}

const COPY = {
  fr: {
    pageTitle: 'Sous le capot — Marc',
    metaDescription:
      'Le portail marc.portal documenté par lui-même : chaque fonctionnalité, son problème, ses décisions. Format LAC (Life-as-Code).',
    backHome: "← Retour à l'accueil",
    eyebrow: 'méta · le portail, raconté par lui-même',
    title: 'Sous le capot',
    lead: "Ce portail utilise mon propre outil (LAC — Life-as-Code) pour se documenter. Chaque fonctionnalité ci-dessous est un fichier `feature.json`, écrit à partir de ce que le code fait vraiment et rangé juste à côté de ce code. C'est ce qui me permet de te dire « oui c'est solide » sans avoir à le prouver à chaque fois.",
    leadSecond:
      "Clique une carte pour l'ouvrir : le problème, comment c'est bâti, les décisions prises, les limites connues. La date à droite est la dernière transition d'état — vert sous 90 jours, jaune entre 90 et 180, ambre au-delà.",
    countLabel: (n: number) => `${n} fonctionnalité${n === 1 ? '' : 's'}`,
    asOf: (iso: string) => `Manifeste généré le ${formatDate(iso, 'fr')}.`,
    decisionsLabel: (n: number) => `${n} décision${n === 1 ? '' : 's'}`,
    toggleLabel: 'détails',
    sectionProblem: 'Le problème',
    sectionAnalysis: "Comment c'est bâti",
    sectionDecisions: 'Décisions prises',
    decisionWhy: 'Pourquoi',
    decisionReco: 'Ce qu’on en retient',
    decisionAlt: 'Autres pistes considérées',
    sectionCriteria: 'Critères de réussite',
    sectionLimits: 'Limites connues',
    sectionHistory: 'Historique des états',
    inCode: 'Dans le code',
    liveLabel: 'voir en direct →',
    freshFresh: 'frais',
    freshWarm: 'tiède',
    freshStale: 'à revoir',
    learnMore: 'En savoir plus sur LAC ↗',
    learnMoreHref: 'https://lifeascode.dev',
    journeyCta: 'Voir le parcours complet (les 12 étapes) →',
    statusLabels: {
      active: 'actif',
      draft: 'brouillon',
      frozen: 'figé',
      rejected: 'rejeté',
    } as Record<string, string>,
  },
  en: {
    pageTitle: 'Under the hood — Marc',
    metaDescription:
      'The marc.portal site documented in its own format: every feature, its problem, its decisions. LAC (Life-as-Code) format.',
    backHome: '← Back home',
    eyebrow: 'meta · the portal, in its own words',
    title: 'Under the hood',
    lead: 'This portal uses my own tool (LAC — Life-as-Code) to document itself. Each feature below is a `feature.json` file, written from what the code actually does and kept right next to that code. That\'s what lets me say "yes it\'s solid" without having to prove it from scratch each time.',
    leadSecond:
      "Click a card to open it: the problem, how it's built, the decisions taken, the known limitations. The date on the right is the last status transition — green within 90 days, yellow between 90 and 180, amber beyond.",
    countLabel: (n: number) => `${n} feature${n === 1 ? '' : 's'}`,
    asOf: (iso: string) => `Manifest generated on ${formatDate(iso, 'en')}.`,
    decisionsLabel: (n: number) => `${n} decision${n === 1 ? '' : 's'}`,
    toggleLabel: 'details',
    sectionProblem: 'The problem',
    sectionAnalysis: "How it's built",
    sectionDecisions: 'Decisions taken',
    decisionWhy: 'Why',
    decisionReco: 'What we keep from it',
    decisionAlt: 'Other options considered',
    sectionCriteria: 'Success criteria',
    sectionLimits: 'Known limitations',
    sectionHistory: 'Status history',
    inCode: 'In the code',
    liveLabel: 'see it live →',
    freshFresh: 'fresh',
    freshWarm: 'warm',
    freshStale: 'stale',
    learnMore: 'Learn more about LAC ↗',
    learnMoreHref: 'https://lifeascode.dev',
    journeyCta: 'See the full journey (all 12 steps) →',
    statusLabels: {
      active: 'active',
      draft: 'draft',
      frozen: 'frozen',
      rejected: 'rejected',
    } as Record<string, string>,
  },
} as const

const NINETY_DAYS_MS = 90 * 24 * 3600 * 1000
const ONE_EIGHTY_DAYS_MS = 180 * 24 * 3600 * 1000
const PROBLEM_SNIPPET = 240 // chars shown collapsed; full text shows on expand

function freshness(dateStr: string | null, now: number): 'fresh' | 'warm' | 'stale' {
  if (!dateStr) return 'stale'
  const t = new Date(dateStr).getTime()
  if (Number.isNaN(t)) return 'stale'
  const age = now - t
  if (age < NINETY_DAYS_MS) return 'fresh'
  if (age < ONE_EIGHTY_DAYS_MS) return 'warm'
  return 'stale'
}

/** The manifest stores FR-canonical routes; map them to the EN mirror. */
function localizeUrl(url: string, lang: Lang): string {
  if (lang === 'fr') return url
  if (url === '/') return '/en'
  if (url.startsWith('/#')) return `/en${url.slice(1)}`
  return `/en${url}`
}

/** successCriteria is one string of "- " bullet lines; split for rendering. */
function criteriaLines(raw: string): string[] {
  return raw
    .split('\n')
    .map((l) => l.replace(/^[-•]\s*/, '').trim())
    .filter(Boolean)
}

export function Meta({ lang }: { lang: Lang }) {
  const t = COPY[lang]
  const m = manifest as Manifest

  useEffect(() => {
    document.documentElement.lang = lang === 'fr' ? 'fr-CA' : 'en-CA'
    document.title = t.pageTitle
    const meta = document.querySelector('meta[name="description"]')
    if (meta) meta.setAttribute('content', t.metaDescription)
  }, [lang, t])

  // Captured at mount — coarse-grained, used only for the freshness pill.
  // Lazy init keeps render pure (react-hooks/purity).
  const [now] = useState<number>(() => Date.now())

  return (
    <div className="app">
      <Header lang={lang} />
      <main id="main-content">
        <article className="section">
          <div className="section__inner privacy meta-page">
            <PageMast
              folio={
                lang === 'fr'
                  ? `№ ${PAGE_FOLIOS.meta} — sous le capot`
                  : `№ ${PAGE_FOLIOS.meta} — under the hood`
              }
              stampLabel="LAC"
              stampSub="LIFE · AS · CODE"
              feature="meta"
              lang={lang}
              back={{ href: lang === 'fr' ? '/' : '/en', label: t.backHome }}
            >
              <div className="section__eyebrow">{t.eyebrow}</div>
              <h1>{t.title}</h1>
              <p className="privacy__intro">{t.lead}</p>
              <p className="privacy__intro">{t.leadSecond}</p>
              <p className="mono privacy__asof">
                {t.countLabel(m.features.length)} · {t.asOf(m.generatedAt)}
              </p>
            </PageMast>

            <Scorecard lang={lang} />

            <ul className="meta-features">
              {m.features.map((f) => {
                const fresh = freshness(f.lastTransitionDate, now)
                const statusLabel = t.statusLabels[f.status] ?? f.status
                const snippet =
                  f.problem.length > PROBLEM_SNIPPET
                    ? f.problem.slice(0, PROBLEM_SNIPPET - 1).trimEnd() + '…'
                    : f.problem
                const criteria = criteriaLines(f.successCriteria)
                return (
                  <li
                    key={f.featureKey}
                    className={`meta-feature meta-feature--${f.status} meta-feature--${fresh}`}
                  >
                    <details className="meta-feature__details">
                      <summary className="meta-feature__summary">
                        <div className="meta-feature__head">
                          <h3 className="meta-feature__title">{f.title}</h3>
                          <span className="meta-feature__status mono">{statusLabel}</span>
                        </div>
                        <p className="meta-feature__key mono">{f.featureKey}</p>
                        <p className="meta-feature__problem">{snippet}</p>
                        {f.tags.length > 0 && (
                          <ul className="meta-feature__tags">
                            {f.tags.slice(0, 6).map((tag) => (
                              <li key={tag} className="mono">
                                {tag}
                              </li>
                            ))}
                          </ul>
                        )}
                        <div className="meta-feature__foot">
                          <span className="mono">{t.decisionsLabel(f.decisions.length)}</span>
                          {f.lastTransitionDate && (
                            <span
                              className={`mono meta-feature__fresh meta-feature__fresh--${fresh}`}
                            >
                              {formatDate(f.lastTransitionDate, lang)} ·{' '}
                              {fresh === 'fresh'
                                ? t.freshFresh
                                : fresh === 'warm'
                                  ? t.freshWarm
                                  : t.freshStale}
                            </span>
                          )}
                          <span className="mono meta-feature__toggle">{t.toggleLabel}</span>
                        </div>
                      </summary>

                      <div className="meta-feature__body">
                        <section className="meta-block">
                          <h4 className="meta-block__label mono">{t.sectionProblem}</h4>
                          <p className="meta-block__text">{f.problem}</p>
                        </section>

                        {f.analysis && (
                          <section className="meta-block">
                            <h4 className="meta-block__label mono">{t.sectionAnalysis}</h4>
                            <p className="meta-block__text">{f.analysis}</p>
                          </section>
                        )}

                        {f.decisions.length > 0 && (
                          <section className="meta-block">
                            <h4 className="meta-block__label mono">{t.sectionDecisions}</h4>
                            <ol className="meta-decisions">
                              {f.decisions.map((d, i) => (
                                <li key={i} className="meta-decision">
                                  <p className="meta-decision__title">{d.decision}</p>
                                  {d.rationale && (
                                    <p className="meta-decision__line">
                                      <span className="mono meta-decision__tag">
                                        {t.decisionWhy}
                                      </span>{' '}
                                      {d.rationale}
                                    </p>
                                  )}
                                  {d.recommendation && (
                                    <p className="meta-decision__line">
                                      <span className="mono meta-decision__tag">
                                        {t.decisionReco}
                                      </span>{' '}
                                      {d.recommendation}
                                    </p>
                                  )}
                                  {d.alternativesConsidered &&
                                    d.alternativesConsidered.length > 0 && (
                                      <p className="meta-decision__line meta-decision__line--alt">
                                        <span className="mono meta-decision__tag">
                                          {t.decisionAlt}
                                        </span>{' '}
                                        {d.alternativesConsidered.join(' · ')}
                                      </p>
                                    )}
                                </li>
                              ))}
                            </ol>
                          </section>
                        )}

                        {criteria.length > 0 && (
                          <section className="meta-block">
                            <h4 className="meta-block__label mono">{t.sectionCriteria}</h4>
                            <ul className="meta-list">
                              {criteria.map((c, i) => (
                                <li key={i}>{c}</li>
                              ))}
                            </ul>
                          </section>
                        )}

                        {f.knownLimitations.length > 0 && (
                          <section className="meta-block">
                            <h4 className="meta-block__label mono">{t.sectionLimits}</h4>
                            <ul className="meta-list meta-list--limits">
                              {f.knownLimitations.map((k, i) => (
                                <li key={i}>{k}</li>
                              ))}
                            </ul>
                          </section>
                        )}

                        {f.statusHistory.length > 0 && (
                          <section className="meta-block">
                            <h4 className="meta-block__label mono">{t.sectionHistory}</h4>
                            <ol className="meta-history">
                              {f.statusHistory.map((s, i) => (
                                <li key={i} className="meta-history__item">
                                  <span className="mono meta-history__when">
                                    {formatDate(s.date, lang)}
                                  </span>
                                  <span className="mono meta-history__arrow">
                                    {(t.statusLabels[s.from] ?? s.from) +
                                      ' → ' +
                                      (t.statusLabels[s.to] ?? s.to)}
                                  </span>
                                  {s.reason && (
                                    <span className="meta-history__reason">{s.reason}</span>
                                  )}
                                </li>
                              ))}
                            </ol>
                          </section>
                        )}

                        <div className="meta-feature__links">
                          {f.componentFile && (
                            <span className="mono meta-feature__component">
                              {t.inCode}: <code>{f.componentFile}</code>
                            </span>
                          )}
                          {f.liveUrl && (
                            <a
                              className="mono meta-feature__live"
                              href={localizeUrl(f.liveUrl, lang)}
                            >
                              {t.liveLabel}
                            </a>
                          )}
                        </div>
                      </div>
                    </details>
                  </li>
                )
              })}
            </ul>

            <p className="meta-page__cta mono">
              <a href={t.learnMoreHref} target="_blank" rel="noreferrer">
                {t.learnMore}
              </a>
            </p>
            <p className="meta-page__cta mono">
              <a href={lang === 'fr' ? '/parcours' : '/en/journey'}>{t.journeyCta}</a>
            </p>
          </div>
        </article>
      </main>
      <FeatureContinue page="page.meta" lang={lang} />
      <Footer lang={lang} />
    </div>
  )
}
