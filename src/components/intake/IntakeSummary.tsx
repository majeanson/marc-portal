import { useEffect, useRef, useState } from 'react'
import type { Lang } from '../../i18n'
import { DICT } from '../../i18n'
import type { Account } from './AccountStep'
import type { FieldDef, ProblemType } from '../../lib/intakeSchemas'
import { getSchemaForType, localized, SCHEMAS } from '../../lib/intakeSchemas'
import type { FormData } from './TypeForm'
import { formatDate } from '../../lib/format'

export type IntakeSummaryChange = {
  account: Account
  values: FormData
  type?: ProblemType
}

export function IntakeSummary({
  lang,
  account,
  type,
  values,
  submittedAt,
  editable = false,
  editableType = false,
  typeChangeConfirm,
  requiredEmptyConfirm,
  onChange,
}: {
  lang: Lang
  account: Account
  type: ProblemType
  values: FormData
  submittedAt: string
  editable?: boolean
  /** When true (and editable), allow type to be changed via a select. */
  editableType?: boolean
  /** confirm() string shown before applying a type change. Required if editableType. */
  typeChangeConfirm?: string
  /** confirm() string shown before clearing a required field. */
  requiredEmptyConfirm?: string
  onChange?: (next: IntakeSummaryChange) => Promise<void> | void
}) {
  const t = DICT[lang].intake.confirmation
  const schema = getSchemaForType(type)

  const commit = (next: IntakeSummaryChange) => {
    void onChange?.(next)
  }

  const handleTypeChange = (nextType: ProblemType) => {
    if (nextType === type) return
    if (typeChangeConfirm && !window.confirm(typeChangeConfirm)) return
    // Clearing formData is the safe default — schemas don't share field ids.
    commit({ account, values: {}, type: nextType })
  }

  return (
    <>
      <h3 style={{ marginBottom: 12 }}>{t.summaryTitle}</h3>
      <dl className="summary">
        <dt>{t.summaryEmail}</dt>
        <dd className="mono">{account.email}</dd>
        {(editable || account.name) && (
          <>
            <dt>{t.summaryName}</dt>
            <dd>
              {editable ? (
                <EditableText
                  value={account.name ?? ''}
                  onSave={(name) =>
                    commit({ account: { ...account, name: name || undefined }, values })
                  }
                  placeholder="—"
                />
              ) : (
                account.name
              )}
            </dd>
          </>
        )}
        <dt>{t.summaryType}</dt>
        <dd>
          {editable && editableType ? (
            <select
              className="field__input mono summary__edit-input"
              value={type}
              onChange={(e) => handleTypeChange(e.target.value as ProblemType)}
            >
              {(Object.keys(SCHEMAS) as ProblemType[]).map((k) => (
                <option key={k} value={k}>
                  {localized(SCHEMAS[k].title, lang)}
                </option>
              ))}
            </select>
          ) : (
            localized(schema.title, lang)
          )}
        </dd>
        <dt>{t.summarySubmittedAt}</dt>
        <dd>{formatDate(submittedAt, lang)}</dd>
      </dl>

      <h3 style={{ marginTop: 24, marginBottom: 12 }}>{t.summaryAnswers}</h3>
      <dl className="summary">
        {schema.fields.map((field) => {
          const v = values[field.id] ?? ''
          if (!editable && !v) return null
          const requiredEmpty = !!field.required && !v
          return (
            <div key={field.id} style={{ marginBottom: 10 }}>
              <dt>
                {localized(field.label, lang)}
                {field.required && <span className="field__req">*</span>}
                {requiredEmpty && <span className="summary__required-flag mono">required</span>}
              </dt>
              <dd>
                {editable ? (
                  <EditableField
                    field={field}
                    lang={lang}
                    value={v}
                    requiredEmptyConfirm={requiredEmptyConfirm}
                    onSave={(next) => commit({ account, values: { ...values, [field.id]: next } })}
                  />
                ) : (
                  <span style={{ whiteSpace: 'pre-wrap' }}>{displayValue(field, v, lang)}</span>
                )}
              </dd>
            </div>
          )
        })}
        <HandoffModeRow lang={lang} values={values} />
      </dl>
    </>
  )
}

/** Surfaces the optional `__handoff_mode` reserved key from formData so it
 * shows up in the confirmation summary and in admin views. Non-editable: the
 * preference can be re-discussed at delivery, not edited via this UI. */
function HandoffModeRow({ lang, values }: { lang: Lang; values: FormData }) {
  const raw = values['__handoff_mode']
  if (!raw) return null
  const label = lang === 'fr' ? 'Préférence de gestion' : 'Management preference'
  const map: Record<string, { fr: string; en: string }> = {
    'je-men-occupe': {
      fr: "Je m'en occupe (mode dépositaire recommandé)",
      en: 'I handle it (custodian, recommended)',
    },
    'tout-a-toi': {
      fr: 'Tout à toi (visiteur autonome côté ops)',
      en: 'All yours (visitor manages ops)',
    },
    'on-en-parle': { fr: 'On en parle plus tard', en: "Let's talk later" },
  }
  const friendly = map[raw]?.[lang] ?? raw
  return (
    <div style={{ marginBottom: 10 }}>
      <dt>{label}</dt>
      <dd>{friendly}</dd>
    </div>
  )
}

function displayValue(field: FieldDef, value: string, lang: Lang): string {
  if (!value) return '—'
  if (field.options) {
    const match = field.options.find((o) => o.value === value)
    if (match) return localized(match.label, lang)
  }
  return value
}

function EditableText({
  value,
  onSave,
  placeholder,
}: {
  value: string
  onSave: (next: string) => void
  placeholder?: string
}) {
  const [editing, setEditing] = useState(false)

  if (!editing) {
    return (
      <button
        type="button"
        className="summary__edit-trigger"
        onClick={() => setEditing(true)}
        aria-label="Edit"
      >
        {value || <span className="summary__empty">{placeholder ?? '—'}</span>}
      </button>
    )
  }

  return (
    <TextInputEditor
      initial={value}
      onCommit={(next) => {
        setEditing(false)
        if (next !== value) onSave(next)
      }}
      onCancel={() => setEditing(false)}
    />
  )
}

function TextInputEditor({
  initial,
  onCommit,
  onCancel,
}: {
  initial: string
  onCommit: (next: string) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState(initial)
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    ref.current?.focus()
  }, [])

  return (
    <input
      ref={ref}
      type="text"
      className="field__input summary__edit-input"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => onCommit(draft)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          onCommit(draft)
        } else if (e.key === 'Escape') {
          onCancel()
        }
      }}
    />
  )
}

function EditableField({
  field,
  lang,
  value,
  requiredEmptyConfirm,
  onSave,
}: {
  field: FieldDef
  lang: Lang
  value: string
  requiredEmptyConfirm?: string
  onSave: (next: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const display = displayValue(field, value, lang)

  if (!editing) {
    return (
      <button
        type="button"
        className="summary__edit-trigger"
        onClick={() => setEditing(true)}
        aria-label="Edit"
        style={{ whiteSpace: 'pre-wrap' }}
      >
        {value ? display : <span className="summary__empty">—</span>}
      </button>
    )
  }

  const commit = (next: string) => {
    setEditing(false)
    if (next === value) return
    // Required field about to be cleared → confirm first.
    if (
      field.required &&
      next.trim().length === 0 &&
      value.trim().length > 0 &&
      requiredEmptyConfirm &&
      !window.confirm(requiredEmptyConfirm)
    ) {
      return
    }
    onSave(next)
  }
  const cancel = () => setEditing(false)

  if (field.type === 'textarea') {
    return <TextareaEditor field={field} initial={value} onCommit={commit} onCancel={cancel} />
  }

  if (field.type === 'select') {
    return <SelectEditor field={field} lang={lang} initial={value} onCommit={commit} />
  }

  if (field.type === 'radio') {
    return <RadioEditor field={field} lang={lang} initial={value} onCommit={commit} />
  }

  return <NumberOrTextEditor field={field} initial={value} onCommit={commit} onCancel={cancel} />
}

function TextareaEditor({
  field,
  initial,
  onCommit,
  onCancel,
}: {
  field: FieldDef
  initial: string
  onCommit: (next: string) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState(initial)
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    ref.current?.focus()
  }, [])
  return (
    <textarea
      ref={ref}
      rows={field.rows ?? 3}
      className="field__input summary__edit-input"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => onCommit(draft)}
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
          e.preventDefault()
          onCommit(draft)
        } else if (e.key === 'Escape') {
          onCancel()
        }
      }}
    />
  )
}

function SelectEditor({
  field,
  lang,
  initial,
  onCommit,
}: {
  field: FieldDef
  lang: Lang
  initial: string
  onCommit: (next: string) => void
}) {
  const ref = useRef<HTMLSelectElement>(null)
  useEffect(() => {
    ref.current?.focus()
  }, [])
  return (
    <select
      ref={ref}
      className="field__input mono summary__edit-input"
      defaultValue={initial}
      onChange={(e) => onCommit(e.target.value)}
      onBlur={(e) => onCommit(e.currentTarget.value)}
    >
      <option value="">—</option>
      {field.options?.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {localized(opt.label, lang)}
        </option>
      ))}
    </select>
  )
}

function RadioEditor({
  field,
  lang,
  initial,
  onCommit,
}: {
  field: FieldDef
  lang: Lang
  initial: string
  onCommit: (next: string) => void
}) {
  const [draft, setDraft] = useState(initial)
  return (
    <div className="radio-group">
      {field.options?.map((opt) => (
        <label key={opt.value} className="radio">
          <input
            type="radio"
            name={field.id}
            value={opt.value}
            checked={draft === opt.value}
            onChange={() => {
              setDraft(opt.value)
              onCommit(opt.value)
            }}
          />
          <span>{localized(opt.label, lang)}</span>
        </label>
      ))}
    </div>
  )
}

function NumberOrTextEditor({
  field,
  initial,
  onCommit,
  onCancel,
}: {
  field: FieldDef
  initial: string
  onCommit: (next: string) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState(initial)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    ref.current?.focus()
  }, [])
  return (
    <input
      ref={ref}
      type={field.type === 'number' ? 'number' : 'text'}
      className="field__input summary__edit-input"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => onCommit(draft)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          onCommit(draft)
        } else if (e.key === 'Escape') {
          onCancel()
        }
      }}
    />
  )
}
