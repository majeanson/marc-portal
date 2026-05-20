import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams, useViewTransitionState } from 'react-router-dom'
import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import { FeatureContinue } from '../components/FeatureContinue'
import { MobileStickyCta } from '../components/MobileStickyCta'
import { PageMast } from '../components/PageMast'
import { SectionEyebrow } from '../components/SectionEyebrow'
import { ProjectCardPreview } from '../components/ProjectCardPreview'
import { DICT, type Lang } from '../i18n'
import { formatDate } from '../lib/format'
import { listPublicProjects, type PublicProject } from '../lib/sessionsApi'
import { PAGE_FOLIOS } from '../lib/folios'
import { PAGE_FEATURE } from '../lib/features'

type TierFilter = '0' | '1' | '2' | '3'
type StatusFilter = 'active' | 'shipped' | 'draft' | 'triage' | 'rejected'

const TIER_VALUES: TierFilter[] = ['0', '1', '2', '3']
const STATUS_VALUES: StatusFilter[] = ['active', 'shipped', 'draft', 'triage', 'rejected']

function isTier(v: string | null): v is TierFilter {
  return v !== null && (TIER_VALUES as readonly string[]).includes(v)
}
function isStatus(v: string | null): v is StatusFilter {
  return v !== null && (STATUS_VALUES as readonly string[]).includes(v)
}

/**
 * Public projects gallery. Lists every session admin has opted into the
 * showcase (showcased_at IS NOT NULL). Each card shows the admin-set title +
 * tagline, the pinned current-build label, and a button to open the share
 * detail view at /share/<id>. No auth — the gallery is the front-facing
 * "what I've shipped" surface.
 */
export function Projects({ lang }: { lang: Lang }) {
  const t = DICT[lang].projects
  const tf = DICT[lang].projectsFilter
  const [projects, setProjects] = useState<PublicProject[] | null>(null)
  const [error, setError] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()
  const langPrefix = lang === 'en' ? '/en' : ''

  const tier = isTier(searchParams.get('tier')) ? (searchParams.get('tier') as TierFilter) : null
  const status = isStatus(searchParams.get('status'))
    ? (searchParams.get('status') as StatusFilter)
    : null

  useEffect(() => {
    document.title = `${t.heading} — Marc`
  }, [t])

  useEffect(() => {
    let cancelled = false
    listPublicProjects()
      .then((r) => {
        if (cancelled) return
        setProjects(r.projects)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Filtered view — recomputed only when filters or data change. The
  // gallery's underlying sort order (showcasedAt desc, from the server) is
  // preserved; filters never reshuffle.
  const filtered = useMemo(() => {
    if (!projects) return null
    return projects.filter((p) => {
      if (tier !== null && String(p.tier ?? '') !== tier) return false
      if (status !== null && p.status !== status) return false
      return true
    })
  }, [projects, tier, status])

  const hasFilter = tier !== null || status !== null

  function setFilter(key: 'tier' | 'status', value: string | null) {
    const next = new URLSearchParams(searchParams)
    if (value === null) next.delete(key)
    else next.set(key, value)
    setSearchParams(next, { replace: false })
  }

  function clearFilters() {
    const next = new URLSearchParams(searchParams)
    next.delete('tier')
    next.delete('status')
    setSearchParams(next, { replace: false })
  }

  return (
    <div className="app" data-feature={PAGE_FEATURE['page.projects']}>
      <Header lang={lang} />
      <main id="main-content">
        <article className="section projects">
          <div className="section__inner">
            <PageMast
              folio={
                lang === 'fr'
                  ? `№ ${PAGE_FOLIOS.projects} — la galerie`
                  : `№ ${PAGE_FOLIOS.projects} — the gallery`
              }
              stampLabel={lang === 'fr' ? 'LIVRÉ' : 'SHIPPED'}
              stampSub="QUÉBEC · ASYNC"
              feature={PAGE_FEATURE['page.projects']}
              lang={lang}
            >
              <SectionEyebrow lang={lang} feature={PAGE_FEATURE['page.projects']}>
                {t.eyebrow}
              </SectionEyebrow>
              <h1 className="projects__title">{t.heading}</h1>
              <p className="projects__intro">{t.intro}</p>
            </PageMast>

            {projects && projects.length > 0 && (
              <ProjectsFilterBar
                lang={lang}
                tier={tier}
                status={status}
                onSetFilter={setFilter}
                onClear={clearFilters}
                hasFilter={hasFilter}
              />
            )}

            {error && (
              <p className="thread__empty mono" role="alert">
                {t.error}
              </p>
            )}

            {projects === null && !error ? (
              <p className="mono">{t.loading}</p>
            ) : projects && projects.length === 0 ? (
              <p className="thread__empty">{t.empty}</p>
            ) : filtered && filtered.length === 0 ? (
              <div className="projects__empty">
                <p className="thread__empty">{tf.emptyAfterFilter}</p>
                <button
                  type="button"
                  className="projects-filter__clear projects-filter__clear--inline mono"
                  onClick={clearFilters}
                >
                  {tf.clear} ✕
                </button>
              </div>
            ) : (
              <ul className="projects__grid">
                {(filtered ?? []).map((p) => (
                  <ProjectCard key={p.id} project={p} lang={lang} langPrefix={langPrefix} />
                ))}
              </ul>
            )}

            <TierPlaceholders lang={lang} langPrefix={langPrefix} />
          </div>
        </article>
      </main>
      <FeatureContinue feature={PAGE_FEATURE['page.projects']} lang={lang} />
      <Footer lang={lang} />
      {/* Gallery has no hero, so a smaller scroll threshold makes the pill
          appear right after the first card. `.site-footer` is the hide-near
          sentinel (no `#cta` section on this page). */}
      <MobileStickyCta lang={lang} appearAfterRatio={0.3} />
    </div>
  )
}

function ProjectsFilterBar({
  lang,
  tier,
  status,
  onSetFilter,
  onClear,
  hasFilter,
}: {
  lang: Lang
  tier: TierFilter | null
  status: StatusFilter | null
  onSetFilter: (k: 'tier' | 'status', v: string | null) => void
  onClear: () => void
  hasFilter: boolean
}) {
  const tf = DICT[lang].projectsFilter
  return (
    <div
      className="projects-filter"
      role="region"
      aria-label={`${tf.tierLabel} / ${tf.statusLabel}`}
    >
      <div className="projects-filter__row">
        <span className="projects-filter__label mono">{tf.tierLabel}</span>
        <div className="projects-filter__chips" role="group" aria-label={tf.tierLabel}>
          <button
            type="button"
            className={`projects-filter__chip${tier === null ? ' is-active' : ''}`}
            onClick={() => onSetFilter('tier', null)}
            aria-pressed={tier === null}
          >
            {tf.all}
          </button>
          {TIER_VALUES.map((tv) => (
            <button
              key={tv}
              type="button"
              className={`projects-filter__chip projects-filter__chip--tier projects-filter__chip--tier-${tv}${tier === tv ? ' is-active' : ''}`}
              onClick={() => onSetFilter('tier', tier === tv ? null : tv)}
              aria-pressed={tier === tv}
            >
              T{tv}
            </button>
          ))}
        </div>
      </div>
      <div className="projects-filter__row">
        <span className="projects-filter__label mono">{tf.statusLabel}</span>
        <div className="projects-filter__chips" role="group" aria-label={tf.statusLabel}>
          <button
            type="button"
            className={`projects-filter__chip${status === null ? ' is-active' : ''}`}
            onClick={() => onSetFilter('status', null)}
            aria-pressed={status === null}
          >
            {tf.all}
          </button>
          {STATUS_VALUES.map((sv) => (
            <button
              key={sv}
              type="button"
              className={`projects-filter__chip projects-filter__chip--status projects-filter__chip--status-${sv}${status === sv ? ' is-active' : ''}`}
              onClick={() => onSetFilter('status', status === sv ? null : sv)}
              aria-pressed={status === sv}
            >
              {tf.statusLabels[sv]}
            </button>
          ))}
        </div>
      </div>
      {hasFilter && (
        <button type="button" className="projects-filter__clear mono" onClick={onClear}>
          {tf.clear} ✕
        </button>
      )}
    </div>
  )
}

/**
 * Per-tier invitation strip rendered under the projects gallery. Four cards
 * (T0/T1/T2/T3) — each a starting line at a different scope/price. T0 points
 * at the self-serve page; T1-T3 point at the intake. Reuses .project-card and
 * .project-card__tier--tN styling so the placeholders sit in visual lockstep
 * with the live cards above, but with a dashed treatment so visitors read
 * them as "available slots" rather than shipped work.
 */
function TierPlaceholders({ lang, langPrefix }: { lang: Lang; langPrefix: string }) {
  const t = DICT[lang].projects
  // Reuse the canonical tier labels already defined for the admin showcase
  // panel — single source of truth for the public-facing "Tier N · price"
  // string in both languages.
  const labels = DICT[lang].showcaseAdmin
  const intakeHref = `${langPrefix}/intake`
  const tier0Href = `${langPrefix}/tier-0`
  const tiers = [
    { tier: 0 as const, title: labels.tierOption0, href: tier0Href, cta: t.placeholderT0Cta },
    { tier: 1 as const, title: labels.tierOption1, href: intakeHref, cta: t.placeholderIntakeCta },
    { tier: 2 as const, title: labels.tierOption2, href: intakeHref, cta: t.placeholderIntakeCta },
    { tier: 3 as const, title: labels.tierOption3, href: intakeHref, cta: t.placeholderIntakeCta },
  ]
  return (
    <section className="projects-placeholders" aria-labelledby="projects-placeholders-heading">
      <header className="projects-placeholders__head">
        <SectionEyebrow lang={lang} feature={undefined}>
          {t.placeholderEyebrow}
        </SectionEyebrow>
        <h2 id="projects-placeholders-heading" className="projects-placeholders__title">
          {t.placeholderHeading}
        </h2>
        <p className="projects-placeholders__intro">{t.placeholderIntro}</p>
      </header>
      <ul className="projects__grid projects-placeholders__grid">
        {tiers.map((slot) => (
          <li key={slot.tier} className="project-card project-card--placeholder">
            <a href={slot.href} className="project-card__link">
              <div className="project-card__head">
                <span
                  className={`project-card__tier mono project-card__tier--t${slot.tier}`}
                  aria-hidden="true"
                >
                  {t.tierPrefix} {slot.tier}
                </span>
              </div>
              <h3 className="project-card__title">{slot.title}</h3>
              <div className="project-card__cta mono">{slot.cta}</div>
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}

function ProjectCard({
  project,
  lang,
  langPrefix,
}: {
  project: PublicProject
  lang: Lang
  langPrefix: string
}) {
  const t = DICT[lang].projects
  const shareHref = `${langPrefix}/share/${project.id}`
  const buildHref = project.currentBuild?.buildUrl
    ? `${project.currentBuild.buildUrl}${project.currentBuild.iframePath ?? ''}`
    : null
  const title = project.title || t.untitled
  // Only the *clicked* card gets the shared view-transition name — otherwise
  // every card would morph into the destination and the browser would refuse
  // the transition (names must be unique within a snapshot).
  const isTransitioning = useViewTransitionState(shareHref)
  const cardStyle = isTransitioning ? { viewTransitionName: 'project-detail' } : undefined
  return (
    <li className="project-card" style={cardStyle}>
      <Link to={shareHref} className="project-card__link" viewTransition>
        <ProjectCardPreview
          buildHref={buildHref}
          title={title}
          sessionId={project.id}
          lang={lang}
        />
        <div className="project-card__head">
          <span className="project-card__date mono">{formatDate(project.showcasedAt, lang)}</span>
          <span className="project-card__head-right">
            {project.tier !== null && (
              <span className={`project-card__tier mono project-card__tier--t${project.tier}`}>
                {t.tierPrefix} {project.tier}
              </span>
            )}
            <span className={`project-card__status mono project-card__status--${project.status}`}>
              {project.status}
            </span>
          </span>
        </div>
        <h2 className="project-card__title">{title}</h2>
        {project.tagline && <p className="project-card__tagline">{project.tagline}</p>}
        {project.currentBuild ? (
          <div className="project-card__build">
            <span className="mono project-card__build-eyebrow">{t.currentBuildLabel}</span>
            <span className="project-card__build-name">{project.currentBuild.label}</span>
          </div>
        ) : (
          <div className="project-card__build project-card__build--none">
            <span className="mono project-card__build-eyebrow">{t.noBuildYet}</span>
          </div>
        )}
        <div className="project-card__cta mono">{t.openCta}</div>
      </Link>
      {buildHref && (
        <a
          className="project-card__build-link mono"
          href={buildHref}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
        >
          {t.openBuild}
        </a>
      )}
    </li>
  )
}
