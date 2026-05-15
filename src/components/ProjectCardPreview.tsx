import { useEffect, useRef, useState } from 'react'

type State = 'idle' | 'loading' | 'loaded' | 'errored'

// Hard timeout: if the iframe never fires `load` (slow build, CSP block,
// 504, hung deploy), we surrender after this and show the gradient
// placeholder. 5s matches the visitor's patience budget for a thumbnail.
const LOAD_TIMEOUT_MS = 5000

/**
 * Tiny live thumbnail of a deployed build, rendered inside a project card.
 *
 * Mounting flow:
 * - `idle` while the card is off-screen (IntersectionObserver gate).
 * - On intersect → `loading` (iframe mounted, shimmer overlay visible).
 * - `onLoad` → `loaded` (shimmer fades).
 * - `onError` or 5s timeout → `errored` (iframe hidden, gradient placeholder
 *   takes the slot so the card height stays stable).
 *
 * The iframe renders at its natural desktop width (1280×800) and is scaled
 * down via CSS transform. That's deliberate: we want the card to *look* like
 * the deployed app, not a mobile-narrow rendering of it.
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
  const [state, setState] = useState<State>('idle')

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

  // Once the iframe is in the DOM, flip to `loading` and arm the timeout.
  useEffect(() => {
    if (!visible || !buildHref) return
    setState('loading')
    const tid = window.setTimeout(() => {
      // Only stamp errored if we're still loading — onLoad already moved
      // us to loaded; we don't want to clobber a slow-but-eventual success.
      setState((s) => (s === 'loading' ? 'errored' : s))
    }, LOAD_TIMEOUT_MS)
    return () => window.clearTimeout(tid)
  }, [visible, buildHref])

  if (!buildHref) {
    return <div className="project-card__preview project-card__preview--empty" aria-hidden="true" />
  }

  const showFrame = visible && state !== 'errored'
  return (
    <div
      ref={ref}
      className={`project-card__preview project-card__preview--${state}`}
      aria-hidden="true"
    >
      {showFrame && (
        <iframe
          className={`project-card__preview-frame${state === 'loaded' ? ' is-loaded' : ''}`}
          src={buildHref}
          title={`${title} — aperçu`}
          loading="lazy"
          sandbox="allow-scripts allow-same-origin"
          tabIndex={-1}
          onLoad={() => setState('loaded')}
          onError={() => setState('errored')}
        />
      )}
      {(state === 'loading' || !visible) && (
        <div className="project-card__preview-skeleton" aria-hidden="true" />
      )}
      {state === 'errored' && (
        <div className="project-card__preview-fallback" aria-hidden="true" />
      )}
    </div>
  )
}
