import { useEffect, useRef, useState } from 'react'
import type { Lang } from '../i18n'

// 'timeout' means "stop waiting visually, show the OG layer" — but the
// iframe stays mounted so a slow build can still take over when it finally
// loads. 'errored' (a real onError) unmounts it for good.
type Outcome = 'loaded' | 'errored' | 'timeout' | null

// Soft timeout: if the iframe hasn't fired `load` yet (slow build, 504,
// hung deploy), the OG image stays as the thumbnail. 5s matches the
// visitor's patience budget for an idle card. The frame keeps booting
// underneath, so a build that answers late fades in instead of being
// killed mid-boot (verified 2026-10-15: with a scroll + wait, all eight
// cards' embeds eventually loaded).
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
  previewViewport,
}: {
  buildHref: string | null
  title: string
  sessionId?: string
  lang?: Lang
  /** 'phone' renders the live build in a 430×932 portrait frame, centred in
   * the 16:10 slot — phone-first builds (Ashwake, Dungeon Depths) look like
   * themselves instead of a stretched desktop viewport. */
  previewViewport?: 'phone' | null
}) {
  const isPhone = previewViewport === 'phone'
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

  // Keep the scale vars in sync with the card width. The desktop iframe
  // renders at a fixed 1280×800 and fills the 16:10 box by width; the phone
  // iframe renders at 430×932 and fits the box by HEIGHT (box height =
  // width × 10/16), centred, so the portrait frame sits inside the slot
  // instead of overflowing it.
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const sync = () => {
      el.style.setProperty('--preview-scale', String(el.clientWidth / 1280))
      el.style.setProperty('--preview-scale-phone', String((el.clientWidth * 0.625) / 932))
    }
    sync()
    const ro = new ResizeObserver(sync)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (!visible || !buildHref) return
    const tid = window.setTimeout(() => {
      setOutcome((prev) => (prev === null ? 'timeout' : prev))
    }, LOAD_TIMEOUT_MS)
    return () => window.clearTimeout(tid)
  }, [visible, buildHref])

  // No buildHref: collapse to text-only. The OG card used to render as a
  // bottom-layer placeholder, but for any card whose build wasn't deployed
  // yet (a common state during dev + on home thumbnails before first ship)
  // the card was reading as "missing image" — a cream rectangle sitting
  // above the title with nothing on it. R3 design pass: drop the rectangle
  // entirely when there's nothing meaningful to show. Cards with a real
  // build still get the OG → iframe layered preview below.
  if (!buildHref) return null

  const isLoading = visible && !!buildHref && outcome === null
  const isLoaded = outcome === 'loaded'
  // Both failure flavours read as 'errored' to the CSS (OG layer showing);
  // only the mount condition below distinguishes them.
  const isErrored = outcome === 'errored' || outcome === 'timeout' || !buildHref
  const state = isErrored ? 'errored' : isLoaded ? 'loaded' : isLoading ? 'loading' : 'idle'

  return (
    <div
      ref={ref}
      className={`project-card__preview project-card__preview--${state}${isPhone ? ' project-card__preview--phone' : ''}`}
      aria-hidden="true"
      // inert, not just aria-hidden: an embedded build that autofocuses an
      // input on boot (the dads invite door does) steals system focus
      // through the iframe, and the browser scrolls THIS page down to the
      // card to reveal it — which read as "navigation didn't go back to
      // top". The preview is pointer-events:none, so no focus landing here
      // is ever user intent; inert propagates into the child browsing
      // context and stops the grab at the source.
      inert
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
      {visible && buildHref && outcome !== 'errored' && (
        <iframe
          className={`project-card__preview-frame${isPhone ? ' project-card__preview-frame--phone' : ''}${isLoaded ? ' is-loaded' : ''}`}
          src={buildHref}
          title={`${title} — aperçu`}
          loading="lazy"
          sandbox="allow-scripts allow-same-origin"
          tabIndex={-1}
          onLoad={() => setOutcome('loaded')}
          onError={() => setOutcome('errored')}
          // Backstop for engines that don't propagate inert into a
          // cross-origin frame: if the frame still manages to take focus,
          // hand it straight back so the page doesn't stay trapped there.
          onFocus={(e) => e.currentTarget.blur()}
        />
      )}
    </div>
  )
}
