import { useEffect, useState } from 'react'
import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import { DICT, type Lang } from '../i18n'
import { formatDate } from '../lib/format'
import { listPublicProjects, type PublicProject } from '../lib/sessionsApi'

/**
 * Public projects gallery. Lists every session admin has opted into the
 * showcase (showcased_at IS NOT NULL). Each card shows the admin-set title +
 * tagline, the pinned current-build label, and a button to open the share
 * detail view at /share/<id>. No auth — the gallery is the front-facing
 * "what I've shipped" surface.
 */
export function Projects({ lang }: { lang: Lang }) {
  const t = DICT[lang].projects
  const [projects, setProjects] = useState<PublicProject[] | null>(null)
  const [error, setError] = useState(false)
  const langPrefix = lang === 'en' ? '/en' : ''

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

  return (
    <div className="app">
      <Header lang={lang} />
      <main id="main-content">
        <article className="section projects">
          <div className="section__inner">
            <div className="section__eyebrow">{t.eyebrow}</div>
            <h1 className="projects__title">{t.heading}</h1>
            <p className="projects__intro">{t.intro}</p>

            {error && (
              <p className="thread__empty mono" role="alert">
                {t.error}
              </p>
            )}

            {projects === null && !error ? (
              <p className="mono">{t.loading}</p>
            ) : projects && projects.length === 0 ? (
              <p className="thread__empty">{t.empty}</p>
            ) : (
              <ul className="projects__grid">
                {(projects ?? []).map((p) => (
                  <ProjectCard key={p.id} project={p} lang={lang} langPrefix={langPrefix} />
                ))}
              </ul>
            )}
          </div>
        </article>
      </main>
      <Footer lang={lang} />
    </div>
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
  return (
    <li className="project-card">
      <a href={shareHref} className="project-card__link">
        <div className="project-card__head">
          <span className="project-card__date mono">{formatDate(project.showcasedAt, lang)}</span>
          <span className={`project-card__status mono project-card__status--${project.status}`}>
            {project.status}
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
