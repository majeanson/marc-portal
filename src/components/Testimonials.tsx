import { useEffect, useState } from 'react'
import { DICT, type Lang } from '../i18n'
import { HOME_FOLIOS } from '../lib/folios'
import { listPublicVouches, type PublicVouch, type VouchRelationship } from '../lib/vouchesApi'
import { SectionEyebrow } from './SectionEyebrow'
import { HomeDrillCard } from './HomeDrillCard'
import { HOME_SECTION_FEATURE, PAGE_FEATURE } from '../lib/features'

const HOME_LIMIT = 3

/**
 * Home-page social-proof block — surfaces the most recent approved vouches
 * (newest-first, capped at 3) to soften the page just before the FAQ.
 *
 * Renders nothing until at least one vouch is approved: a half-empty
 * "be the first" block early on would just advertise that nobody has
 * vouched yet. SectionRail filters out entries whose target element is
 * missing on mount, so an absent `#testimonials` section is silently
 * dropped from the index too.
 *
 * The drill-down card at the bottom matches the standardized home-drill-
 * card pattern used by `#featured` and `#how`, so visitors get the same
 * "go deeper" affordance everywhere on the home page.
 */
export function Testimonials({ lang }: { lang: Lang }) {
  const t = DICT[lang].featuredTestimonials
  const labels = DICT[lang].vouches.relationshipLabels
  const langPrefix = lang === 'en' ? '/en' : ''
  const vouchesHref = `${langPrefix}/vouches`
  const writeHref = `${langPrefix}/vouch`
  const [vouches, setVouches] = useState<PublicVouch[] | null>(null)

  useEffect(() => {
    let cancelled = false
    listPublicVouches()
      .then((r) => {
        if (cancelled) return
        setVouches(r.vouches.slice(0, HOME_LIMIT))
      })
      .catch(() => {
        // Silent failure — the home section is a "nice to have" and a
        // hard-render with a network error would just look broken.
        if (!cancelled) setVouches([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Don't render at all (no eyebrow, no heading) when there's nothing
  // to show. SectionRail's element-presence check drops the index entry
  // accordingly.
  if (vouches === null || vouches.length === 0) return null

  const feature = HOME_SECTION_FEATURE['testimonials']

  return (
    <section
      className="section section--editorial testimonials-section"
      id="testimonials"
      data-feature={feature}
      aria-labelledby="testimonials-heading"
    >
      <div className="section__inner">
        <header className="section__head">
          <div className="section__folio mono" aria-hidden="true">
            {HOME_FOLIOS.testimonials}
          </div>
          <SectionEyebrow lang={lang} feature={feature}>
            {t.eyebrow}
          </SectionEyebrow>
          <h2 id="testimonials-heading" className="section__display">
            {t.title}
          </h2>
          <p className="section__lead">{t.sub}</p>
        </header>

        <ul className="vouches-list__items testimonials-section__list">
          {vouches.map((v) => {
            const relKey = v.author_relationship as VouchRelationship
            const relLabel = labels[relKey] ?? v.author_relationship
            return (
              <li key={v.id} className="vouch-card">
                <blockquote className="vouch-card__body">
                  <p>{v.body}</p>
                </blockquote>
                <footer className="vouch-card__attribution">
                  <span className="vouch-card__name">
                    {v.link_url ? (
                      <a href={v.link_url} target="_blank" rel="noopener noreferrer nofollow">
                        {v.author_name}
                      </a>
                    ) : (
                      v.author_name
                    )}
                  </span>
                  <span className="vouch-card__rel"> · {relLabel}</span>
                </footer>
              </li>
            )
          })}
        </ul>

        {/* Shared "go deeper" card — same pattern as #featured and #how. */}
        <HomeDrillCard
          lang={lang}
          feature={PAGE_FEATURE['page.vouches']}
          href={vouchesHref}
          eyebrow={t.galleryCard.eyebrow}
          title={t.galleryCard.title}
          body={t.galleryCard.body}
          cta={t.galleryCard.cta}
        />

        <p className="testimonials-section__write">
          <a className="testimonials-section__write-link mono" href={writeHref}>
            {t.writeOne}
          </a>
        </p>
      </div>
    </section>
  )
}
