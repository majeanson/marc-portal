import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import type { Lang } from '../../i18n'
import { DICT } from '../../i18n'
import { getSchemaForType, localized } from '../../lib/intakeSchemas'
import type { FieldDef, ProblemType } from '../../lib/intakeSchemas'
import { exportApiToPng } from '../../lib/napkin'
import type { ExcalidrawAPI, NapkinSketch } from '../../lib/napkin'
import { VoiceRecorder } from '../VoiceRecorder'
import { transcribeIntakeVoice, type VoiceNapkin } from '../../lib/intakeMediaApi'
import { ApiError } from '../../lib/api'
import { SceneBoundary } from '../SceneBoundary'

// Excalidraw is heavy — keep <SketchCanvas> (and the ~600 KB chunk it pulls)
// behind React.lazy so word-first visitors who never open the sketch panel
// don't download it.
const SketchCanvas = lazy(() =>
  import('../SketchCanvas').then((m) => ({ default: m.SketchCanvas })),
)

export type FormData = Record<string, string>

/**
 * Reserved keys (not declared in any intake schema) that the form writes
 * directly into formData. Underscore prefix signals "system field, not part
 * of the schema-driven loop." Admin views read these alongside schema fields.
 *
 *   __handoff_mode  → 'tout-a-toi' | 'je-men-occupe' | 'on-en-parle'
 */
const HANDOFF_MODE_KEY = '__handoff_mode'
type HandoffMode = 'tout-a-toi' | 'je-men-occupe' | 'on-en-parle'
// Default to Custodian ('je-men-occupe') — a custodian plan is what lets Marc
// handle DNS, Cloudflare, Resend, D1 and secret rotation without explaining
// each one. Visitors who want out can pick 'tout-a-toi' here, then confirm
// with a skills checklist on /session/:id at delivery (the PaymentActions
// ack flow). 'on-en-parle' still exists for visitors who genuinely want to
// defer the decision.
const HANDOFF_DEFAULT: HandoffMode = 'je-men-occupe'

export function TypeForm({
  lang,
  type,
  values,
  onChange,
  onBack,
  onContinue,
  submitting = false,
  submitError = null,
  sketch = null,
  onSketchChange,
  voiceNapkin = null,
  onVoiceNapkinChange,
}: {
  lang: Lang
  type: ProblemType
  values: FormData
  onChange: (next: FormData) => void
  onBack: () => void
  onContinue: () => void
  submitting?: boolean
  submitError?: string | null
  /** The visitor's attached sketch, carried in the intake draft. */
  sketch?: NapkinSketch | null
  /** Persist (or clear, with null) the sketch into the draft. When omitted,
   *  the inline sketch panel is not rendered at all. */
  onSketchChange?: (sketch: NapkinSketch | null) => void
  /** The visitor's transcribed voice note, carried in the intake draft. */
  voiceNapkin?: VoiceNapkin | null
  /** Persist (or clear, with null) the voice note. When omitted, the inline
   *  voice panel is not rendered at all. */
  onVoiceNapkinChange?: (voice: VoiceNapkin | null) => void
}) {
  const t = DICT[lang].intake.form
  const tConf = DICT[lang].intake.confirmation
  const tNapkin = DICT[lang].napkin
  const tMedia = DICT[lang].media
  const schema = getSchemaForType(type)
  const handoffMode = (values[HANDOFF_MODE_KEY] as HandoffMode) || HANDOFF_DEFAULT
  const handoffHref = lang === 'fr' ? '/handoff' : '/en/handoff'

  const setField = (id: string, value: string) => {
    onChange({ ...values, [id]: value })
  }

  // ── Inline sketch ──────────────────────────────────────────────────────
  // A collapsible Excalidraw surface. The drawing + caption ride in the
  // intake draft (draft.sketch), autosaved with the rest of the form.
  // Excalidraw only mounts while the panel is open.
  const hasSketch = !!sketch && (sketch.scene.elements.length > 0 || sketch.text.trim().length > 0)
  const [sketchOpen, setSketchOpen] = useState(hasSketch)
  const apiRef = useRef<ExcalidrawAPI | null>(null)
  const captureTimer = useRef<number | null>(null)
  // Latest sketch mirrored into a ref so the debounced drawing capture (which
  // fires up to 500 ms after a render) merges against current state — e.g. a
  // caption typed after the last pen stroke — instead of a stale closure.
  const sketchRef = useRef<NapkinSketch | null>(sketch)
  useEffect(() => {
    sketchRef.current = sketch
  }, [sketch])

  const emitSketch = (next: NapkinSketch) => {
    // An empty drawing with no caption is "no sketch" — store null so the
    // intake payload stays clean.
    onSketchChange?.(next.scene.elements.length === 0 && !next.text.trim() ? null : next)
  }

  const captureDrawing = async () => {
    const api = apiRef.current
    if (!api) return
    const elements = [...api.getSceneElements()]
    const prev = sketchRef.current
    let png = prev?.png ?? ''
    if (elements.length > 0) {
      try {
        png = await exportApiToPng(api)
      } catch {
        // Export hiccup — keep the prior PNG; the scene is still saved.
      }
    } else {
      png = ''
    }
    emitSketch({
      scene: { elements },
      png,
      text: prev?.text ?? '',
      savedAt: new Date().toISOString(),
    })
  }

  const scheduleCapture = () => {
    if (captureTimer.current) window.clearTimeout(captureTimer.current)
    captureTimer.current = window.setTimeout(() => {
      void captureDrawing()
    }, 500)
  }

  const setCaption = (text: string) => {
    const prev = sketchRef.current
    emitSketch({
      scene: prev?.scene ?? { elements: [] },
      png: prev?.png ?? '',
      text,
      savedAt: new Date().toISOString(),
    })
  }

  const toggleSketch = () => {
    if (sketchOpen && captureTimer.current) {
      // Closing — drop the pending capture and the now-stale API handle.
      window.clearTimeout(captureTimer.current)
      apiRef.current = null
    }
    setSketchOpen((open) => !open)
  }

  const removeSketch = () => {
    if (captureTimer.current) window.clearTimeout(captureTimer.current)
    apiRef.current = null
    setSketchOpen(false)
    onSketchChange?.(null)
  }

  // ── Inline voice note ──────────────────────────────────────────────────
  // A voice note recorded straight into the intake. It is transcribed at the
  // edge and discarded — only the text rides in the intake draft (voiceNapkin),
  // so a visitor who would rather talk than type still leaves a written intake.
  const [voiceOpen, setVoiceOpen] = useState(!!voiceNapkin)
  const [voiceBusy, setVoiceBusy] = useState(false)
  const [voiceError, setVoiceError] = useState<string | null>(null)

  const onIntakeVoice = async (blob: Blob) => {
    if (voiceBusy) return
    setVoiceError(null)
    setVoiceBusy(true)
    try {
      const { transcript } = await transcribeIntakeVoice(blob)
      onVoiceNapkinChange?.({ transcript, savedAt: new Date().toISOString() })
    } catch (err) {
      setVoiceError(err instanceof ApiError ? err.message : tMedia.voice.error)
    } finally {
      setVoiceBusy(false)
    }
  }

  // No field is required (sketch + voice are alternative input channels), so
  // the gate is "at least one channel of input": any answered question, a
  // sketch, or a transcribed voice note. This blocks an accidental empty
  // submit without forcing any specific question. __handoff_mode has a
  // default and isn't a schema field, so it doesn't count as problem content.
  const hasAnyAnswer =
    schema.fields.some((f) => (values[f.id] ?? '').trim().length > 0) ||
    hasSketch ||
    !!voiceNapkin?.transcript.trim()
  const canSubmit = hasAnyAnswer && !submitting

  return (
    <div className="intake__step">
      <div className="section__eyebrow">{t.eyebrow}</div>
      <h2>{localized(schema.title, lang)}</h2>
      <p className="form__autosave mono">{t.autosaved}</p>

      <div className="form">
        {schema.fields.map((field) => (
          <FieldControl
            key={field.id}
            field={field}
            lang={lang}
            value={values[field.id] ?? ''}
            onChange={(v) => setField(field.id, v)}
          />
        ))}

        <fieldset className="field field--handoff">
          <legend className="field__label">{t.handoffMode.label}</legend>
          <p className="field__hint">
            {t.handoffMode.hint}{' '}
            <a href={handoffHref} className="mono">
              {t.handoffMode.learnMore}
            </a>
          </p>
          <div className="radio-group">
            <label className="radio">
              <input
                type="radio"
                name={HANDOFF_MODE_KEY}
                value="tout-a-toi"
                checked={handoffMode === 'tout-a-toi'}
                onChange={() => setField(HANDOFF_MODE_KEY, 'tout-a-toi')}
              />
              <span>{t.handoffMode.optionTout}</span>
            </label>
            <label className="radio">
              <input
                type="radio"
                name={HANDOFF_MODE_KEY}
                value="je-men-occupe"
                checked={handoffMode === 'je-men-occupe'}
                onChange={() => setField(HANDOFF_MODE_KEY, 'je-men-occupe')}
              />
              <span>{t.handoffMode.optionJe}</span>
            </label>
            <label className="radio">
              <input
                type="radio"
                name={HANDOFF_MODE_KEY}
                value="on-en-parle"
                checked={handoffMode === 'on-en-parle'}
                onChange={() => setField(HANDOFF_MODE_KEY, 'on-en-parle')}
              />
              <span>{t.handoffMode.optionParle}</span>
            </label>
          </div>
        </fieldset>
      </div>

      {onSketchChange && (
        <div className="intake__sketch">
          {!sketchOpen ? (
            <button type="button" className="intake__sketch-toggle mono" onClick={toggleSketch}>
              {hasSketch ? tNapkin.formReopen : tNapkin.formTeaser}
            </button>
          ) : (
            <div className="intake__sketch-panel">
              <div className="intake__sketch-head">
                <h3 className="intake__sketch-title">{tNapkin.title}</h3>
                <div className="intake__sketch-actions mono">
                  <button type="button" className="intake__sketch-link" onClick={toggleSketch}>
                    {tNapkin.formHide}
                  </button>
                  {hasSketch && (
                    <button
                      type="button"
                      className="intake__sketch-link intake__sketch-link--remove"
                      onClick={removeSketch}
                    >
                      {tNapkin.formRemove}
                    </button>
                  )}
                </div>
              </div>
              <SceneBoundary
                surface="napkin-intake"
                fallback={
                  <div className="napkin__canvas-wrap">
                    <p className="napkin__loading mono">{tNapkin.sceneError}</p>
                    <button
                      type="button"
                      className="intake__sketch-link intake__sketch-link--remove"
                      onClick={removeSketch}
                    >
                      {tNapkin.formRemove}
                    </button>
                  </div>
                }
              >
                <Suspense
                  fallback={
                    <div className="napkin__canvas-wrap">
                      <div className="napkin__loading mono">{tNapkin.loadingCanvas}</div>
                    </div>
                  }
                >
                  <SketchCanvas
                    initialScene={sketch?.scene ?? null}
                    loadingLabel={tNapkin.loadingCanvas}
                    onApiReady={(api) => {
                      apiRef.current = api
                    }}
                    onChange={scheduleCapture}
                  />
                </Suspense>
              </SceneBoundary>
              <p className="napkin__instruction">{tNapkin.instruction}</p>
              <label className="napkin__desc">
                <span className="napkin__desc-label">{tNapkin.descLabel}</span>
                <textarea
                  value={sketch?.text ?? ''}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder={tNapkin.descPlaceholder}
                  rows={2}
                  className="input napkin__desc-input"
                />
              </label>
            </div>
          )}
        </div>
      )}

      {onVoiceNapkinChange && (
        <div className="intake__voice">
          {!voiceOpen ? (
            <button
              type="button"
              className="intake__sketch-toggle mono"
              onClick={() => setVoiceOpen(true)}
            >
              {voiceNapkin ? tMedia.intake.voiceReopen : tMedia.intake.voiceTeaser}
            </button>
          ) : (
            <div className="intake__sketch-panel">
              <div className="intake__sketch-head">
                <h3 className="intake__sketch-title">{tMedia.intake.title}</h3>
                <div className="intake__sketch-actions mono">
                  <button
                    type="button"
                    className="intake__sketch-link"
                    onClick={() => setVoiceOpen(false)}
                  >
                    {tMedia.intake.voiceHide}
                  </button>
                  {voiceNapkin && (
                    <button
                      type="button"
                      className="intake__sketch-link intake__sketch-link--remove"
                      onClick={() => {
                        onVoiceNapkinChange(null)
                        setVoiceError(null)
                        setVoiceOpen(false)
                      }}
                    >
                      {tMedia.intake.voiceRemove}
                    </button>
                  )}
                </div>
              </div>
              {voiceNapkin ? (
                // Transcript landed — the visitor reviews and corrects it.
                // Whisper is good, not perfect, on Québécois French; the
                // audio was the ground truth, this text is an editable draft.
                <label className="napkin__desc">
                  <span className="napkin__desc-label">{tMedia.intake.transcriptLabel}</span>
                  <textarea
                    value={voiceNapkin.transcript}
                    onChange={(e) =>
                      onVoiceNapkinChange({
                        transcript: e.target.value,
                        savedAt: voiceNapkin.savedAt,
                      })
                    }
                    placeholder={tMedia.intake.transcriptPlaceholder}
                    rows={4}
                    className="input napkin__desc-input"
                  />
                </label>
              ) : (
                <VoiceRecorder
                  lang={lang}
                  consent={tMedia.intake.voiceConsent}
                  confirmLabel={tMedia.intake.voiceUse}
                  busy={voiceBusy}
                  onRecorded={onIntakeVoice}
                  onCancel={() => setVoiceOpen(false)}
                />
              )}
              {voiceError && (
                <p className="form__error" role="alert">
                  {voiceError}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {submitError && (
        <p className="form__error" role="alert">
          {submitError}
        </p>
      )}

      {!hasAnyAnswer && !submitting && <p className="form__hint mono">{t.needsInput}</p>}
      <div className="form__actions">
        <button type="button" className="link-btn mono" onClick={onBack} disabled={submitting}>
          {t.back}
        </button>
        <button
          type="button"
          className="hero__cta"
          disabled={!canSubmit}
          onClick={onContinue}
          style={{
            opacity: canSubmit ? 1 : 0.4,
            cursor: canSubmit ? 'pointer' : 'not-allowed',
          }}
        >
          {submitting ? tConf.submitting : t.continue}
        </button>
      </div>
    </div>
  )
}

function FieldControl({
  field,
  lang,
  value,
  onChange,
}: {
  field: FieldDef
  lang: Lang
  value: string
  onChange: (v: string) => void
}) {
  const label = localized(field.label, lang)
  const placeholder = field.placeholder ? localized(field.placeholder, lang) : undefined
  const hint = field.hint ? localized(field.hint, lang) : undefined

  if (field.type === 'textarea') {
    return (
      <label className="field">
        <span className="field__label">
          {label}
          {field.required && <span className="field__req">*</span>}
        </span>
        <textarea
          rows={field.rows ?? 3}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="input field__input"
        />
        {hint && <span className="field__hint">{hint}</span>}
      </label>
    )
  }

  if (field.type === 'select') {
    return (
      <label className="field">
        <span className="field__label">
          {label}
          {field.required && <span className="field__req">*</span>}
        </span>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="input field__input mono"
        >
          <option value="">—</option>
          {field.options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {localized(opt.label, lang)}
            </option>
          ))}
        </select>
        {hint && <span className="field__hint">{hint}</span>}
      </label>
    )
  }

  if (field.type === 'radio') {
    return (
      <fieldset className="field">
        <legend className="field__label">
          {label}
          {field.required && <span className="field__req">*</span>}
        </legend>
        <div className="radio-group">
          {field.options?.map((opt) => (
            <label key={opt.value} className="radio">
              <input
                type="radio"
                name={field.id}
                value={opt.value}
                checked={value === opt.value}
                onChange={() => onChange(opt.value)}
              />
              <span>{localized(opt.label, lang)}</span>
            </label>
          ))}
        </div>
        {hint && <span className="field__hint">{hint}</span>}
      </fieldset>
    )
  }

  return (
    <label className="field">
      <span className="field__label">
        {label}
        {field.required && <span className="field__req">*</span>}
      </span>
      <input
        type={field.type === 'number' ? 'number' : 'text'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input field__input"
      />
      {hint && <span className="field__hint">{hint}</span>}
    </label>
  )
}
