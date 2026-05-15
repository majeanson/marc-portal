import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import { DICT, type Lang } from '../i18n'
import { clearDraft, loadDraft, saveDraft } from '../lib/draft'

// Excalidraw is heavy (~600 KB before assets). Lazy-import the named export
// inside the route so the home/intake critical path doesn't pay for it.
const Excalidraw = lazy(() =>
  import('@excalidraw/excalidraw').then((m) => ({ default: m.Excalidraw })),
)

// Excalidraw ships its own stylesheet. Importing here keeps the CSS out of
// the main bundle (Vite will code-split the chunk along with the dynamic
// import above).
import '@excalidraw/excalidraw/index.css'

type ExcalidrawAPI = {
  getSceneElements: () => readonly unknown[]
  getAppState: () => { exportBackground?: boolean; viewBackgroundColor?: string }
  getFiles: () => unknown
  updateScene: (data: { elements?: readonly unknown[] }) => void
}

const NAPKIN_KEY = 'napkin-sketch'
/** Separate key for the in-progress scene (JSON, not PNG). Cleared on submit
 * so the visitor doesn't see stale art when starting over. */
const NAPKIN_SCENE_KEY = 'napkin-scene'
const SCENE_AUTOSAVE_MS = 800

interface NapkinScene {
  elements: readonly unknown[]
}

interface NapkinSketch {
  png: string
  text: string
  savedAt: string
}

/**
 * /napkin — a whiteboard intake. Visitor sketches the problem in Excalidraw,
 * writes a sentence, hits send. The drawing + text get stashed in
 * localStorage under `marc-portal:napkin-sketch`; the intake-draft is
 * primed with a flag so Intake.tsx can show "Sketch attached" when it
 * loads. Navigation lands the visitor in /intake to finish the flow.
 *
 * Why localStorage: the upload pipeline to the server isn't wired yet (no
 * S3-style attachment endpoint on /api/sessions). For now the sketch is
 * captured client-side so visitors can re-download it from /intake; the
 * server-side attachment is a follow-up.
 */
export function Napkin({ lang }: { lang: Lang }) {
  const t = DICT[lang].napkin
  const navigate = useNavigate()
  const [text, setText] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const apiRef = useRef<ExcalidrawAPI | null>(null)
  const langPrefix = lang === 'en' ? '/en' : ''
  // Read any in-progress scene on mount. We don't restore it via `initialData`
  // because the dynamic-import races with the useEffect — instead we hydrate
  // the API via updateScene() once it's wired up below.
  const initialSceneRef = useRef<NapkinScene | null>(loadDraft<NapkinScene>(NAPKIN_SCENE_KEY))

  useEffect(() => {
    document.title = `${t.title} — Marc`
  }, [t])

  // Autosave the scene to localStorage. Debounced so we don't write on every
  // pencil flick. Stored as plain JSON (small even for elaborate sketches —
  // hundreds of points are KBs, not MBs). PNG export still happens on submit.
  useEffect(() => {
    let handle: number | null = null
    const interval = window.setInterval(() => {
      const api = apiRef.current
      if (!api) return
      const elements = api.getSceneElements()
      if (elements.length === 0) return
      if (handle) window.clearTimeout(handle)
      handle = window.setTimeout(() => {
        saveDraft<NapkinScene>(NAPKIN_SCENE_KEY, { elements })
      }, SCENE_AUTOSAVE_MS)
    }, SCENE_AUTOSAVE_MS)
    return () => {
      window.clearInterval(interval)
      if (handle) window.clearTimeout(handle)
    }
  }, [])

  async function onSubmit() {
    setErr(null)
    const trimmed = text.trim()
    const api = apiRef.current
    const hasShapes = !!api && api.getSceneElements().length > 0
    if (!trimmed && !hasShapes) {
      setErr(t.blankErr)
      return
    }
    setSaving(true)
    try {
      let png = ''
      if (api && hasShapes) {
        // Dynamic import — `exportToBlob` lives in a different entry than
        // the component, lazy-loaded so we don't pay for it on first paint.
        const mod = await import('@excalidraw/excalidraw')
        const blob = await mod.exportToBlob({
          elements: api.getSceneElements() as never,
          appState: { ...api.getAppState(), exportBackground: true },
          files: api.getFiles() as never,
          mimeType: 'image/png',
        })
        png = await blobToDataUrl(blob)
      }
      const sketch: NapkinSketch = {
        png,
        text: trimmed,
        savedAt: new Date().toISOString(),
      }
      saveDraft(NAPKIN_KEY, sketch)
      // Submitted: nuke the in-progress scene so a fresh visit starts clean.
      clearDraft(NAPKIN_SCENE_KEY)
      navigate(`${langPrefix}/intake?from=napkin`)
    } catch (e) {
      console.error('napkin export failed', e)
      setErr(t.blankErr)
      setSaving(false)
    }
  }

  return (
    <div className="app">
      <Header lang={lang} />
      <main id="main-content">
        <article className="section napkin">
          <div className="section__inner">
            <div className="section__eyebrow">{t.eyebrow}</div>
            <h1 className="napkin__title">{t.title}</h1>
            <p className="napkin__sub">{t.sub}</p>

            <div className="napkin__canvas-wrap">
              <Suspense fallback={<div className="napkin__loading mono">{t.loadingCanvas}</div>}>
                <Excalidraw
                  excalidrawAPI={(api) => {
                    apiRef.current = api as unknown as ExcalidrawAPI
                    // Hydrate the in-progress scene if there was one. Done
                    // here rather than via `initialData.elements` so it works
                    // regardless of when the dynamic Excalidraw chunk loads.
                    const saved = initialSceneRef.current
                    if (saved && saved.elements.length > 0) {
                      try {
                        ;(api as unknown as ExcalidrawAPI).updateScene({
                          elements: saved.elements,
                        })
                      } catch {
                        // Stale or shape-mismatched scene — clear so the next
                        // visit doesn't keep trying.
                        clearDraft(NAPKIN_SCENE_KEY)
                      }
                    }
                  }}
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

            <p className="napkin__instruction">{t.instruction}</p>

            <label className="napkin__desc">
              <span className="napkin__desc-label">{t.descLabel}</span>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={t.descPlaceholder}
                rows={2}
                className="napkin__desc-input"
              />
            </label>

            {err && (
              <p className="napkin__err mono" role="alert">
                {err}
              </p>
            )}

            <button type="button" className="napkin__submit" onClick={onSubmit} disabled={saving}>
              {saving ? t.saving : t.submit}
            </button>
          </div>
        </article>
      </main>
      <Footer lang={lang} />
    </div>
  )
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}
