import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import { SectionEyebrow } from '../components/SectionEyebrow'
import { PAGE_FEATURE } from '../lib/features'
import { TimeTravelScrubber } from '../components/TimeTravelScrubber'
import { ShareModal } from '../components/ShareModal'
import { Surface } from '../components/Surface'
import { DICT, type Lang } from '../i18n'
import { formatDate } from '../lib/format'
import { listPublicAdvancements, type PublicAdvancementRow } from '../lib/advancementsApi'
import { listPublicVouches, type PublicVouch, type VouchRelationship } from '../lib/vouchesApi'

/**
 * Unauthenticated share view. Renders only the advancements an admin has
 * flagged `allowedForPublic` for the given session. Anyone with the URL can
 * see this — session IDs are 72-bit base64url tokens, so the URL is the
 * capability. Nothing else about the session is exposed.
 */
export function PublicAdvancements({ lang }: { lang: Lang }) {
  const t = DICT[lang].sessionAdvancements
  const { id } = useParams<{ id: string }>()
  const [items, setItems] = useState<PublicAdvancementRow[] | null>(null)
  const [error, setError] = useState<boolean>(false)
  const [openBuild, setOpenBuild] = useState<string | null>(null)
  const [shareOpen, setShareOpen] = useState(false)
  // Vouches scoped to this session — loaded in parallel with advancements
  // so the network waterfall is one round-trip. Render falls back to a
  // CTA-only block when nobody's vouched yet (zero is the steady state
  // for most fresh projects).
  const [vouches, setVouches] = useState<PublicVouch[]>([])

  useEffect(() => {
    document.title = `${t.heading} — Marc`
  }, [t])

  useEffect(() => {
    if (!id) return
    let cancelled = false
    listPublicAdvancements(id)
      .then((r) => {
        if (cancelled) return
        setItems(r.advancements)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    if (!id) return
    let cancelled = false
    listPublicVouches({ sessionId: id })
      .then((r) => {
        if (cancelled) return
        setVouches(r.vouches)
      })
      .catch(() => {
        // Vouches are non-critical — silently fall back to the CTA-only
        // empty state if the request fails. Advancement loading has its
        // own error path.
      })
    return () => {
      cancelled = true
    }
  }, [id])

  return (
    <div className="app" data-feature={PAGE_FEATURE['page.public-advancements']}>
      <Header lang={lang} />
      <main id="main-content">
        <article
          className="section intake session-frame"
          style={{ viewTransitionName: 'project-detail' }}
        >
          <div className="section__inner">
            <div className="session-frame__head-row">
              <div>
                <SectionEyebrow lang={lang} feature={PAGE_FEATURE['page.public-advancements']}>
                  {t.heading}
                </SectionEyebrow>
                <h1 className="session-frame__title">{t.heading}</h1>
                <p className="field__hint">{t.subtitle}</p>
              </div>
              {id && (
                <button
                  type="button"
                  className="share-cta mono"
                  onClick={() => setShareOpen(true)}
                  aria-haspopup="dialog"
                >
                  <span aria-hidden="true">↗</span> {t.shareCta}
                </button>
              )}
            </div>

            {error && (
              <p className="thread__empty mono" role="alert">
                {t.formError}
              </p>
            )}

            {items === null && !error ? (
              <p className="mono">{t.loading}</p>
            ) : items && items.length === 0 ? (
              <p className="thread__empty">{t.empty}</p>
            ) : (
              <ol className="session-advancements__list">
                {(items ?? []).map((row) => {
                  const linkHref =
                    row.build_url && row.build_url.length > 0
                      ? `${row.build_url}${row.iframe_path ?? ''}`
                      : null
                  const isOpen = openBuild === row.id
                  return (
                    <li key={row.id} className="session-advancements__entry">
                      <div className="session-advancements__head">
                        <span className="session-advancements__date mono">
                          {formatDate(row.date, lang)}
                        </span>
                        <span className="session-advancements__label">{row.label}</span>
                        {!linkHref && (
                          <span className="session-advancements__flag-pill session-advancements__flag-pill--pending mono">
                            {t.pillPendingStamp}
                          </span>
                        )}
                      </div>
                      {row.body && <p className="session-advancements__body">{row.body}</p>}
                      {linkHref && (
                        <div className="session-advancements__build-row">
                          <button
                            type="button"
                            className="rev-log__build-toggle mono"
                            onClick={() =>
                              setOpenBuild((prev) => (prev === row.id ? null : row.id))
                            }
                            aria-expanded={isOpen}
                          >
                            {isOpen ? t.hideBuild : t.viewBuild}
                          </button>
                          <a
                            className="rev-log__open-tab mono"
                            href={linkHref}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {t.openInNewTab}
                          </a>
                        </div>
                      )}
                      {isOpen && linkHref && (
                        <div className="rev-log__build-frame session-advancements__frame">
                          <p className="rev-log__build-hint mono">{t.buildHint}</p>
                          <iframe
                            src={linkHref}
                            title={`${t.iframeTitle}: ${row.label}`}
                            loading="lazy"
                            sandbox="allow-scripts allow-same-origin allow-forms"
                          />
                        </div>
                      )}
                    </li>
                  )
                })}
              </ol>
            )}
            {items && items.length > 0 && <TimeTravelScrubber advancements={items} lang={lang} />}

            {id && <ShareTestimonials lang={lang} sessionId={id} vouches={vouches} />}
          </div>
        </article>
      </main>
      <Footer lang={lang} />
      {id && (
        <ShareModal
          lang={lang}
          sessionId={id}
          open={shareOpen}
          onClose={() => setShareOpen(false)}
        />
      )}
    </div>
  )
}

/**
 * Bottom-of-page testimonials block for /share/:id. Shows the list of
 * approved vouches attributed to this session, plus an always-visible CTA
 * inviting a new vouch (deep-links to /vouch?for=:sessionId so the form
 * is pre-attributed). When there are no vouches yet, the list collapses
 * to a small empty hint — the CTA carries the section on its own so the
 * page still surfaces a way to participate from day one.
 */
function ShareTestimonials({
  lang,
  sessionId,
  vouches,
}: {
  lang: Lang
  sessionId: string
  vouches: PublicVouch[]
}) {
  const t = DICT[lang].sessionAdvancements.testimonials
  const labels = DICT[lang].vouches.relationshipLabels
  const langPrefix = lang === 'en' ? '/en' : ''
  const vouchHref = `${langPrefix}/vouch?for=${encodeURIComponent(sessionId)}`
  return (
    <section className="share-testimonials" aria-labelledby="share-testimonials-heading">
      {/* Neutral dot — this sub-section shows vouches inside an iterative
          page, so it's cross-cutting rather than claiming a feature. */}
      <SectionEyebrow lang={lang} feature={undefined}>
        {t.eyebrow}
      </SectionEyebrow>
      <h2 id="share-testimonials-heading" className="share-testimonials__heading">
        {t.heading}
      </h2>
      {vouches.length === 0 ? (
        <p className="field__hint share-testimonials__empty">{t.empty}</p>
      ) : (
        <ul className="vouches-list__items share-testimonials__list">
          {vouches.map((v) => {
            const relKey = v.author_relationship as VouchRelationship
            const relLabel = labels[relKey] ?? v.author_relationship
            return (
              <Surface as="li" key={v.id} className="vouch-card">
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
              </Surface>
            )
          })}
        </ul>
      )}
      <aside className="surface share-testimonials__cta">
        <h3 className="share-testimonials__cta-title">{t.ctaTitle}</h3>
        <p className="share-testimonials__cta-body">{t.ctaBody}</p>
        <a className="share-testimonials__cta-link mono" href={vouchHref}>
          {t.ctaButton}
        </a>
      </aside>
    </section>
  )
}
