import { useMemo } from 'react'
import type { Lang } from '../i18n'
import type { PublicProject } from '../lib/sessionsApi'
import { ProjectCardPreview } from './ProjectCardPreview'

/**
 * Single shipped-project preview card rendered inside the hero. Anchors
 * the visitor's "is this real?" question with one concrete artifact: a
 * live thumbnail of the most recent shipped build that has a public build
 * URL, with a tier badge and the project title. Click → /share/:id.
 *
 * Hidden entirely when:
 *  - projects is null (in-flight or 503)
 *  - no project matches (no shipped+showcased+currentBuild)
 *
 * Hiding is preferred over a placeholder: an "Aucun projet livré" card
 * in the hero would actively hurt conversion.
 */
export function HeroShippedProject({
  projects,
  lang,
}: {
  projects: PublicProject[] | null
  lang: Lang
}) {
  const langPrefix = lang === 'en' ? '/en' : ''

  // Pick the freshest project that has a build URL — without one, the
  // ProjectCardPreview falls back to the OG card which is fine but less
  // visceral. Shipped status only; in-progress builds would be misleading
  // in a "shipped this year" frame.
  const pick = useMemo(() => {
    if (!projects) return null
    const candidates = projects.filter((p) => p.status === 'shipped' && p.currentBuild?.buildUrl)
    if (candidates.length === 0) return null
    // listPublicProjects returns showcased_at DESC already, but be defensive
    // — sort by the build's date when present, else by showcasedAt.
    return [...candidates].sort((a, b) => {
      const ad = a.currentBuild?.date ?? a.showcasedAt
      const bd = b.currentBuild?.date ?? b.showcasedAt
      return bd - ad
    })[0]
  }, [projects])

  if (!pick) return null

  const title = pick.title ?? (lang === 'fr' ? 'Projet sans titre' : 'Untitled project')
  const tagline = pick.tagline
  const tierBadge = pick.tier !== null ? `Tier ${pick.tier}` : null
  const href = `${langPrefix}/share/${pick.id}`
  const buildHref = pick.currentBuild?.buildUrl
    ? `${pick.currentBuild.buildUrl}${pick.currentBuild.iframePath ?? ''}`
    : null

  const eyebrow = lang === 'fr' ? 'Dernier projet livré' : 'Latest shipped'
  const openLabel = lang === 'fr' ? 'Ouvrir →' : 'Open →'

  return (
    <aside
      className="hero__shipped"
      aria-label={
        lang === 'fr' ? 'Aperçu du dernier projet livré' : 'Latest shipped project preview'
      }
    >
      <a className="hero__shipped-link" href={href}>
        <div className="hero__shipped-thumb">
          <ProjectCardPreview buildHref={buildHref} title={title} sessionId={pick.id} lang={lang} />
        </div>
        <div className="hero__shipped-meta">
          <div className="hero__shipped-meta-row">
            <span className="mono hero__shipped-eyebrow">{eyebrow}</span>
            {tierBadge && <span className="mono hero__shipped-tier">{tierBadge}</span>}
          </div>
          <h3 className="hero__shipped-title">{title}</h3>
          {tagline && <p className="hero__shipped-tagline">{tagline}</p>}
          <span className="mono hero__shipped-open">{openLabel}</span>
        </div>
      </a>
    </aside>
  )
}
