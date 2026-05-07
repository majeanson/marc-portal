import { useMemo, useState } from 'react'
import type { Lang } from '../i18n'
import { DICT } from '../i18n'
import { listShowcases } from '../lib/showcases'
import type { Tier } from '../lib/showcases'

type TierFilter = 'all' | Tier
type StatusFilter = 'all' | 'draft' | 'active' | 'frozen'

const TIER_OPTIONS: TierFilter[] = ['all', 'Tier 0', 'Tier 1', 'Tier 2', 'Tier 3']
const STATUS_OPTIONS: StatusFilter[] = ['all', 'draft', 'active', 'frozen']

export function ShowcasesWall({ lang }: { lang: Lang }) {
  const t = DICT[lang].showcases
  const all = listShowcases()
  const [tierFilter, setTierFilter] = useState<TierFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const entries = useMemo(() => {
    return all.filter(({ feature, showcase }) => {
      if (tierFilter !== 'all' && showcase.tier !== tierFilter) return false
      if (statusFilter !== 'all' && feature.status !== statusFilter) return false
      return true
    })
  }, [all, tierFilter, statusFilter])

  const showcasePath = (slug: string) =>
    lang === 'fr' ? `/showcase/${slug}` : `/en/showcase/${slug}`

  return (
    <section className="section section--alt" id="showcases">
      <div className="section__inner">
        <div className="section__eyebrow">{t.eyebrow}</div>
        <h2>{t.title}</h2>
        <p>{t.body}</p>

        <div className="filters">
          <fieldset className="filter-group">
            <legend className="filter-group__label mono">{t.filterTier}</legend>
            <div className="filter-group__chips">
              {TIER_OPTIONS.map((tier) => (
                <button
                  key={tier}
                  type="button"
                  className={`chip${tierFilter === tier ? ' chip--active' : ''}`}
                  onClick={() => setTierFilter(tier)}
                  aria-pressed={tierFilter === tier}
                  aria-label={`${t.filterTier}: ${tier === 'all' ? t.filterAll : tier}`}
                >
                  {tier === 'all' ? t.filterAll : tier}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="filter-group">
            <legend className="filter-group__label mono">{t.filterStatus}</legend>
            <div className="filter-group__chips">
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`chip${statusFilter === s ? ' chip--active' : ''}`}
                  onClick={() => setStatusFilter(s)}
                  aria-pressed={statusFilter === s}
                  aria-label={`${t.filterStatus}: ${s === 'all' ? t.filterAll : s}`}
                >
                  {s === 'all' ? t.filterAll : s}
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        {entries.length === 0 ? (
          <div className="showcase-list__empty mono">{t.empty}</div>
        ) : (
          <div className="showcase-list">
            {entries.map(({ feature, showcase }) => {
              const title = showcase.title[lang] ?? showcase.title[showcase.primaryLang]
              const summary = showcase.summary[lang] ?? showcase.summary[showcase.primaryLang]
              const dateLabel = showcase.shippedDate ?? `→ ${showcase.targetShipDate ?? ''}`
              return (
                <a
                  key={showcase.slug}
                  className="showcase"
                  href={showcasePath(showcase.slug)}
                  aria-label={title}
                >
                  <div className="showcase__meta">
                    <span
                      className={`status status--${feature.status}`}
                      style={{ marginRight: 10 }}
                    >
                      {feature.status}
                    </span>
                    {showcase.tier} · {showcase.price} · {showcase.hours} · {dateLabel}
                  </div>
                  <div className="showcase__title">{title}</div>
                  <p className="showcase__problem">{summary}</p>
                </a>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
