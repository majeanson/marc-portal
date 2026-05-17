import { useEffect, useState } from 'react'
import { Link, useViewTransitionState } from 'react-router-dom'
import type { Lang } from '../i18n'
import { DICT } from '../i18n'
import { formatDate } from '../lib/format'
import { listPublicProjects, type PublicProject } from '../lib/sessionsApi'
import { ProjectCardPreview } from './ProjectCardPreview'

const FEATURED_LIMIT = 3

export function FeaturedProjects({ lang }: { lang: Lang }) {
  const t = DICT[lang].featured
  const langPrefix = lang === 'en' ? '/en' : ''
  const intakeHref = `${langPrefix}/intake`
  const galleryHref = `${langPrefix}/projects`
  const [projects, setProjects] = useState<PublicProject[] | null>(null)
  const [errored, setErrored] = useState(false)

  useEffect(() => {
    let cancelled = false
    listPublicProjects()
      .then((r) => {
        if (cancelled) return
        setProjects(r.projects.slice(0, FEATURED_LIMIT))
      })
      .catch(() => {
        if (!cancelled) setErrored(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const hasProjects = projects !== null && projects.length > 0
  const isLoading = projects === null && !errored
  const isEmpty = projects !== null && projects.length === 0

  return (
    <section className="section featured-projects section--editorial" id="featured">
      <div className="section__inner">
        <header className="section__head">
          <div className="section__folio mono" aria-hidden="true">
            III
          </div>
          <div className="section__eyebrow">{t.eyebrow}</div>
          <h2 className="section__display">{t.title}</h2>
          <p className="featured-projects__sub section__lead">{t.sub}</p>
        </header>

        {isLoading && <p className="mono featured-projects__loading">{t.loading}</p>}

        {hasProjects && projects && (
          <>
            <ul className="projects__grid featured-projects__grid">
              {projects.map((p) => (
                <FeaturedCard key={p.id} project={p} lang={lang} langPrefix={langPrefix} />
              ))}
            </ul>
            {/* Shared drill-down card pattern — matches the journey-card in
                #how so visitors get the same "go deeper" affordance every
                time a home section has a dedicated full page. No stats here,
                so the --no-stats modifier collapses the grid to a single
                column. */}
            <a className="home-drill-card home-drill-card--no-stats" href={galleryHref}>
              <div className="home-drill-card-text">
                <div className="home-drill-card-eyebrow mono">{t.galleryCard.eyebrow}</div>
                <h3 className="home-drill-card-title">{t.galleryCard.title}</h3>
                <p className="home-drill-card-body">{t.galleryCard.body}</p>
              </div>
              <span className="home-drill-card-cta mono">{t.galleryCard.cta}</span>
            </a>
          </>
        )}

        {isEmpty && (
          <div className="featured-projects__empty">
            <p className="featured-projects__empty-title">{t.emptyTitle}</p>
            <p className="featured-projects__empty-body">{t.emptyBody}</p>
            <a className="featured-projects__empty-cta" href={intakeHref}>
              {t.emptyCta}
            </a>
          </div>
        )}

        {errored && (
          <div className="featured-projects__empty">
            <p className="featured-projects__empty-title">{t.errorTitle}</p>
            <p className="featured-projects__empty-body">{t.errorBody}</p>
            <a className="featured-projects__empty-cta" href={galleryHref}>
              {t.seeAll}
            </a>
          </div>
        )}
      </div>
    </section>
  )
}

function FeaturedCard({
  project,
  lang,
  langPrefix,
}: {
  project: PublicProject
  lang: Lang
  langPrefix: string
}) {
  const t = DICT[lang].featured
  const shareHref = `${langPrefix}/share/${project.id}`
  const buildHref = project.currentBuild?.buildUrl
    ? `${project.currentBuild.buildUrl}${project.currentBuild.iframePath ?? ''}`
    : null
  const title = project.title || t.untitled
  const isTransitioning = useViewTransitionState(shareHref)
  const cardStyle = isTransitioning ? { viewTransitionName: 'project-detail' } : undefined
  return (
    <li className="project-card" style={cardStyle}>
      <Link to={shareHref} className="project-card__link" viewTransition aria-label={title}>
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
        <h3 className="project-card__title">{title}</h3>
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
