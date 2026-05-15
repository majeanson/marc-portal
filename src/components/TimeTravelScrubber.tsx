import { useEffect, useMemo, useRef, useState } from 'react'
import type { Lang } from '../i18n'
import { DICT } from '../i18n'
import { formatDate } from '../lib/format'
import type { PublicAdvancementRow } from '../lib/advancementsApi'

const PLAY_INTERVAL_MS = 3500
/** URL param used for deep-linking a specific step (1-indexed for humans). */
const STEP_PARAM = 'step'

/** Read the deep-link step from `location.search`, clamped to [0, max]. */
function readStepFromUrl(max: number): number {
  if (typeof window === 'undefined') return max
  const raw = new URLSearchParams(window.location.search).get(STEP_PARAM)
  if (!raw) return max
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed)) return max
  // 1-indexed in the URL (matches the visible stepLabel "Step 3 of 5").
  return Math.min(max, Math.max(0, parsed - 1))
}

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

  // Initial index honors the ?step=N URL param when present, else latest.
  // Read once at construction; subsequent changes (from clicks/keys) push
  // back to the URL via replaceState (no scroll jump, no history pollution).
  const [idx, setIdx] = useState(() => readStepFromUrl(Math.max(0, steps.length - 1)))
  const [playing, setPlaying] = useState(false)
  const reducedMotion = useReducedMotion()
  const rootRef = useRef<HTMLElement>(null)

  // Reset to the latest step whenever the underlying list grows or shrinks.
  // The lint rule flags setState-in-effect — accepted here because the
  // external dependency (the advancements list) genuinely changes async
  // and we want the visible index to snap back to "latest" when it does.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIdx(readStepFromUrl(Math.max(0, steps.length - 1)))
    setPlaying(false)
  }, [steps.length])

  // Sync the current idx back to the URL on every change. Skip when there's
  // nothing meaningful to share (idx 0, single-step lists).
  useEffect(() => {
    if (typeof window === 'undefined' || steps.length < 2) return
    const params = new URLSearchParams(window.location.search)
    params.set(STEP_PARAM, String(idx + 1))
    const next = `${window.location.pathname}?${params.toString()}${window.location.hash}`
    window.history.replaceState(null, '', next)
  }, [idx, steps.length])

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

  // Keyboard nav — left/right to step, space to toggle play. Listen at the
  // window level but only act when focus is inside the scrubber root. This
  // avoids the a11y antipattern of `role="application"` (which suppresses
  // screen-reader read-aloud) while still giving the visitor full keyboard
  // control. Buttons are real <button>s so Tab + Enter works regardless.
  useEffect(() => {
    if (typeof window === 'undefined') return
    function onKey(e: KeyboardEvent) {
      const root = rootRef.current
      if (!root) return
      const active = document.activeElement
      if (!active || !(active instanceof Node) || !root.contains(active)) return
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setIdx((i) => Math.max(0, i - 1))
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        setIdx((i) => Math.min(steps.length - 1, i + 1))
      } else if (e.key === ' ' && !reducedMotion) {
        // Don't steal Space from buttons (they should still activate on Space)
        // — only intercept when focus is on a non-button element inside us.
        if (active instanceof HTMLButtonElement) return
        e.preventDefault()
        setPlaying((p) => !p)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [reducedMotion, steps.length])

  if (steps.length < 2) return null
  const current = steps[idx]
  const isFirst = idx === 0
  const isLast = idx === steps.length - 1

  return (
    <section
      ref={rootRef}
      className="time-travel"
      aria-labelledby="time-travel-title"
      aria-describedby="time-travel-keyhint"
    >
      <header className="time-travel__head">
        <div className="section__eyebrow">{t.eyebrow}</div>
        <h2 id="time-travel-title" className="time-travel__title">
          {t.title}
        </h2>
        <p className="time-travel__sub">{t.sub}</p>
        <p id="time-travel-keyhint" className="time-travel__keyhint mono">
          {t.keyboardHint}
        </p>
      </header>

      <div className="time-travel__viewer">
        <iframe
          key={current.id}
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

      <div className="time-travel__track" role="group" aria-label={t.ariaTrack}>
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
