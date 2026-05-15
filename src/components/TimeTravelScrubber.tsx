import { useEffect, useMemo, useRef, useState } from 'react'
import type { Lang } from '../i18n'
import { DICT } from '../i18n'
import { formatDate } from '../lib/format'
import type { PublicAdvancementRow } from '../lib/advancementsApi'

const PLAY_INTERVAL_MS = 3500

/**
 * "Time machine" scrubber for /share/:id. Given the advancements that have a
 * `build_url`, lets a visitor step through the project's build history in a
 * single iframe — newest at the right, oldest at the left. Play/pause auto-
 * advances. Keyboard ← / → step. Reduced-motion hides the auto-play button.
 *
 * Returns null if there are fewer than two buildable advancements — the
 * scrubber adds nothing when there's only one snapshot.
 */
export function TimeTravelScrubber({
  advancements,
  lang,
}: {
  advancements: PublicAdvancementRow[]
  lang: Lang
}) {
  const t = DICT[lang].sessionAdvancements.scrubber

  // Build the steps list: only buildable advancements, oldest → newest so
  // the scrub direction reads left-to-right as "moving forward in time".
  const steps = useMemo(() => {
    const withBuild = advancements.filter((r) => r.build_url && r.build_url.length > 0)
    // listPublicAdvancements returns newest-first; reverse for the scrubber.
    return [...withBuild].reverse().map((r) => ({
      id: r.id,
      label: r.label,
      date: r.date,
      href: `${r.build_url}${r.iframe_path ?? ''}`,
    }))
  }, [advancements])

  const [idx, setIdx] = useState(() => Math.max(0, steps.length - 1))
  const [playing, setPlaying] = useState(false)
  const reducedMotion = useReducedMotion()
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // Reset to the latest step whenever the underlying list grows or shrinks.
  // The lint rule flags setState-in-effect — accepted here because the
  // external dependency (the advancements list) genuinely changes async
  // and we want the visible index to snap back to "latest" when it does.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIdx(Math.max(0, steps.length - 1))
    setPlaying(false)
  }, [steps.length])

  // Auto-advance when playing. Stops at the end (doesn't loop — visitors
  // who want to rewind hit Prev or click an earlier notch).
  useEffect(() => {
    if (!playing) return
    const id = window.setInterval(() => {
      setIdx((i) => {
        if (i >= steps.length - 1) {
          setPlaying(false)
          return i
        }
        return i + 1
      })
    }, PLAY_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [playing, steps.length])

  // Keyboard nav — left/right step, space toggles play. Active only when
  // the scrubber root has focus (focus delegation via tabIndex on the
  // container so the visitor can opt in).
  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      setIdx((i) => Math.max(0, i - 1))
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      setIdx((i) => Math.min(steps.length - 1, i + 1))
    } else if (e.key === ' ') {
      if (!reducedMotion) {
        e.preventDefault()
        setPlaying((p) => !p)
      }
    }
  }

  if (steps.length < 2) return null
  const current = steps[idx]
  const isFirst = idx === 0
  const isLast = idx === steps.length - 1

  return (
    // role="application" so AT users understand arrow keys steer the
    // scrubber instead of moving the reading cursor. tabIndex=0 makes the
    // whole component focusable, which is the entry point for the
    // keyboard handler below. Both are intentional; the a11y/lint rules
    // assume the element should not capture key events, but this is a
    // first-class interactive widget — opting out of those rules here.
    /* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
    /* eslint-disable jsx-a11y/no-noninteractive-tabindex */
    <section
      className="time-travel"
      aria-labelledby="time-travel-title"
      role="application"
      tabIndex={0}
      onKeyDown={onKeyDown}
    >
      <header className="time-travel__head">
        <div className="section__eyebrow">{t.eyebrow}</div>
        <h2 id="time-travel-title" className="time-travel__title">
          {t.title}
        </h2>
        <p className="time-travel__sub">{t.sub}</p>
      </header>

      <div className="time-travel__viewer">
        <iframe
          key={current.id}
          ref={iframeRef}
          className="time-travel__iframe"
          src={current.href}
          title={`${current.label} — ${formatDate(current.date, lang)}`}
          loading="lazy"
          sandbox="allow-scripts allow-same-origin"
        />
      </div>

      <div className="time-travel__meta">
        <span className="mono time-travel__step">{t.stepLabel(idx + 1, steps.length)}</span>
        <span className="time-travel__label">{current.label}</span>
        <span className="mono time-travel__date">{formatDate(current.date, lang)}</span>
      </div>

      <div className="time-travel__controls">
        <button
          type="button"
          className="time-travel__btn time-travel__btn--prev"
          onClick={() => setIdx((i) => Math.max(0, i - 1))}
          disabled={isFirst}
          aria-label={t.prev}
        >
          ← {t.prev}
        </button>
        {!reducedMotion && (
          <button
            type="button"
            className={`time-travel__btn time-travel__btn--play${playing ? ' is-playing' : ''}`}
            onClick={() => setPlaying((p) => !p)}
            aria-pressed={playing}
            aria-label={playing ? t.pause : t.play}
            disabled={isLast && !playing}
          >
            {playing ? '⏸ ' + t.pause : '▶ ' + t.play}
          </button>
        )}
        <button
          type="button"
          className="time-travel__btn time-travel__btn--next"
          onClick={() => setIdx((i) => Math.min(steps.length - 1, i + 1))}
          disabled={isLast}
          aria-label={t.next}
        >
          {t.next} →
        </button>
      </div>

      <div
        className="time-travel__track"
        role="group"
        aria-label={t.ariaTrack}
      >
        {steps.map((s, i) => (
          <button
            key={s.id}
            type="button"
            className={`time-travel__notch${i === idx ? ' is-active' : ''}${i < idx ? ' is-past' : ''}`}
            onClick={() => setIdx(i)}
            aria-current={i === idx ? 'true' : undefined}
            aria-label={`${s.label} — ${formatDate(s.date, lang)}`}
            title={`${s.label} — ${formatDate(s.date, lang)}`}
          />
        ))}
      </div>
    </section>
  )
}

/**
 * Local hook — keep small components self-contained. Lives here instead of
 * lib/ since this is the only consumer; trivially extractable later.
 *
 * Initial value is derived synchronously in the useState initializer so we
 * never call setState in the effect body for the first render — only the
 * `change` listener does. Avoids the cascading-render lint warning.
 */
function useReducedMotion() {
  const [reduced, setReduced] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}
