import { Suspense, lazy, useRef } from 'react'
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
 * (warm paper background, dark ink), and the race-safe hydration of a saved
 * scene — done via `updateScene()` inside the `excalidrawAPI` callback rather
 * than `initialData.elements`, so it works regardless of when the dynamic
 * Excalidraw chunk resolves.
 */
export function SketchCanvas({
  initialScene,
  readOnly = false,
  loadingLabel,
  onApiReady,
  onChange,
}: SketchCanvasProps) {
  // Snapshot the initial scene once — later prop changes shouldn't re-hydrate
  // and stomp the visitor's in-progress edits.
  const initialSceneRef = useRef<NapkinScene | null>(initialScene ?? null)

  return (
    <div className="napkin__canvas-wrap">
      <Suspense fallback={<div className="napkin__loading mono">{loadingLabel}</div>}>
        <Excalidraw
          excalidrawAPI={(api) => {
            const typed = api as unknown as ExcalidrawAPI
            const saved = initialSceneRef.current
            if (saved && saved.elements.length > 0) {
              try {
                typed.updateScene({ elements: saved.elements })
              } catch {
                // Stale or shape-mismatched scene — ignore so the canvas
                // still opens blank instead of throwing.
              }
            }
            onApiReady?.(typed)
          }}
          viewModeEnabled={readOnly}
          onChange={onChange ? () => onChange() : undefined}
          initialData={{
            appState: {
              viewBackgroundColor: '#fbf7ec',
              currentItemStrokeColor: '#1f1d18',
            },
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
