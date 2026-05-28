import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import type { Lang } from '../i18n'
import { DICT } from '../i18n'
import type { ExcalidrawAPI, NapkinScene } from '../lib/napkin'
import { captureException } from '../lib/sentry'

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
  // A replay that threw once is disabled, not retried: if Excalidraw can't
  // process these elements via updateScene, the next click can't either.
  const [replayBroken, setReplayBroken] = useState(false)

  // Snapshot reduced-motion once. A replay is pure motion delight — under
  // `reduce` we drop the affordance and leave the static scene in place.
  const [reduceMotion] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  )

  const elements = scene.elements
  // One element is one stroke/shape — nothing to "play back" below two. A
  // replay that already threw is suppressed too (the scene is still shown
  // statically by SketchCanvas, which is what matters).
  const canReplay = elements.length > 1 && !reduceMotion && !replayBroken

  const clearTimers = () => {
    timers.current.forEach((id) => window.clearTimeout(id))
    timers.current = []
  }
  // Drop any in-flight replay if the panel unmounts mid-draw.
  useEffect(() => clearTimers, [])

  // The replay drives updateScene from a click handler AND from setTimeout
  // ticks. A throw in either escapes React's render tree — event handlers and
  // async timers don't reach the route errorElement — so an updateScene that
  // chokes on a version-drifted element would surface as an uncaught error in
  // Sentry rather than degrading. Recover here: stop the replay, restore the
  // full scene so the canvas doesn't sit blank, report once, and disable the
  // affordance. The static scene (rendered by SketchCanvas) stays intact.
  const onReplayError = (err: unknown) => {
    clearTimers()
    setReplaying(false)
    setReplayBroken(true)
    try {
      apiRef.current?.updateScene({ elements })
    } catch {
      // Restore failed too — the canvas may show blank, but a re-mount
      // (toggle off/on) re-hydrates from initialData via SketchCanvas, and
      // the SceneBoundary catches it there if even that throws.
    }
    captureException(err, { surface: 'napkin-replay', elements: elements.length })
  }

  const replay = () => {
    const api = apiRef.current
    if (!api || replaying || replayBroken) return
    clearTimers()
    setReplaying(true)

    const total = elements.length
    const frames = Math.min(total, MAX_FRAMES)
    const interval = REPLAY_MS / frames

    // Clear to a blank napkin immediately, then re-reveal a growing prefix of
    // the element list. Slicing yields a fresh array each tick — Excalidraw is
    // free to version the snapshot without us mutating the stored scene.
    try {
      api.updateScene({ elements: [] })
    } catch (err) {
      onReplayError(err)
      return
    }
    for (let f = 1; f <= frames; f++) {
      const count = Math.max(1, Math.round((f / frames) * total))
      const id = window.setTimeout(
        () => {
          try {
            apiRef.current?.updateScene({ elements: elements.slice(0, count) })
          } catch (err) {
            onReplayError(err)
            return
          }
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
