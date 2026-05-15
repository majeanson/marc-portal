import { useEffect, useRef, useState } from 'react'

type Outcome = 'loaded' | 'errored' | null

// Hard timeout: if the iframe never fires `load` (slow build, CSP block,
// 504, hung deploy), we surrender after this and show the gradient
// placeholder. 5s matches the visitor's patience budget for a thumbnail.
const LOAD_TIMEOUT_MS = 5000

/**
 * Tiny live thumbnail of a deployed build, rendered inside a project card.
 *
 * State machine — driven by two values:
 * - `visible`: IntersectionObserver gate. Stays false until the card is
 *   ~200px from the viewport, then flips true once and never back.
 * - `outcome`: null while loading, then `loaded` (onLoad) or `errored`
 *   (onError, or 5s without onLoad). Once set, sticky.
 *
 * Rendering follows directly:
 * - !visible → empty box (skeleton shimmer optional, but the IO gate keeps
 *   us off-screen so it's not visible anyway).
 * - visible && outcome === null → iframe in DOM (loading), shimmer overlay.
 * - visible && outcome === 'loaded' → iframe fades in, shimmer gone.
 * - visible && outcome === 'errored' → iframe unmounted, gradient fallback.
 *
 * The iframe renders at its natural desktop width (1280×800) and is scaled
 * down via CSS transform. That's deliberate: we want the card to *look*
 * like the deployed app, not a mobile-narrow rendering of it.
 */
export function ProjectCardPreview({
  buildHref,
  title,
}: {
  buildHref: string | null
  title: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  // Browsers without IntersectionObserver skip the lazy gate and mount the
  // iframe right away — they're old enough that "perf" isn't the priority.
  const hasIO = typeof IntersectionObserver !== 'undefined'
  const [visible, setVisible] = useState(!hasIO)
  const [outcome, setOutcome] = useState<Outcome>(null)

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

  // Once the iframe is in the DOM, arm a timeout. If `onLoad` doesn't fire
  // within 5s, we declare it errored. onLoad / onError clear the timeout
  // by setting outcome, which short-circuits the setter inside.
  useEffect(() => {
    if (!visible || !buildHref) return
    const tid = window.setTimeout(() => {
      setOutcome((prev) => (prev === null ? 'errored' : prev))
    }, LOAD_TIMEOUT_MS)
    return () => window.clearTimeout(tid)
  }, [visible, buildHref])

  if (!buildHref) {
    return <div className="project-card__preview project-card__preview--empty" aria-hidden="true" />
  }

  const isLoading = visible && outcome === null
  const isLoaded = outcome === 'loaded'
  const isErrored = outcome === 'errored'
  const state = isErrored ? 'errored' : isLoaded ? 'loaded' : isLoading ? 'loading' : 'idle'

  return (
    <div
      ref={ref}
      className={`project-card__preview project-card__preview--${state}`}
      aria-hidden="true"
    >
      {visible && !isErrored && (
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
      {isLoading && <div className="project-card__preview-skeleton" aria-hidden="true" />}
      {isErrored && <div className="project-card__preview-fallback" aria-hidden="true" />}
    </div>
  )
}
