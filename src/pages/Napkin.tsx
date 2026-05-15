import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import { DICT, type Lang } from '../i18n'
import { loadDraft, saveDraft } from '../lib/draft'

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
}

const NAPKIN_KEY = 'napkin-sketch'
const INTAKE_DRAFT_KEY = 'intake-draft'

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

  useEffect(() => {
    document.title = `${t.title} — Marc`
  }, [t])

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
      // Mark the intake draft so Intake.tsx can show a "sketch attached"
      // affordance. We don't stomp existing fields, only add the flag.
      const existing =
        loadDraft<{ formData: Record<string, unknown> }>(INTAKE_DRAFT_KEY) ??
        { formData: {} as Record<string, unknown> }
      saveDraft(INTAKE_DRAFT_KEY, {
        ...existing,
        formData: { ...existing.formData, __hasNapkinSketch: true },
      })
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
              <Suspense
                fallback={<div className="napkin__loading mono">{t.loadingCanvas}</div>}
              >
                <Excalidraw
                  excalidrawAPI={(api) => {
                    apiRef.current = api as unknown as ExcalidrawAPI
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

            <button
              type="button"
              className="napkin__submit"
              onClick={onSubmit}
              disabled={saving}
            >
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
