import { Suspense, lazy, useState } from 'react'
import type { ExcalidrawAPI, NapkinScene } from '../lib/napkin'

// Excalidraw is heavy (~600 KB before assets). Lazy-import the named export so
// nothing that statically reaches this file pays for it until <SketchCanvas>
// actually mounts. This component itself should also be reached via
// React.lazy by its callers, so the stylesheet import below code-splits too.
const Excalidraw = lazy(() =>
  import('@excalidraw/excalidraw').then((m) => ({ default: m.Excalidraw })),
)

// Excalidraw ships its own stylesheet. Importing here keeps the CSS in this
// lazy chunk rather than the main bundle.
import '@excalidraw/excalidraw/index.css'

export interface SketchCanvasProps {
  /** Editable scene to hydrate on mount (a returning visitor's drawing). */
  initialScene?: NapkinScene | null
  /** Render-only — disables editing (Excalidraw view mode). */
  readOnly?: boolean
  /** Localized "Loading the whiteboard…" label for the Suspense fallback. */
  loadingLabel: string
  /** Receives the imperative API once Excalidraw is wired up. */
  onApiReady?: (api: ExcalidrawAPI) => void
  /** Fires on every scene mutation — callers debounce + capture from here. */
  onChange?: () => void
}

/**
 * Shared Excalidraw wrapper. Owns the lazy import, the brand canvas styling
 * (warm paper background, dark ink), and hydration of a saved scene.
 *
 * Hydration goes through `initialData`, not a post-mount `updateScene()`: an
 * `updateScene` called synchronously inside the `excalidrawAPI` callback fires
 * before Excalidraw's first paint and is silently dropped, so the saved
 * drawing never appears. `initialData` is read on mount; `scrollToContent`
 * then fits the camera to it, so a hydrated sketch both renders and lands in
 * view (otherwise it can sit entirely off-screen at the origin).
 */
export function SketchCanvas({
  initialScene,
  readOnly = false,
  loadingLabel,
  onApiReady,
  onChange,
}: SketchCanvasProps) {
  // Snapshot the initial elements once — later prop changes shouldn't
  // re-hydrate and stomp the visitor's in-progress edits (or a replay in
  // flight). Excalidraw reads `initialData` only on mount, so a state
  // snapshot is both render-safe and the right lifetime.
  const [initialElements] = useState(() => initialScene?.elements ?? undefined)

  return (
    <div className="napkin__canvas-wrap">
      <Suspense fallback={<div className="napkin__loading mono">{loadingLabel}</div>}>
        <Excalidraw
          excalidrawAPI={(api) => onApiReady?.(api as unknown as ExcalidrawAPI)}
          viewModeEnabled={readOnly}
          onChange={onChange ? () => onChange() : undefined}
          initialData={{
            elements: initialElements as never,
            appState: {
              viewBackgroundColor: '#fbf7ec',
              currentItemStrokeColor: '#1f1d18',
            },
            scrollToContent: true,
          }}
          UIOptions={{
            canvasActions: {
              saveToActiveFile: false,
              loadScene: false,
              export: false,
            },
          }}
        />
      </Suspense>
    </div>
  )
}
