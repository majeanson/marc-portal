/**
 * HomeDrillCard — the standardized "go deeper" card at the bottom of a
 * home section. Three sections use it (#featured → /projects, #how →
 * /parcours, #testimonials → /vouches): each one previously hand-rolled
 * the same wrapper / feature-dot / eyebrow / title / body / CTA markup.
 *
 * The wrapper carries data-feature so the dot + the eyebrow accent read
 * in the destination page's colour. `stats` is optional — only the
 * Journey card surfaces a stat row; when omitted the card uses the
 * --no-stats modifier that collapses it to a single column.
 */

import type { Lang } from '../i18n'
import type { FeatureId } from '../lib/features'
import { FeatureDot } from './FeatureDot'

export interface DrillStat {
  val: string
  label: string
}

interface Props {
  lang: Lang
  /** Destination page's feature — drives the dot + eyebrow accent. */
  feature: FeatureId | undefined
  href: string
  eyebrow: string
  title: string
  body: string
  cta: string
  /** Optional stat row (used by the Journey card only). */
  stats?: DrillStat[]
}

export function HomeDrillCard({ lang, feature, href, eyebrow, title, body, cta, stats }: Props) {
  return (
    <div className="home-drill-card-wrap" data-feature={feature}>
      <a className={`home-drill-card${stats ? '' : ' home-drill-card--no-stats'}`} href={href}>
        <div className="home-drill-card-text">
          <span className="home-drill-card-feature">
            <FeatureDot feature={feature} lang={lang} size="sm" decorative />
            <span className="home-drill-card-eyebrow mono">{eyebrow}</span>
          </span>
          <h3 className="home-drill-card-title">{title}</h3>
          <p className="home-drill-card-body">{body}</p>
        </div>
        {stats && (
          <ul className="home-drill-card-stats" aria-hidden="true">
            {stats.map((s) => (
              <li key={s.label} className="home-drill-card-stat">
                <span className="home-drill-card-stat-val">{s.val}</span>
                <span className="home-drill-card-stat-label mono">{s.label}</span>
              </li>
            ))}
          </ul>
        )}
        <span className="home-drill-card-cta mono">{cta}</span>
      </a>
    </div>
  )
}
