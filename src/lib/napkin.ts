/**
 * Napkin sketch — the shared shape and PNG-export helper for the Excalidraw
 * sketch a visitor can attach while describing their problem.
 *
 * The sketch used to live on a standalone /napkin page that exported a flat
 * PNG and threw the editable scene away. It is now folded into the intake
 * form, and the editable Excalidraw scene travels with the intake — so the
 * sketch is a living object, not a screenshot.
 *
 * This module deliberately holds NO static Excalidraw import: the
 * `import('@excalidraw/excalidraw')` inside `exportApiToPng` is dynamic, so
 * the file is safe to import from the intake critical path without pulling
 * the ~600 KB Excalidraw bundle. The component wrapper (SketchCanvas) is the
 * one that loads Excalidraw, and it is only reached via React.lazy.
 */

/** The editable Excalidraw scene — the source of truth for the sketch.
 *  `elements` is Excalidraw's opaque element array; kept as `unknown[]` so
 *  this module never needs the Excalidraw types. */
export interface NapkinScene {
  elements: unknown[]
}

/** A napkin sketch as persisted inside the intake payload. */
export interface NapkinSketch {
  /** Editable Excalidraw scene — re-openable, the source of truth. */
  scene: NapkinScene
  /** PNG snapshot (data URL) — cheap to render on the session/export views.
   *  Empty string when the sketch is caption-only (no drawing yet). */
  png: string
  /** One-sentence caption the visitor writes alongside the drawing. */
  text: string
  /** ISO timestamp of the last edit. */
  savedAt: string
}

/** The slice of the Excalidraw imperative API this codebase touches. */
export type ExcalidrawAPI = {
  getSceneElements: () => readonly unknown[]
  getAppState: () => { exportBackground?: boolean; viewBackgroundColor?: string }
  getFiles: () => unknown
  updateScene: (data: { elements?: readonly unknown[] }) => void
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}

/**
 * Render the current Excalidraw scene to a PNG data URL. `exportToBlob` lives
 * in a different entry than the component, dynamically imported so callers on
 * the critical path don't pay for it until a sketch is actually captured.
 */
export async function exportApiToPng(api: ExcalidrawAPI): Promise<string> {
  const mod = await import('@excalidraw/excalidraw')
  const blob = await mod.exportToBlob({
    elements: api.getSceneElements() as never,
    appState: { ...api.getAppState(), exportBackground: true },
    files: api.getFiles() as never,
    mimeType: 'image/png',
  })
  return blobToDataUrl(blob)
}
