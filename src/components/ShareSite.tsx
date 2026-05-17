import { useState } from 'react'
import type { Lang } from '../i18n'

/**
 * Share-this-site affordance for the home page. Uses the Web Share API
 * when available (mobile native share sheet, desktop Chrome/Edge), falls
 * back to clipboard copy on browsers without it (Firefox, older Safari).
 *
 * The shared URL carries the dynamic /og/home meta image — middleware
 * server-side rewrites the og:image tag for the home route, so any
 * scraper that fetches the URL gets the live card.
 *
 * Layout: editorial mini-card with a thumbnail of /og/home on the left
 * and the action on the right. Distinct enough to read as a standalone
 * "this is your social-share" surface, quiet enough not to compete with
 * the main CTAs.
 */

const COPY = {
  fr: {
    eyebrow: 'partage',
    title: 'Partage marc.portal',
    body: 'Si tu connais quelqu’un qui a un petit problème logiciel à régler, mon site fait son propre pitch. Voilà à quoi ça ressemble dans Slack, iMessage, etc.',
    shareBtn: 'Partager',
    sharing: 'Ouverture…',
    copied: 'Lien copié ✓',
    previewBtn: 'Voir la carte ↗',
    previewAlt: 'Aperçu de la carte sociale dynamique de marc.portal',
    nativeText:
      'Marc — dev québécois. Le soir, j’aide à régler des petits problèmes du quotidien avec du code.',
  },
  en: {
    eyebrow: 'share',
    title: 'Share marc.portal',
    body: 'If you know someone with a small software problem worth fixing, the site pitches itself. Here’s what the Slack/iMessage unfurl looks like.',
    shareBtn: 'Share',
    sharing: 'Opening…',
    copied: 'Link copied ✓',
    previewBtn: 'View card ↗',
    previewAlt: 'Preview of marc.portal’s dynamic social card',
    nativeText: 'Marc — Québécois dev. Evenings, I help solve everyday problems with code.',
  },
} as const

type ShareState = 'idle' | 'sharing' | 'copied'

export function ShareSite({ lang }: { lang: Lang }) {
  const t = COPY[lang]
  const [state, setState] = useState<ShareState>('idle')

  // Same-language home URL. We resolve at click-time (not render-time)
  // so SSR/snapshot tests don't pin a server-side window.location.
  function shareUrl(): string {
    if (typeof window === 'undefined') return lang === 'en' ? '/en' : '/'
    return `${window.location.origin}${lang === 'en' ? '/en' : '/'}`
  }
  const ogPreview = `/og/home${lang === 'en' ? '?lang=en' : ''}`

  async function onShare() {
    const url = shareUrl()
    const data: ShareData = { title: 'marc.portal', text: t.nativeText, url }
    setState('sharing')

    // navigator.share is the gold path — opens the OS share sheet on
    // mobile, the browser's share UI on Chrome/Edge desktop. Some
    // browsers surface canShare(); when present we use it to avoid
    // calling share() with unsupported fields.
    const nav = typeof navigator !== 'undefined' ? navigator : null
    if (nav?.share && (!nav.canShare || nav.canShare(data))) {
      try {
        await nav.share(data)
        setState('idle')
        return
      } catch (err) {
        // User dismissed the sheet (AbortError) — silent. Anything else
        // falls through to clipboard so the action isn't a dead-end.
        if (err instanceof Error && err.name === 'AbortError') {
          setState('idle')
          return
        }
      }
    }

    // Fallback: clipboard copy. Show a transient "copied" affordance so
    // the visitor knows the click did something even without a sheet.
    try {
      await navigator.clipboard.writeText(url)
      setState('copied')
      setTimeout(() => setState('idle'), 2200)
    } catch {
      setState('idle')
    }
  }

  const buttonLabel = state === 'sharing' ? t.sharing : state === 'copied' ? t.copied : t.shareBtn

  return (
    <section className="section section--editorial section--share" id="share">
      <div className="section__inner share-site">
        <a
          className="share-site__preview"
          href={ogPreview}
          target="_blank"
          rel="noreferrer"
          aria-label={t.previewAlt}
        >
          <img
            src={ogPreview}
            alt={t.previewAlt}
            width={1200}
            height={630}
            loading="lazy"
            className="share-site__preview-img"
          />
        </a>
        <div className="share-site__copy">
          <div className="section__eyebrow">{t.eyebrow}</div>
          <h2 className="share-site__title">{t.title}</h2>
          <p className="share-site__body">{t.body}</p>
          <div className="share-site__actions">
            <button
              type="button"
              className="hero__cta share-site__btn"
              onClick={onShare}
              disabled={state === 'sharing'}
            >
              {buttonLabel}
            </button>
            <a
              className="link-btn mono share-site__preview-link"
              href={ogPreview}
              target="_blank"
              rel="noreferrer"
            >
              {t.previewBtn}
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
