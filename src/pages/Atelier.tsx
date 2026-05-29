/**
 * /atelier (FR canonical) + /en/atelier — "L'atelier" / "The workshop".
 *
 * One page, two exhibits, built to reward both a non-technical skim and a
 * deep technical read:
 *
 *  A. The visual language — the portal's OWN design system shown as an
 *     exhibit: the seven feature glyphs (each a live link into the /carte
 *     atlas), the colour tokens, the type scale. Proves design intent.
 *  B. The Atelier Gallery — the committed Playwright visual-regression
 *     baselines (e2e/__screenshots__/) surfaced publicly: every screen,
 *     every viewport, every theme, verified automatically on every commit.
 *     Each capture opens an inspector — switch viewport, step through the
 *     set, jump to the live page. Proves design range AND testing rigor.
 *
 * The gallery manifest (src/data/atelier-gallery.json) is generated at
 * prebuild by scripts/build-atelier-gallery.mjs — no runtime API call. The
 * thumbnails it references live in public/atelier/ (a build artifact); a
 * fresh clone must run a build (or that script) before they appear.
 *
 * This page is deliberately excluded from the screenshot suite — it embeds
 * a thumbnail of every other baseline, so capturing it would recurse the
 * whole corpus into one image (see e2e/routes.ts).
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Lang } from '../i18n'
import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import { PageMast } from '../components/PageMast'
import { FeatureContinue } from '../components/FeatureContinue'
import { FeatureGlyph } from '../lib/featureGlyphs'
import { FEATURE_IDS, FEATURES, type FeatureId } from '../lib/features'
import { PAGE_FOLIOS } from '../lib/folios'
import galleryData from '../data/atelier-gallery.json'

interface GalleryViewport {
  id: string
  label: { fr: string; en: string }
  width: number
  height: number
  theme?: string
}

interface GalleryShot {
  slug: string
  viewport: string
  route: string
  component: string
  lang: string
  variant: string | null
  label: { fr: string; en: string }
  thumb: string
  full: string
  thumbW: number
  thumbH: number
  fullH: number
  cropped: boolean
}

interface Gallery {
  viewports: GalleryViewport[]
  shots: GalleryShot[]
  count: number
}

const gallery = galleryData as unknown as Gallery

/** A shot's stable identity — viewport + slug. Used as the React key and as
 *  the `#shot=` deep-link fragment. Viewport has no slash, slug has none, so
 *  a single '/' separator round-trips cleanly. */
const shotKey = (s: GalleryShot) => `${s.viewport}/${s.slug}`

/** Resolve a `#shot=<viewport>/<slug>` fragment to a shot, for shareable
 *  deep links. Read once at mount via the useState initializers. */
function shotFromHash(): GalleryShot | null {
  if (typeof window === 'undefined' || !window.location.hash.startsWith('#shot=')) return null
  const key = decodeURIComponent(window.location.hash.slice('#shot='.length))
  return gallery.shots.find((s) => shotKey(s) === key) ?? null
}

/** Core paper-and-ink tokens, shown as live swatches. The feature accents
 *  are exhibited inside the glyph cards instead. */
const CORE_TOKENS: { token: string; role: { fr: string; en: string } }[] = [
  { token: '--bg', role: { fr: 'Papier', en: 'Paper' } },
  { token: '--bg-section', role: { fr: 'Papier doux', en: 'Paper soft' } },
  { token: '--bg-card', role: { fr: 'Papier chaud', en: 'Paper warm' } },
  { token: '--border', role: { fr: 'Filet', en: 'Rule' } },
  { token: '--text', role: { fr: 'Encre', en: 'Ink' } },
  { token: '--text-mid', role: { fr: 'Encre douce', en: 'Ink soft' } },
  { token: '--text-soft', role: { fr: 'Encre pâle', en: 'Ink muted' } },
  { token: '--accent', role: { fr: 'Sauge', en: 'Sage' } },
  { token: '--accent-warm', role: { fr: 'Sauge profond', en: 'Deep sage' } },
  { token: '--warm', role: { fr: 'Terracotta', en: 'Terracotta' } },
  { token: '--cool', role: { fr: 'Bleu poussière', en: 'Dusty blue' } },
]

const ALL_TOKENS = [...CORE_TOKENS.map((t) => t.token), ...FEATURE_IDS.map((id) => `--feat-${id}`)]

const COPY = {
  fr: {
    pageTitle: "L'atelier — Marc",
    metaDescription:
      "L'atelier : le système visuel du portail marc.portal, et chaque écran du site vérifié automatiquement à chaque commit.",
    backHome: "← Retour à l'accueil",
    eyebrow: "méta · l'établi, montré tel quel",
    title: "L'atelier",
    lead: "Un site se juge à deux choses : le soin du dessin, et la rigueur qui le tient en place. Cette page montre les deux, à découvert. D'abord le langage visuel — les pièces dont le portail est fait. Ensuite la galerie — chaque écran du site, capturé et vérifié automatiquement à chaque changement de code.",
    lead2:
      "Rien d'inventé pour la vitrine : ce sont les vrais glyphes, les vrais jetons de couleur, les vraies captures de test. L'atelier, porte ouverte.",
    langTitle: 'Le langage visuel',
    langLead:
      'Sept fonctionnalités, sept couleurs, sept pictogrammes. La couleur dit à un visiteur qui revient « ça appartient au groupe tarif » ; le glyphe le dit à un visiteur qui arrive pour la première fois. Clique un glyphe pour suivre sa couleur sur la carte du site.',
    glyphsHeading: 'Les glyphes',
    glyphFilterAria: (label: string) => `Filtrer la carte du site sur « ${label} »`,
    paletteHeading: 'Le papier et l’encre',
    paletteNote:
      'Onze jetons portent tout le chrome du site. Les valeurs ci-dessous sont lues en direct — bascule le thème et elles suivent.',
    typoHeading: 'La typographie',
    typo: [
      { role: 'L’affichage', token: '--display', sample: 'Libre Franklin' },
      { role: 'Le texte', token: '--sans', sample: 'Source Serif 4' },
      { role: 'Le mono', token: '--mono', sample: 'JetBrains Mono' },
    ],
    galleryTitle: 'La galerie',
    galleryLead:
      "Chaque écran public du site, à chaque format, dans les deux thèmes. Ces images ne sont pas des maquettes : ce sont les captures de référence des tests visuels. Si un pixel bouge sans qu'on l'ait voulu, l'intégration continue le bloque avant la mise en ligne.",
    statCaptures: 'captures',
    statScreens: 'écrans publics',
    statFormats: 'formats',
    filterLabel: 'Filtrer par format',
    countLabel: (n: number, vp: string) => `${n} écran${n === 1 ? '' : 's'} · ${vp}`,
    maskLegend:
      'Les bandes magenta sont voulues : le test masque le contenu qui change à chaque exécution — un hash de build, une horloge — pour ne comparer que ce qui doit rester stable.',
    croppedHint: 'haut de page — clique pour la voir entière',
    fullHint: 'clique pour agrandir',
    variantLabel: { empty: 'état vide', error: 'état d’erreur' } as Record<string, string>,
    lightboxClose: 'Fermer',
    lightboxPrev: 'Écran précédent',
    lightboxNext: 'Écran suivant',
    lightboxViewports: 'Voir à un autre format',
    lightboxOpen: 'Ouvrir cette page →',
    lightboxHeight: (px: number) => `page complète · ${px.toLocaleString('fr-CA')} px de haut`,
    galleryEmpty:
      'La galerie est vide — lance une compilation (npm run build) pour générer les vignettes.',
    glyphs: {
      intake: 'Un dossier — ce que tu apportes.',
      conversation: "Une bulle — l'échange asynchrone.",
      iterative: 'Un œil — tu vois chaque build.',
      pricing: "Un dollar — la couleur qui parle d'argent.",
      keys: "Une clé — le code t'appartient.",
      shipped: 'Un crochet — livré, terminé.',
      meta: 'Un engrenage — les coulisses.',
    } as Record<FeatureId, string>,
  },
  en: {
    pageTitle: 'The workshop — Marc',
    metaDescription:
      'The workshop: the visual system behind marc.portal, and every screen of the site verified automatically on every commit.',
    backHome: '← Back home',
    eyebrow: 'meta · the workbench, shown as-is',
    title: 'The workshop',
    lead: 'A site is judged on two things: the care in the drawing, and the rigor that holds it in place. This page shows both, out in the open. First the visual language — the parts the portal is made of. Then the gallery — every screen of the site, captured and checked automatically on every code change.',
    lead2:
      'Nothing staged for the showroom: these are the real glyphs, the real colour tokens, the real test captures. The workshop, door open.',
    langTitle: 'The visual language',
    langLead:
      'Seven features, seven colours, seven pictograms. Colour tells a returning visitor "this belongs to the pricing cluster"; the glyph tells a first-time visitor which cluster it is. Click a glyph to follow its colour onto the site map.',
    glyphsHeading: 'The glyphs',
    glyphFilterAria: (label: string) => `Filter the site map to "${label}"`,
    paletteHeading: 'Paper and ink',
    paletteNote:
      'Eleven tokens carry the whole site chrome. The values below are read live — flip the theme and they follow.',
    typoHeading: 'The typography',
    typo: [
      { role: 'Display', token: '--display', sample: 'Libre Franklin' },
      { role: 'Body', token: '--sans', sample: 'Source Serif 4' },
      { role: 'Mono', token: '--mono', sample: 'JetBrains Mono' },
    ],
    galleryTitle: 'The gallery',
    galleryLead:
      "Every public screen of the site, at every size, in both themes. These images aren't mockups: they're the reference captures of the visual-regression tests. If a pixel moves without intent, continuous integration blocks it before it ships.",
    statCaptures: 'captures',
    statScreens: 'public screens',
    statFormats: 'formats',
    filterLabel: 'Filter by size',
    countLabel: (n: number, vp: string) => `${n} screen${n === 1 ? '' : 's'} · ${vp}`,
    maskLegend:
      'The magenta bands are intentional: the test masks content that changes on every run — a build hash, a clock — so it only compares what should stay stable.',
    croppedHint: 'page top — click to see the whole thing',
    fullHint: 'click to enlarge',
    variantLabel: { empty: 'empty state', error: 'error state' } as Record<string, string>,
    lightboxClose: 'Close',
    lightboxPrev: 'Previous screen',
    lightboxNext: 'Next screen',
    lightboxViewports: 'See at another size',
    lightboxOpen: 'Open this page →',
    lightboxHeight: (px: number) => `full page · ${px.toLocaleString('en-CA')} px tall`,
    galleryEmpty: 'The gallery is empty — run a build (npm run build) to generate the thumbnails.',
    glyphs: {
      intake: 'A folder — what you arrive with.',
      conversation: 'A speech bubble — the async back-and-forth.',
      iterative: 'An eye — you see every build.',
      pricing: 'A dollar sign — the colour that talks money.',
      keys: 'A key — you own the code.',
      shipped: 'A check mark — shipped, done.',
      meta: 'A gear — the backstage layer.',
    } as Record<FeatureId, string>,
  },
} as const

export function Atelier({ lang }: { lang: Lang }) {
  const t = COPY[lang]

  useEffect(() => {
    document.documentElement.lang = lang === 'fr' ? 'fr-CA' : 'en-CA'
    document.title = t.pageTitle
    const meta = document.querySelector('meta[name="description"]')
    if (meta) meta.setAttribute('content', t.metaDescription)
  }, [lang, t])

  // Live token values — read from the cascade so the swatches show the
  // ACTIVE theme's honest hex, and re-read when the theme toggle flips
  // data-theme on <html>.
  const [hexes, setHexes] = useState<Record<string, string>>({})
  useEffect(() => {
    const read = () => {
      const cs = getComputedStyle(document.documentElement)
      const out: Record<string, string> = {}
      for (const token of ALL_TOKENS) out[token] = cs.getPropertyValue(token).trim()
      setHexes(out)
    }
    read()
    const obs = new MutationObserver(read)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])

  // Gallery filter — one viewport at a time keeps the grid scannable and the
  // image count sane. A #shot= deep link wins; else the wide desktop capture.
  const viewportIds = gallery.viewports.map((v) => v.id)
  const [vp, setVp] = useState<string>(() => {
    const linked = shotFromHash()
    if (linked) return linked.viewport
    return viewportIds.includes('wide') ? 'wide' : (viewportIds[0] ?? '')
  })
  const shots = useMemo(() => gallery.shots.filter((s) => s.viewport === vp), [vp])
  const activeViewport = gallery.viewports.find((v) => v.id === vp)

  // Headline figures — captures, distinct public routes, viewports.
  const screenCount = useMemo(() => new Set(gallery.shots.map((s) => s.route)).size, [])

  // ─── Lightbox / inspector ──────────────────────────────────────────────
  // Native <dialog> gives focus-trapping, Esc-to-close and focus-return for
  // free. The inspector adds: viewport switching, prev/next, a live-page
  // link, and a #shot= deep link.
  const dialogRef = useRef<HTMLDialogElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  // Opens straight to a capture when the URL carries a #shot= deep link.
  const [active, setActive] = useState<GalleryShot | null>(() => shotFromHash())

  const activeIndex = active
    ? shots.findIndex((s) => s.slug === active.slug && s.viewport === active.viewport)
    : -1
  const prevShot = activeIndex > 0 ? shots[activeIndex - 1] : null
  const nextShot =
    activeIndex >= 0 && activeIndex < shots.length - 1 ? shots[activeIndex + 1] : null
  // The same page captured at the other viewports — powers the inspector's
  // "see at another size" switcher.
  const siblingShots = useMemo(() => {
    if (!active) return []
    const rank = (id: string) => gallery.viewports.findIndex((v) => v.id === id)
    return gallery.shots
      .filter((s) => s.slug === active.slug)
      .sort((a, b) => rank(a.viewport) - rank(b.viewport))
  }, [active])

  // Navigate the inspector. Keeps the grid filter in sync with the shown
  // shot, and mirrors the selection into the URL so a capture is shareable.
  const showShot = (shot: GalleryShot) => {
    setVp(shot.viewport)
    setActive(shot)
    history.replaceState(null, '', `#shot=${shotKey(shot)}`)
  }

  // Open the dialog whenever a shot becomes active.
  useEffect(() => {
    const dlg = dialogRef.current
    if (dlg && active && !dlg.open) dlg.showModal()
  }, [active])

  // Reset the scroll position when the shown capture changes — otherwise the
  // tall previous page leaves the next one scrolled half-way down.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0
  }, [active])

  // Backdrop click closes. Attached imperatively (not as a JSX onClick on
  // <dialog>) so it doesn't trip jsx-a11y's non-interactive-element rule —
  // Esc and the close button already cover the keyboard.
  useEffect(() => {
    const dlg = dialogRef.current
    if (!dlg) return
    const onBackdrop = (e: MouseEvent) => {
      if (e.target === dlg) dlg.close()
    }
    dlg.addEventListener('click', onBackdrop)
    return () => dlg.removeEventListener('click', onBackdrop)
  }, [])

  // ←/→ step through the current viewport's captures while the inspector
  // is open.
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && prevShot) {
        e.preventDefault()
        showShot(prevShot)
      } else if (e.key === 'ArrowRight' && nextShot) {
        e.preventDefault()
        showShot(nextShot)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [active, prevShot, nextShot])

  const closeLightbox = () => {
    setActive(null)
    if (location.hash.startsWith('#shot=')) {
      history.replaceState(null, '', location.pathname + location.search)
    }
  }

  return (
    <div className="app">
      <Header lang={lang} />
      <main id="main-content">
        <article className="section">
          <div className="section__inner privacy atelier-page">
            <PageMast
              folio={`№ ${PAGE_FOLIOS.atelier} — ${t.title.toLowerCase()}`}
              stampLabel="ATELIER"
              stampSub={lang === 'fr' ? 'DESIGN · SYSTÈME' : 'DESIGN · SYSTEM'}
              feature="meta"
              lang={lang}
              back={{ href: lang === 'fr' ? '/' : '/en', label: t.backHome }}
            >
              <div className="section__eyebrow">{t.eyebrow}</div>
              <h1 className="page-mast__title">{t.title}</h1>
              <p className="privacy__intro">{t.lead}</p>
              <p className="privacy__intro">{t.lead2}</p>
            </PageMast>

            {/* ─── Section A — the visual language ─────────────────────── */}
            <section className="atelier-lang" aria-labelledby="atelier-lang-h">
              <h2 id="atelier-lang-h">{t.langTitle}</h2>
              <p className="atelier-section__lead">{t.langLead}</p>

              <h3 className="atelier-sub">{t.glyphsHeading}</h3>
              <ul className="atelier-glyphs">
                {FEATURE_IDS.map((id) => (
                  <li key={id} className="atelier-glyph" data-feature={id}>
                    <Link
                      className="surface atelier-glyph__link"
                      to={lang === 'fr' ? `/carte?feature=${id}` : `/en/map?feature=${id}`}
                      aria-label={t.glyphFilterAria(FEATURES[id].label[lang])}
                    >
                      <span className="atelier-glyph__tile">
                        <FeatureGlyph feature={id} />
                      </span>
                      <span className="atelier-glyph__name">{FEATURES[id].label[lang]}</span>
                      <span className="atelier-glyph__metaphor">{t.glyphs[id]}</span>
                      <span className="atelier-glyph__hue mono">
                        {FEATURES[id].hue} · {hexes[`--feat-${id}`] || `var(--feat-${id})`}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>

              <h3 className="atelier-sub">{t.paletteHeading}</h3>
              <p className="atelier-section__lead">{t.paletteNote}</p>
              <ul className="atelier-swatches">
                {CORE_TOKENS.map(({ token, role }) => (
                  <li key={token} className="surface atelier-swatch">
                    <span
                      className="atelier-swatch__chip"
                      style={{ background: `var(${token})` }}
                      aria-hidden="true"
                    />
                    <span className="atelier-swatch__role">{role[lang]}</span>
                    <span className="atelier-swatch__token mono">{token}</span>
                    <span className="atelier-swatch__hex mono">{hexes[token] || '—'}</span>
                  </li>
                ))}
              </ul>

              <h3 className="atelier-sub">{t.typoHeading}</h3>
              <ul className="atelier-type">
                {t.typo.map((spec) => (
                  <li key={spec.token} className="atelier-type__row">
                    <span
                      className="atelier-type__sample"
                      style={{ fontFamily: `var(${spec.token})` }}
                    >
                      {spec.sample}
                    </span>
                    <span className="atelier-type__role">{spec.role}</span>
                    <span className="atelier-type__token mono">{spec.token}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* ─── Section B — the gallery ─────────────────────────────── */}
            <section className="atelier-gallery" aria-labelledby="atelier-gallery-h">
              <h2 id="atelier-gallery-h">{t.galleryTitle}</h2>
              <p className="atelier-section__lead">{t.galleryLead}</p>

              {gallery.count === 0 ? (
                <p className="atelier-gallery__empty mono">{t.galleryEmpty}</p>
              ) : (
                <>
                  <ul className="atelier-stats">
                    <li className="atelier-stat">
                      <span className="atelier-stat__num">{gallery.count}</span>
                      <span className="atelier-stat__label">{t.statCaptures}</span>
                    </li>
                    <li className="atelier-stat">
                      <span className="atelier-stat__num">{screenCount}</span>
                      <span className="atelier-stat__label">{t.statScreens}</span>
                    </li>
                    <li className="atelier-stat">
                      <span className="atelier-stat__num">{gallery.viewports.length}</span>
                      <span className="atelier-stat__label">{t.statFormats}</span>
                    </li>
                  </ul>

                  <div className="atelier-filters" role="group" aria-label={t.filterLabel}>
                    {gallery.viewports.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        className="atelier-filter mono"
                        aria-pressed={v.id === vp}
                        onClick={() => setVp(v.id)}
                      >
                        {v.label[lang]}
                        <span className="atelier-filter__dim">
                          {v.width}×{v.height}
                        </span>
                      </button>
                    ))}
                  </div>

                  <p className="atelier-gallery__count mono">
                    {t.countLabel(shots.length, activeViewport?.label[lang] ?? vp)}
                  </p>

                  <p className="atelier-gallery__legend">
                    <span className="atelier-gallery__mask-chip" aria-hidden="true" />
                    {t.maskLegend}
                  </p>

                  <ul className="atelier-grid">
                    {shots.map((shot) => (
                      <li
                        key={shotKey(shot)}
                        className="atelier-shot"
                        data-variant={shot.variant ?? undefined}
                      >
                        <button
                          type="button"
                          className="surface atelier-shot__btn"
                          onClick={() => showShot(shot)}
                        >
                          <img
                            className="atelier-shot__img"
                            src={shot.thumb}
                            alt={`${shot.label[lang]} — ${activeViewport?.label[lang] ?? vp}`}
                            loading="lazy"
                            decoding="async"
                            width={shot.thumbW}
                            height={shot.thumbH}
                          />
                          <span className="atelier-shot__caption">
                            <span className="atelier-shot__label">
                              {shot.label[lang]}
                              {shot.variant && (
                                <span className="atelier-shot__variant mono">
                                  {t.variantLabel[shot.variant]}
                                </span>
                              )}
                            </span>
                            <span className="atelier-shot__route mono">{shot.route}</span>
                            <span className="atelier-shot__hint mono">
                              {shot.cropped ? t.croppedHint : t.fullHint}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          </div>
        </article>
      </main>

      {/* Inspector — full-resolution capture, viewport switcher, prev/next,
          live-page link. The full PNG loads only when a shot is open. */}
      <dialog
        ref={dialogRef}
        className="atelier-lightbox"
        aria-label={active ? active.label[lang] : t.galleryTitle}
        onClose={closeLightbox}
      >
        {active && (
          <div className="surface atelier-lightbox__inner">
            <div className="atelier-lightbox__bar">
              <span className="atelier-lightbox__title">
                {active.label[lang]}
                {active.variant && (
                  <span className="atelier-lightbox__variant mono">
                    {t.variantLabel[active.variant]}
                  </span>
                )}
                <span className="atelier-lightbox__meta mono">
                  {active.route} · {t.lightboxHeight(active.fullH)}
                </span>
              </span>
              <button
                type="button"
                className="atelier-lightbox__close mono"
                onClick={() => dialogRef.current?.close()}
              >
                {t.lightboxClose} ✕
              </button>
            </div>

            <div className="atelier-lightbox__controls">
              <div className="atelier-lightbox__nav">
                <button
                  type="button"
                  className="atelier-lightbox__step mono"
                  onClick={() => prevShot && showShot(prevShot)}
                  disabled={!prevShot}
                  aria-label={t.lightboxPrev}
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="atelier-lightbox__step mono"
                  onClick={() => nextShot && showShot(nextShot)}
                  disabled={!nextShot}
                  aria-label={t.lightboxNext}
                >
                  ›
                </button>
              </div>
              <div className="atelier-lightbox__vps" role="group" aria-label={t.lightboxViewports}>
                {siblingShots.map((s) => {
                  const v = gallery.viewports.find((vp2) => vp2.id === s.viewport)
                  return (
                    <button
                      key={s.viewport}
                      type="button"
                      className="atelier-lightbox__vp mono"
                      aria-pressed={s.viewport === active.viewport}
                      onClick={() => showShot(s)}
                    >
                      {v?.label[lang] ?? s.viewport}
                    </button>
                  )
                })}
              </div>
              <Link className="atelier-lightbox__open mono" to={active.route}>
                {t.lightboxOpen}
              </Link>
            </div>

            <div className="atelier-lightbox__scroll" ref={scrollRef}>
              <img src={active.full} alt={active.label[lang]} decoding="async" />
            </div>
          </div>
        )}
      </dialog>

      <FeatureContinue page="page.atelier" lang={lang} />
      <Footer lang={lang} />
    </div>
  )
}
