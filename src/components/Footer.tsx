import { useState, type MouseEvent } from 'react'
import type { Lang } from '../i18n'
import { DICT } from '../i18n'
import { useLangSwitch } from '../lib/useLangSwitch'
import { FeatureDot } from './FeatureDot'
import { StudioSign } from './StudioSign'
import { PAGE_FEATURE } from '../lib/features'

function formatBuildDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  // Format in Quebec time, fixed — NOT the visitor's local timezone. The
  // build date is a fact about the deploy, not a visitor-relative value, so a
  // fixed zone keeps the prerendered snapshot and the re-rendered page showing
  // one stable string instead of flashing from the build machine's zone to the
  // visitor's.
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d)
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '00'
  return `${part('year')}-${part('month')}-${part('day')} ${part('hour')}:${part('minute')}`
}

export function Footer({ lang }: { lang: Lang }) {
  const t = DICT[lang].footer
  const buildDate = formatBuildDate(__COMMIT_DATE__)
  // Share affordance, collapsed into the footer per R3 design pass: the
  // standalone ShareSite section above the footer was a CTA stacked on the
  // final CTA, and the lower-energy "share" action was getting the louder
  // visual treatment. Footer line keeps the affordance reachable without
  // competing with the primary "describe your problem" click.
  const [shareCopied, setShareCopied] = useState(false)
  async function onShare(e: MouseEvent) {
    e.preventDefault()
    const url =
      typeof window !== 'undefined'
        ? `${window.location.origin}${lang === 'en' ? '/en' : '/'}`
        : lang === 'en'
          ? '/en'
          : '/'
    const nativeText =
      lang === 'fr'
        ? 'Marc — dev québécois. Le soir, j’aide à régler des petits problèmes du quotidien avec du code.'
        : 'Marc — Québécois dev. Evenings, I help solve everyday problems with code.'
    const data: ShareData = { title: 'marc.portal', text: nativeText, url }
    const nav = typeof navigator !== 'undefined' ? navigator : null
    if (nav?.share && (!nav.canShare || nav.canShare(data))) {
      try {
        await nav.share(data)
        return
      } catch (err) {
        // User-dismissed sheet (AbortError): silent. Other errors fall
        // through to clipboard so the link still goes somewhere.
        if (err instanceof Error && err.name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 2200)
    } catch {
      /* clipboard blocked (file://, perm policy, etc.) — no-op, the link
         is right there in the URL bar */
    }
  }
  const { frHref, enHref, onLangSwitch } = useLangSwitch(lang)
  const otherLangHref = lang === 'fr' ? enHref : frHref
  const otherLangCode = lang === 'fr' ? 'en' : 'fr'
  const otherLangLabel = lang === 'fr' ? 'EN' : 'FR'
  // The footer keeps exactly one navigational link — the site map. It's the
  // atlas every other surface (privacy, PIA, handoff, meta, vouches, passage)
  // is reachable from, grouped + categorised there. Listing all of them in the
  // footer too was redundant chrome; the map is the single entry point.
  const mapHref = lang === 'fr' ? '/carte' : '/en/map'
  const mapLabel = lang === 'fr' ? 'Carte du site' : 'Site map'
  const intakeHref = lang === 'fr' ? '/intake' : '/en/intake'
  return (
    <footer className="site-footer">
      <div className="site-footer__flourish" aria-hidden="true" />
      <div className="site-footer__inner">
        <StudioSign lang={lang} />
        {/* "Contact" routes to the session intake, not a mailbox — a started
            session is the only channel Marc reads. The link carries the
            sentence so the reader can't miss where to go. */}
        <p className="site-footer__line">
          {t.contact.pre}
          <a href={intakeHref} className="site-footer__contact-link">
            {t.contact.link}
          </a>
          {t.contact.post}
        </p>
        <p className="site-footer__line site-footer__share-line mono">
          {t.share.pre}{' '}
          <a
            href={lang === 'fr' ? '/' : '/en'}
            onClick={onShare}
            className="site-footer__share-link"
            aria-live="polite"
          >
            {shareCopied ? t.share.copied : `→ ${t.share.copy}`}
          </a>
        </p>
        <p className="site-footer__line site-footer__pages">
          <span className="site-footer__pages-eyebrow">{t.legal}</span>
          {/* One link only: the site map. Its feature dot is a shortcut to
              /carte?feature=X — the colour you see in the footer is the colour
              you find in the atlas. Every other page (privacy, PIA, handoff,
              meta, vouches, passage) is categorised inside the map. */}
          <span className="site-footer__page">
            <FeatureDot feature={PAGE_FEATURE['page.map-page']} lang={lang} />
            <a href={mapHref}>{mapLabel}</a>
          </span>
        </p>
        <p className="site-footer__line site-footer__line--meta">
          <span>{t.copyright}</span>
          <span className="site-footer__dot" aria-hidden="true">
            ·
          </span>
          <span
            className="site-footer__build"
            title={`commit ${__COMMIT_HASH__} · ${__COMMIT_DATE__}`}
          >
            build {buildDate} · {__COMMIT_HASH__}
          </span>
          <span className="site-footer__dot" aria-hidden="true">
            ·
          </span>
          {/* Lang-switch sits on the meta line now — a hand-drawn arrow, not a
              plain link. Reuses useLangSwitch so it sets the same mp_lang
              cookie + View-Transition the header switch uses. */}
          <a
            href={otherLangHref}
            onClick={(e) => onLangSwitch(e, otherLangCode)}
            className="site-footer__lang"
            aria-label={lang === 'fr' ? 'Read this site in English' : 'Lire ce site en français'}
          >
            <svg
              className="site-footer__lang-arrow"
              viewBox="0 0 60 18"
              aria-hidden="true"
              focusable="false"
            >
              <path
                d="M 4 9 Q 18 6 32 10 Q 42 12 52 9"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
              <path
                d="M 46 4 L 54 9 L 46 14"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="site-footer__lang-label mono">{otherLangLabel}</span>
          </a>
        </p>
      </div>
    </footer>
  )
}
