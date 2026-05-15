import { useEffect, useRef, useState } from 'react'

/**
 * Tiny live thumbnail of a deployed build, rendered inside a project card.
 *
 * The iframe is mounted only once the card scrolls within ~200px of the
 * viewport (IntersectionObserver), keeps `loading="lazy"` as a second
 * gate, and is pointer-locked + `tabIndex=-1` so it's purely decorative —
 * the surrounding card link is the real navigation. A static gradient
 * placeholder takes its place when no build URL is available yet (early
 * intake, pending first deploy).
 *
 * Implementation note: the iframe renders at its natural desktop width
 * (1280×800) and is scaled down via CSS transform. That's deliberately
 * different from `width="100%"` — the goal is to *look like* the deployed
 * app, not a mobile-narrow rendering of it.
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
  const [loaded, setLoaded] = useState(false)

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

  if (!buildHref) {
    return <div className="project-card__preview project-card__preview--empty" aria-hidden="true" />
  }

  return (
    <div ref={ref} className="project-card__preview" aria-hidden="true">
      {visible && (
        <iframe
          className={`project-card__preview-frame${loaded ? ' is-loaded' : ''}`}
          src={buildHref}
          title={`${title} — aperçu`}
          loading="lazy"
          sandbox="allow-scripts allow-same-origin"
          tabIndex={-1}
          onLoad={() => setLoaded(true)}
        />
      )}
    </div>
  )
}
