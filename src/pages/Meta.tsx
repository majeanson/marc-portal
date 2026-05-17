/**
 * /meta (FR canonical) — the portal documents itself in its own format.
 *
 * Reads src/data/lac-features.json (generated at prebuild by
 * scripts/build-lac-meta.mjs) and renders a public grid of the portal's
 * `feat-` dirs and their feature.json files: status, problem snippet, tag
 * chips, decision count, last-transition date with a green/amber/red
 * freshness pill.
 *
 * Why this exists: Marc's tool of trade (the Life-as-Code ecosystem)
 * is built around feature.json as a structured artifact. The portal uses
 * it on itself. Publishing the result is (a) honest "build in public",
 * (b) very low-competition long-tail SEO, (c) defensive — no other solo-
 * dev portal can clone it without adopting LAC first. Plan §4.1.
 *
 * No runtime API call — the manifest is static at deploy time.
 */

import { useEffect, useState } from 'react'
import type { Lang } from '../i18n'
import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import manifest from '../data/lac-features.json'
import { formatDate } from '../lib/format'

interface FeatureRow {
  featureKey: string
  /** Actual on-disk folder name — used to build the GitHub source URL.
   *  The dir slugs are word-form ("feat-app-shell") while featureKey is
   *  date-form ("feat-2026-009"), so we can't derive one from the other. */
  dirSlug: string
  title: string
  status: string
  domain: string | null
  tags: string[]
  problem: string
  decisionsCount: number
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
      "Le portail marc.portal documenté par lui-même : chaque fonctionnalité, sa raison, ses décisions. Format LAC (Life-as-Code).",
    backHome: "← Retour à l'accueil",
    eyebrow: 'méta · le portail, raconté par lui-même',
    title: 'Sous le capot',
    lead: "Ce portail utilise mon propre outil (LAC — Life-as-Code) pour documenter ses propres décisions. Chaque fonctionnalité ci-dessous est un fichier `feature.json` versionné au même niveau que le code. C'est ce qui me permet de te dire « oui c'est solide » sans avoir à le démontrer chaque fois.",
    leadSecond:
      "Tu peux lire le source de chaque fichier sur GitHub. La date à droite indique la dernière transition d'état (active, frozen, etc.) — vert sous 90 jours, jaune entre 90 et 180, ambre au-delà.",
    countLabel: (n: number) => `${n} fonctionnalité${n === 1 ? '' : 's'}`,
    asOf: (iso: string) => `Manifeste généré le ${formatDate(iso, 'fr')}.`,
    sourceLinkLabel: 'voir feature.json ↗',
    decisionsLabel: (n: number) => `${n} décision${n === 1 ? '' : 's'} consignée${n === 1 ? '' : 's'}`,
    freshFresh: 'frais',
    freshWarm: 'tiède',
    freshStale: 'à revoir',
    learnMore: 'En savoir plus sur LAC ↗',
    learnMoreHref: 'https://lifeascode.dev',
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
      'The marc.portal site documented in its own format: every feature, its rationale, its decisions. LAC (Life-as-Code) format.',
    backHome: '← Back home',
    eyebrow: 'meta · the portal, in its own words',
    title: 'Under the hood',
    lead: "This portal uses my own tool (LAC — Life-as-Code) to document its own decisions. Each feature below is a `feature.json` file versioned next to the code. That's what lets me say \"yes it's solid\" without having to prove it from scratch each time.",
    leadSecond:
      'You can read the source of each file on GitHub. The date on the right is the last status transition (active, frozen, etc.) — green within 90 days, yellow between 90 and 180, amber beyond.',
    countLabel: (n: number) => `${n} feature${n === 1 ? '' : 's'}`,
    asOf: (iso: string) => `Manifest generated on ${formatDate(iso, 'en')}.`,
    sourceLinkLabel: 'view feature.json ↗',
    decisionsLabel: (n: number) => `${n} recorded decision${n === 1 ? '' : 's'}`,
    freshFresh: 'fresh',
    freshWarm: 'warm',
    freshStale: 'stale',
    learnMore: 'Learn more about LAC ↗',
    learnMoreHref: 'https://lifeascode.dev',
    statusLabels: {
      active: 'active',
      draft: 'draft',
      frozen: 'frozen',
      rejected: 'rejected',
    } as Record<string, string>,
  },
} as const

const REPO_URL = 'https://github.com/majeanson/marc-portal'

const NINETY_DAYS_MS = 90 * 24 * 3600 * 1000
const ONE_EIGHTY_DAYS_MS = 180 * 24 * 3600 * 1000

function freshness(dateStr: string | null, now: number): 'fresh' | 'warm' | 'stale' {
  if (!dateStr) return 'stale'
  const t = new Date(dateStr).getTime()
  if (Number.isNaN(t)) return 'stale'
  const age = now - t
  if (age < NINETY_DAYS_MS) return 'fresh'
  if (age < ONE_EIGHTY_DAYS_MS) return 'warm'
  return 'stale'
}

export function Meta({ lang }: { lang: Lang }) {
  const t = COPY[lang]
  const m = manifest as Manifest
  const langPrefix = lang === 'en' ? '/en' : ''

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
            <a className="showcase-page__back" href={lang === 'fr' ? '/' : '/en'}>
              {t.backHome}
            </a>

            <header className="meta-page__hero">
              <div className="section__eyebrow">{t.eyebrow}</div>
              <h1>{t.title}</h1>
              <p className="privacy__intro">{t.lead}</p>
              <p className="privacy__intro">{t.leadSecond}</p>
              <p className="mono privacy__asof">
                {t.countLabel(m.features.length)} · {t.asOf(m.generatedAt)}
              </p>
            </header>

            <ul className="meta-features">
              {m.features.map((f) => {
                const fresh = freshness(f.lastTransitionDate, now)
                // dirSlug is captured at build time (word-form, "feat-app-shell")
                // since the on-disk folders don't match the date-form featureKey.
                const sourceUrl = `${REPO_URL}/blob/main/${f.dirSlug}/feature.json`
                const statusLabel = t.statusLabels[f.status] ?? f.status
                return (
                  <li
                    key={f.featureKey}
                    className={`meta-feature meta-feature--${f.status} meta-feature--${fresh}`}
                  >
                    <div className="meta-feature__head">
                      <h3 className="meta-feature__title">{f.title}</h3>
                      <span className="meta-feature__status mono">{statusLabel}</span>
                    </div>
                    <p className="meta-feature__key mono">{f.featureKey}</p>
                    {f.problem && <p className="meta-feature__problem">{f.problem}</p>}
                    {f.tags.length > 0 && (
                      <ul className="meta-feature__tags">
                        {f.tags.map((tag) => (
                          <li key={tag} className="mono">
                            {tag}
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="meta-feature__foot">
                      <span className="mono">{t.decisionsLabel(f.decisionsCount)}</span>
                      {f.lastTransitionDate && (
                        <span
                          className={`mono meta-feature__fresh meta-feature__fresh--${fresh}`}
                        >
                          {formatDate(f.lastTransitionDate, lang)} ·{' '}
                          {fresh === 'fresh' ? t.freshFresh : fresh === 'warm' ? t.freshWarm : t.freshStale}
                        </span>
                      )}
                      <a
                        className="mono meta-feature__source"
                        href={sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {t.sourceLinkLabel}
                      </a>
                    </div>
                  </li>
                )
              })}
            </ul>

            <p className="meta-page__cta mono">
              <a href={t.learnMoreHref} target="_blank" rel="noreferrer">
                {t.learnMore}
              </a>
            </p>
            <p className="meta-page__back-link">
              <a href={`${langPrefix}/`} className="link-btn mono">
                {t.backHome}
              </a>
            </p>
          </div>
        </article>
      </main>
      <Footer lang={lang} />
    </div>
  )
}

