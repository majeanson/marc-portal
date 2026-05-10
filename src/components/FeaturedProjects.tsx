import { useEffect, useState } from 'react'
import type { Lang } from '../i18n'
import { DICT } from '../i18n'
import { formatDate } from '../lib/format'
import { listPublicProjects, type PublicProject } from '../lib/sessionsApi'

const FEATURED_LIMIT = 3

export function FeaturedProjects({ lang }: { lang: Lang }) {
  const t = DICT[lang].featured
  const langPrefix = lang === 'en' ? '/en' : ''
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

  // Hide the section entirely on error or empty — the home page is a point of
  // sale; an empty/broken "featured" strip undermines trust more than its
  // absence does.
  if (errored) return null
  if (projects && projects.length === 0) return null

  return (
    <section className="section featured-projects" id="featured">
      <div className="section__inner">
        <div className="section__eyebrow">{t.eyebrow}</div>
        <h2>{t.title}</h2>
        <p className="featured-projects__sub">{t.sub}</p>

        {projects === null ? (
          <p className="mono featured-projects__loading">{t.loading}</p>
        ) : (
          <ul className="projects__grid featured-projects__grid">
            {projects.map((p) => (
              <FeaturedCard key={p.id} project={p} lang={lang} langPrefix={langPrefix} />
            ))}
          </ul>
        )}

        <div className="featured-projects__more">
          <a className="featured-projects__see-all" href={`${langPrefix}/projects`}>
            {t.seeAll}
          </a>
        </div>
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
  return (
    <li className="project-card">
      <a href={shareHref} className="project-card__link" aria-label={title}>
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
      </a>
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
