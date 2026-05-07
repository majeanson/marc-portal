import type { Lang } from '../../i18n'
import { DICT } from '../../i18n'
import { getSchemaForType, localized } from '../../lib/intakeSchemas'
import type { FieldDef, ProblemType } from '../../lib/intakeSchemas'

export type FormData = Record<string, string>

export function TypeForm({
  lang,
  type,
  values,
  onChange,
  onBack,
  onContinue,
  submitting = false,
  submitError = null,
}: {
  lang: Lang
  type: ProblemType
  values: FormData
  onChange: (next: FormData) => void
  onBack: () => void
  onContinue: () => void
  submitting?: boolean
  submitError?: string | null
}) {
  const t = DICT[lang].intake.form
  const tConf = DICT[lang].intake.confirmation
  const schema = getSchemaForType(type)

  const setField = (id: string, value: string) => {
    onChange({ ...values, [id]: value })
  }

  const allRequiredFilled = schema.fields.every(
    (f) => !f.required || (values[f.id] && values[f.id].trim().length > 0),
  )
  const canSubmit = allRequiredFilled && !submitting

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
      </div>

      {submitError && (
        <p className="form__error" role="alert">
          {submitError}
        </p>
      )}

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
          className="field__input"
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
          className="field__input mono"
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
        className="field__input"
      />
      {hint && <span className="field__hint">{hint}</span>}
    </label>
  )
}
