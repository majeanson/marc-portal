// Public vouches list (/vouches + /en/vouches). Renders approved + not-
// deleted vouches as a flat card list. Powered by GET /api/public/vouches,
// which already strips author_email from the projection — see
// PublicVouchRow in functions/_lib/vouches.ts.

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Footer } from '../components/Footer'
import { Header } from '../components/Header'
import { PageMast } from '../components/PageMast'
import { DICT, type Lang } from '../i18n'
import { cssVars } from '../lib/styleVars'
import { PAGE_FOLIOS } from '../lib/folios'
import { listPublicVouches, type PublicVouch, type VouchRelationship } from '../lib/vouchesApi'

export function Vouches({ lang }: { lang: Lang }) {
  const t = DICT[lang].vouches
  const langPrefix = lang === 'en' ? '/en' : ''
  const [vouches, setVouches] = useState<PublicVouch[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    document.title = `${t.pageTitle} — Marc`
  }, [t])

  useEffect(() => {
    let cancelled = false
    listPublicVouches()
      .then((r) => {
        if (cancelled) return
        setVouches(r.vouches)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <>
      <Header lang={lang} />
      <main id="main-content">
        <article className="section">
          <div className="section__inner">
            <PageMast
              folio={
                lang === 'fr'
                  ? `№ ${PAGE_FOLIOS.vouches} — témoignages`
                  : `№ ${PAGE_FOLIOS.vouches} — testimonials`
              }
              stampLabel={lang === 'fr' ? 'VOUCHÉ' : 'VOUCHED'}
              stampSub={lang === 'fr' ? 'PAR DES VRAIS' : 'BY REAL PEOPLE'}
            >
              <h1>{t.heading}</h1>
              <p>{t.lead}</p>
              <p>
                <Link to={`${langPrefix}/vouch`} className="hero__cta">
                  {t.submitCta}
                </Link>
              </p>
            </PageMast>

            <div className="vouches-list">
              {error && <p className="form__error">{DICT[lang].errorBoundary.body}</p>}
              {!error && vouches === null && (
                <p className="field__hint" aria-busy="true">
                  …
                </p>
              )}
              {vouches !== null && vouches.length === 0 && <p className="field__hint">{t.empty}</p>}
              {vouches !== null && vouches.length > 0 && (
                <ul className="vouches-list__items">
                  {vouches.map((v, i) => (
                    <VouchCard key={v.id} v={v} lang={lang} index={i} />
                  ))}
                </ul>
              )}
            </div>
          </div>
        </article>
      </main>
      <Footer lang={lang} />
    </>
  )
}

function VouchCard({ v, lang, index }: { v: PublicVouch; lang: Lang; index: number }) {
  const t = DICT[lang].vouches
  // Server stores the enum verbatim; the labels map is keyed by it. If a
  // future enum value lands without a label, fall back to the raw value
  // so the card still renders.
  const relKey = v.author_relationship as VouchRelationship
  const relLabel = t.relationshipLabels[relKey] ?? v.author_relationship
  // --i powers the staggered fade-in animation defined on .vouch-card —
  // CSS reads it via calc(var(--i) * 60ms) for animation-delay.
  return (
    <li className="vouch-card" style={cssVars({ '--i': index })}>
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
}
