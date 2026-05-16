import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { DICT, type Lang } from '../i18n'
import { formatDate } from '../lib/format'
import { listPublicProjects, type PublicProject } from '../lib/sessionsApi'

interface Warning {
  key: string
  label: string
}

/**
 * Operator-only grid view of every showcased session's OG card. The card grid
 * is the brand-check surface: title-overflow, missing tagline, un-tiered
 * sessions are all called out as chips on top of the OG preview so admin can
 * fix them before they go out into the wild.
 *
 * Each card links to /admin/inbox/<id> for editing, and exposes a small "Open
 * share page" link to the public /share/<id> for spot-checking.
 *
 * Data: reuses the existing public /api/public/projects endpoint — it returns
 * exactly what we need (showcase title/tagline/tier/status/showcasedAt) and
 * is already filtered server-side to showcased sessions only.
 */
export function AdminShowcase({ lang }: { lang: Lang }) {
  const t = DICT[lang].adminShowcaseOverview
  const langPrefix = lang === 'en' ? '/en' : ''
  const [projects, setProjects] = useState<PublicProject[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    document.title = `${t.title} — Marc`
  }, [t])

  useEffect(() => {
    let cancelled = false
    listPublicProjects()
      .then((r) => {
        if (!cancelled) setProjects(r.projects)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const summary = useMemo(() => {
    if (!projects) return null
    let warnings = 0
    for (const p of projects) {
      warnings += warningsFor(p, t).length
    }
    return { total: projects.length, warnings }
  }, [projects, t])

  return (
    <article className="admin-showcase">
      <header className="admin-showcase__head">
        <div className="section__eyebrow">{t.eyebrow}</div>
        <h1 className="admin-showcase__title">{t.title}</h1>
        <p className="admin-showcase__sub">{t.sub}</p>
        {summary && (
          <p className="admin-showcase__count mono">
            {summary.total === 1 ? t.countSingular : t.countPlural(summary.total)}
            {summary.warnings > 0 && <> · {t.countWarnings(summary.warnings)}</>}
          </p>
        )}
      </header>

      {error && (
        <p className="mono admin-showcase__error" role="alert">
          {t.error}
        </p>
      )}

      {projects === null && !error && <p className="mono">{t.loading}</p>}

      {projects && projects.length === 0 && !error && (
        <p className="admin-showcase__empty">{t.empty}</p>
      )}

      {/* The home OG card is always present (live, /og/home), pinned at
          the top of the grid so brand-checking the homepage card sits in
          the same workflow as project cards. Doesn't depend on having
          showcased projects. */}
      <ul className="admin-showcase__grid">
        <HomeShowcaseCard lang={lang} langPrefix={langPrefix} />
        {projects?.map((p) => (
          <ShowcaseCard key={p.id} project={p} lang={lang} langPrefix={langPrefix} t={t} />
        ))}
      </ul>
    </article>
  )
}

const HOME_COPY = {
  fr: {
    title: 'Page d’accueil',
    tagline: 'Carte sociale dynamique — stats en direct depuis D1.',
    openLabel: 'Ouvrir l’accueil',
  },
  en: {
    title: 'Home page',
    tagline: 'Dynamic social card — live stats from D1.',
    openLabel: 'Open home',
  },
} as const

function useMountedAt(): number {
  // Stable per-mount timestamp. Used as a cache-bust seed so re-renders
  // during the same page-load don't refetch the OG image, but a fresh
  // navigation does. useState's lazy initializer runs once per mount —
  // the canonical pattern for "stable computed-once value" in React 19
  // (refs can't be written during render under the new purity rules).
  const [t] = useState(() => Date.now())
  return t
}

function HomeShowcaseCard({ lang, langPrefix }: { lang: Lang; langPrefix: string }) {
  const c = HOME_COPY[lang]
  // Same cache-bust rationale as ShowcaseCard. Home OG cache is only
  // 1h on the edge but admin loads this view to verify just-published
  // changes, so we want the freshest possible byte-for-byte preview.
  // The mountedAt timestamp is stable across re-renders within one
  // page-load but changes between visits — exactly what we want.
  const mountedAt = useMountedAt()
  const ogSrc = `/og/home?${lang === 'en' ? 'lang=en&' : ''}v=${mountedAt}`
  // Tile target: the public home page in the matching language. There's
  // no "edit this card" surface for /og/home — its content is computed,
  // not stored — so the tile acts as a preview + open-the-page link.
  const homeHref = lang === 'en' ? '/en' : '/'
  const debugHref = `/og/home?debug=1${lang === 'en' ? '&lang=en' : ''}`
  return (
    <li className="admin-showcase__card admin-showcase__card--home">
      <a href={homeHref} target="_blank" rel="noreferrer" className="admin-showcase__card-link">
        <div className="admin-showcase__card-frame">
          <img
            src={ogSrc}
            alt={c.title}
            width={1200}
            height={630}
            loading="lazy"
            className="admin-showcase__card-img"
          />
        </div>
        <div className="admin-showcase__card-meta">
          <div className="admin-showcase__card-row">
            <span className="mono admin-showcase__card-date">
              /{langPrefix === '/en' ? 'en' : ''}
            </span>
            <span className="admin-showcase__card-pills">
              <span className="project-card__status mono">live</span>
            </span>
          </div>
          <h2 className="admin-showcase__card-title">{c.title}</h2>
          <p className="admin-showcase__card-tagline">{c.tagline}</p>
        </div>
      </a>
      <div className="admin-showcase__card-actions">
        <a
          className="mono admin-showcase__card-share"
          href={debugHref}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
        >
          debug=1
        </a>
        <a
          className="mono admin-showcase__card-share"
          href={homeHref}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
        >
          {c.openLabel}
        </a>
      </div>
    </li>
  )
}

function ShowcaseCard({
  project,
  lang,
  langPrefix,
  t,
}: {
  project: PublicProject
  lang: Lang
  langPrefix: string
  t: (typeof DICT)[Lang]['adminShowcaseOverview']
}) {
  const warnings = warningsFor(project, t)
  // Cache-bust on showcasedAt so the admin grid always reflects the
  // current showcase content. Without this, admin tweaks to the
  // title/tagline don't surface in the brand-check view until the
  // 24h edge cache on /og/share expires. Also self-heals stale-cache
  // pollution from prior renderer regressions (the URL changes →
  // browser cache miss → fresh fetch).
  const cacheKey = `v=${project.showcasedAt}`
  const ogSrc = `/og/share/${project.id}?${lang === 'en' ? 'lang=en&' : ''}${cacheKey}`
  const editHref = `${langPrefix}/admin/inbox/${project.id}`
  const shareHref = `${langPrefix}/share/${project.id}`
  return (
    <li className="admin-showcase__card">
      <Link to={editHref} className="admin-showcase__card-link">
        <div className="admin-showcase__card-frame">
          <img
            src={ogSrc}
            alt={project.title ?? ''}
            width={1200}
            height={630}
            loading="lazy"
            className="admin-showcase__card-img"
          />
          {warnings.length > 0 && (
            <ul className="admin-showcase__warnings">
              {warnings.map((w) => (
                <li key={w.key} className="admin-showcase__warning mono">
                  ⚠ {w.label}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="admin-showcase__card-meta">
          <div className="admin-showcase__card-row">
            <span className="mono admin-showcase__card-date">
              {formatDate(project.showcasedAt, lang)}
            </span>
            <span className="admin-showcase__card-pills">
              {project.tier !== null && (
                <span className={`project-card__tier mono project-card__tier--t${project.tier}`}>
                  T{project.tier}
                </span>
              )}
              <span className={`project-card__status mono project-card__status--${project.status}`}>
                {project.status}
              </span>
            </span>
          </div>
          <h2 className="admin-showcase__card-title">{project.title ?? '—'}</h2>
          {project.tagline && <p className="admin-showcase__card-tagline">{project.tagline}</p>}
        </div>
      </Link>
      <div className="admin-showcase__card-actions">
        <span className="mono admin-showcase__card-edit">{t.editLink}</span>
        <a
          className="mono admin-showcase__card-share"
          href={shareHref}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
        >
          {t.openShare}
        </a>
      </div>
    </li>
  )
}

/**
 * Surface the gaps that would make the social card look weak: untitled,
 * missing tagline, no tier assigned, oversized title that the OG renderer
 * truncates. Cheap, deterministic check; ranges intentionally mirror the
 * truncation thresholds inside functions/og/share/[id].ts.
 */
function warningsFor(p: PublicProject, t: (typeof DICT)[Lang]['adminShowcaseOverview']): Warning[] {
  const out: Warning[] = []
  if (!p.title) out.push({ key: 'no-title', label: t.warnings.noTitle })
  else if (p.title.length > 60) out.push({ key: 'title-long', label: t.warnings.titleLong })
  if (!p.tagline) out.push({ key: 'no-tagline', label: t.warnings.noTagline })
  if (p.tier === null) out.push({ key: 'no-tier', label: t.warnings.noTier })
  return out
}
