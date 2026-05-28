/**
 * The visitor's intake-time napkin sketch, rendered inside SessionPage's
 * intake panel. Full-width PNG at rest; toggles into a pan/zoom Excalidraw
 * canvas (<NapkinReplay/>) when the editable scene is present and the
 * visitor clicks "open interactive."
 *
 * Re-upload (AUDIT P1.11): when `onReplaced` is provided, the visitor /
 * admin gets a "redo the sketch" affordance that lazy-loads SketchCanvas
 * hydrated with the existing scene. Save → exports PNG → POSTs to
 * /api/sessions/:id/attachments?kind=napkin&replace=true → calls back so
 * the parent re-fetches the session and shows the new napkin URL. Closes
 * the gap from P1.8: the original intake upload is best-effort, so if it
 * silently failed (Sentry logged, visitor saw nothing) this is the
 * recovery path.
 *
 * Extracted from SessionPage so the toggle state + the sketch-vs-png
 * decision live next to the affordance, not in a 1900-line page render.
 */

import { Suspense, lazy, useCallback, useRef, useState } from 'react'
import { DICT, type Lang } from '../../i18n'
import { exportApiToPng, type ExcalidrawAPI, type NapkinScene } from '../../lib/napkin'
import { uploadNapkin } from '../../lib/attachmentsApi'
import { ApiError } from '../../lib/api'
import { captureException } from '../../lib/sentry'
import { NapkinReplay } from '../NapkinReplay'
import { SceneBoundary } from '../SceneBoundary'

// SketchCanvas pulls in Excalidraw (~600 KB). Lazy so visitors who never
// click "edit" don't pay the bundle cost.
const SketchCanvas = lazy(() =>
  import('../SketchCanvas').then((m) => ({ default: m.SketchCanvas })),
)

export interface ParsedNapkin {
  png: string
  text: string
  savedAt: string
  /** Editable Excalidraw scene, present on intakes submitted after the
   *  napkin was folded into the form. Older sessions only have the flat PNG. */
  scene?: NapkinScene
}

interface NapkinSectionProps {
  lang: Lang
  napkin: ParsedNapkin
  /** The session id — needed for the re-upload POST. */
  sessionId?: string
  /** Optional callback fired after a successful re-upload. The parent
   *  should re-fetch session state so the new napkin URL renders. When
   *  omitted, the re-upload affordance is hidden entirely (read-only mode). */
  onReplaced?: () => void
}

type EditState =
  | { kind: 'idle' }
  | { kind: 'editing' }
  | { kind: 'saving' }
  | { kind: 'error'; message: string }

/** The napkin PNG, with a graceful fallback when the image can't load. The
 *  src is usually an /api/.../attachments/:id URL backed by R2; if the R2
 *  object is missing (stale napkin_attachment_id, a replace whose old-object
 *  cleanup left the row pointing nowhere) the <img> would otherwise render as
 *  a broken-image glyph. onError swaps to a plain mono line instead. Also
 *  guards an empty src (no PNG at all). */
function NapkinImage({ lang, src, alt }: { lang: Lang; src: string; alt: string }) {
  const t = DICT[lang].napkin
  const [broken, setBroken] = useState(false)
  if (!src || broken) {
    return <p className="session-napkin__unavailable mono">{t.imageUnavailable}</p>
  }
  return <img src={src} alt={alt} className="session-napkin__img" onError={() => setBroken(true)} />
}

export function NapkinSection({ lang, napkin, sessionId, onReplaced }: NapkinSectionProps) {
  const t = DICT[lang].napkin
  const hasScene = !!napkin.scene && napkin.scene.elements.length > 0
  const canEdit = hasScene && !!sessionId && !!onReplaced
  const [sceneOpen, setSceneOpen] = useState(false)
  const [edit, setEdit] = useState<EditState>({ kind: 'idle' })
  const editorApiRef = useRef<ExcalidrawAPI | null>(null)

  const onSave = useCallback(async () => {
    if (!sessionId || !onReplaced) return
    const api = editorApiRef.current
    if (!api) {
      setEdit({ kind: 'error', message: t.editError })
      return
    }
    setEdit({ kind: 'saving' })
    try {
      const png = await exportApiToPng(api)
      await uploadNapkin(sessionId, png, { replace: true })
      setEdit({ kind: 'idle' })
      // Parent refreshes session state; the new napkin URL (same shape,
      // different attachment id) will render on next paint.
      onReplaced()
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : t.editError
      captureException(err, { surface: 'napkin-reupload', sessionId })
      setEdit({ kind: 'error', message })
    }
  }, [sessionId, onReplaced, t.editError])

  const onCancel = useCallback(() => {
    editorApiRef.current = null
    setEdit({ kind: 'idle' })
  }, [])

  const isEditing = edit.kind === 'editing' || edit.kind === 'saving'

  return (
    <div className="session-napkin">
      <div className="session-napkin__head">
        <span className="section__eyebrow">{t.eyebrow}</span>
        <div className="session-napkin__actions">
          {hasScene && !isEditing && (
            <button
              type="button"
              className="mono session-napkin__toggle"
              onClick={() => setSceneOpen((open) => !open)}
            >
              {sceneOpen ? t.sceneHide : t.sceneOpen}
            </button>
          )}
          {canEdit && !isEditing && (
            <button
              type="button"
              className="mono session-napkin__edit"
              onClick={() => {
                setSceneOpen(false)
                setEdit({ kind: 'editing' })
              }}
            >
              {t.editOpen}
            </button>
          )}
          {!isEditing && (
            <a
              className="mono session-napkin__open"
              href={napkin.png}
              target="_blank"
              rel="noreferrer"
              download={`napkin-${napkin.savedAt.slice(0, 10) || 'sketch'}.png`}
            >
              {t.pillView} ↗
            </a>
          )}
        </div>
      </div>
      {napkin.text && <p className="session-napkin__caption">{napkin.text}</p>}
      <div className="session-napkin__frame">
        {isEditing && napkin.scene ? (
          <SceneBoundary
            surface="napkin-edit"
            fallback={<p className="session-napkin__edit-error mono">{t.sceneError}</p>}
          >
            <Suspense fallback={<div className="napkin__loading mono">{t.loadingCanvas}</div>}>
              <SketchCanvas
                initialScene={napkin.scene}
                loadingLabel={t.loadingCanvas}
                onApiReady={(api) => {
                  editorApiRef.current = api
                }}
              />
            </Suspense>
          </SceneBoundary>
        ) : sceneOpen && napkin.scene ? (
          <SceneBoundary
            surface="napkin-replay"
            fallback={
              <NapkinImage lang={lang} src={napkin.png} alt={napkin.text || 'Napkin sketch'} />
            }
          >
            <NapkinReplay lang={lang} scene={napkin.scene} />
          </SceneBoundary>
        ) : (
          <NapkinImage lang={lang} src={napkin.png} alt={napkin.text || 'Napkin sketch'} />
        )}
      </div>
      {isEditing && (
        <div className="session-napkin__edit-bar mono">
          <button
            type="button"
            className="session-napkin__edit-save"
            onClick={onSave}
            disabled={edit.kind === 'saving'}
          >
            {edit.kind === 'saving' ? t.editSaving : t.editSave}
          </button>
          <button
            type="button"
            className="session-napkin__edit-cancel"
            onClick={onCancel}
            disabled={edit.kind === 'saving'}
          >
            {t.editCancel}
          </button>
        </div>
      )}
      {edit.kind === 'error' && <p className="session-napkin__edit-error mono">{edit.message}</p>}
    </div>
  )
}
