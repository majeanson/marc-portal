import { useEffect, useRef, useState } from 'react'
import type { Lang } from '../i18n'

type Outcome = 'loaded' | 'errored' | null

// Hard timeout: if the iframe never fires `load` (slow build, CSP block,
// 504, hung deploy), we surrender and let the OG image stay as the
// thumbnail. 5s matches the visitor's patience budget for an idle card.
const LOAD_TIMEOUT_MS = 5000

/**
 * Project-card thumbnail. Two-layer composition:
 *
 *  1. **Bottom layer** — the per-project OG card (PNG served from
 *     /og/share/:id). Loads instantly from the edge cache; gives every
 *     card a meaningful first paint regardless of build state.
 *  2. **Top layer** — the live deployed build, in an iframe scaled via CSS
 *     transform. Mounted only once the card scrolls within ~200px of the
 *     viewport (IntersectionObserver), and only when a build URL exists.
 *     Fades in on `load`; on error or 5s timeout, the bottom layer stays.
 *
 * The iframe renders at its natural desktop width (1280×800) and is scaled
 * down via CSS — we want the card to *look* like the deployed app, not a
 * mobile-narrow rendering of it.
 */
export function ProjectCardPreview({
  buildHref,
  title,
  sessionId,
  lang,
}: {
  buildHref: string | null
  title: string
  sessionId?: string
  lang?: Lang
}) {
  const ref = useRef<HTMLDivElement>(null)
  const hasIO = typeof IntersectionObserver !== 'undefined'
  const [visible, setVisible] = useState(!hasIO)
  const [outcome, setOutcome] = useState<Outcome>(null)

  // OG image lives on the same origin and is heavily edge-cached, so we
  // eager-load it on every card — small, predictable, no extra round trips
  // once the worker is warm.
  const ogSrc = sessionId ? `/og/share/${sessionId}${lang === 'en' ? '?lang=en' : ''}` : null

  useEffect(() => {
    if (!buildHref || !hasIO) return
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true)
            io.disconnect()
            return
          }
        }
      },
      { rootMargin: '200px 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [buildHref, hasIO])

  // Keep --preview-scale in sync with the card width. The iframe renders at
  // a fixed 1280×800 desktop size; CSS scales it by this value so it fills
  // the 16:10 box exactly at any card width (a fixed scale left a gap).
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const sync = () => el.style.setProperty('--preview-scale', String(el.clientWidth / 1280))
    sync()
    const ro = new ResizeObserver(sync)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (!visible || !buildHref) return
    const tid = window.setTimeout(() => {
      setOutcome((prev) => (prev === null ? 'errored' : prev))
    }, LOAD_TIMEOUT_MS)
    return () => window.clearTimeout(tid)
  }, [visible, buildHref])

  // No build *and* no sessionId: the legacy empty state. Cards in the
  // home/projects grids should always have a sessionId (we pass one
  // through now), so this is just a defensive fallback.
  if (!buildHref && !ogSrc) {
    return <div className="project-card__preview project-card__preview--empty" aria-hidden="true" />
  }

  const isLoading = visible && !!buildHref && outcome === null
  const isLoaded = outcome === 'loaded'
  const isErrored = outcome === 'errored' || !buildHref
  const state = isErrored ? 'errored' : isLoaded ? 'loaded' : isLoading ? 'loading' : 'idle'

  return (
    <div
      ref={ref}
      className={`project-card__preview project-card__preview--${state}`}
      aria-hidden="true"
    >
      {ogSrc && (
        <img
          className="project-card__preview-og"
          src={ogSrc}
          alt=""
          width={1200}
          height={630}
          loading="lazy"
          decoding="async"
        />
      )}
      {visible && buildHref && !isErrored && (
        <iframe
          className={`project-card__preview-frame${isLoaded ? ' is-loaded' : ''}`}
          src={buildHref}
          title={`${title} — aperçu`}
          loading="lazy"
          sandbox="allow-scripts allow-same-origin"
          tabIndex={-1}
          onLoad={() => setOutcome('loaded')}
          onError={() => setOutcome('errored')}
        />
      )}
    </div>
  )
}
