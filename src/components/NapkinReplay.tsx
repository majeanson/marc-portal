import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import type { Lang } from '../i18n'
import { DICT } from '../i18n'
import type { ExcalidrawAPI, NapkinScene } from '../lib/napkin'

// Excalidraw is heavy (~600 KB). Keep <SketchCanvas> behind React.lazy so the
// session view only pays for it when the sketch panel is actually opened.
const SketchCanvas = lazy(() => import('./SketchCanvas').then((m) => ({ default: m.SketchCanvas })))

/** Total wall-clock length of one replay, in ms. Element count is paced to
 *  fit this window, so a 6-stroke sketch and a 60-stroke one both take the
 *  same time to draw — the sketch never drags or flickers past. */
const REPLAY_MS = 2600
/** A blank beat before the first stroke lands, so the replay reads as
 *  "starting from an empty napkin" rather than a hard cut. */
const START_DELAY_MS = 220
/** Cap on discrete reveal steps. Past this, strokes reveal in small chunks —
 *  keeps updateScene() calls (and Excalidraw re-renders) bounded on a dense
 *  drawing without changing the perceived duration. */
const MAX_FRAMES = 44

/**
 * NapkinReplay — the visitor's sketch, played back stroke by stroke.
 *
 * The intake stores the editable Excalidraw scene, not just a flat PNG, so the
 * elements still carry their creation order. This wraps <SketchCanvas> and adds
 * a "replay" control: clear to a blank napkin, then re-reveal the elements in
 * order over a fixed window — the problem being drawn, the way the visitor
 * first drew it. At rest the full scene is shown; replay is opt-in via the
 * button, and is suppressed entirely under prefers-reduced-motion.
 */
export function NapkinReplay({ lang, scene }: { lang: Lang; scene: NapkinScene }) {
  const t = DICT[lang].napkin
  const apiRef = useRef<ExcalidrawAPI | null>(null)
  const timers = useRef<number[]>([])
  const [replaying, setReplaying] = useState(false)

  // Snapshot reduced-motion once. A replay is pure motion delight — under
  // `reduce` we drop the affordance and leave the static scene in place.
  const [reduceMotion] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  )

  const elements = scene.elements
  // One element is one stroke/shape — nothing to "play back" below two.
  const canReplay = elements.length > 1 && !reduceMotion

  const clearTimers = () => {
    timers.current.forEach((id) => window.clearTimeout(id))
    timers.current = []
  }
  // Drop any in-flight replay if the panel unmounts mid-draw.
  useEffect(() => clearTimers, [])

  const replay = () => {
    const api = apiRef.current
    if (!api || replaying) return
    clearTimers()
    setReplaying(true)

    const total = elements.length
    const frames = Math.min(total, MAX_FRAMES)
    const interval = REPLAY_MS / frames

    // Clear to a blank napkin immediately, then re-reveal a growing prefix of
    // the element list. Slicing yields a fresh array each tick — Excalidraw is
    // free to version the snapshot without us mutating the stored scene.
    api.updateScene({ elements: [] })
    for (let f = 1; f <= frames; f++) {
      const count = Math.max(1, Math.round((f / frames) * total))
      const id = window.setTimeout(
        () => {
          apiRef.current?.updateScene({ elements: elements.slice(0, count) })
          if (f === frames) setReplaying(false)
        },
        START_DELAY_MS + f * interval,
      )
      timers.current.push(id)
    }
  }

  return (
    <div className="napkin-replay">
      <Suspense
        fallback={
          <div className="napkin__canvas-wrap">
            <div className="napkin__loading mono">{t.loadingCanvas}</div>
          </div>
        }
      >
        <SketchCanvas
          readOnly
          initialScene={scene}
          loadingLabel={t.loadingCanvas}
          onApiReady={(api) => {
            apiRef.current = api
          }}
        />
      </Suspense>
      {canReplay && (
        <div className="napkin-replay__bar">
          <button
            type="button"
            className="napkin-replay__btn mono"
            onClick={replay}
            disabled={replaying}
            aria-live="polite"
          >
            {replaying ? t.replayDrawing : t.replayPlay}
          </button>
        </div>
      )}
    </div>
  )
}
