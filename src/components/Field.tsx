import type { InputHTMLAttributes, ReactNode } from 'react'

/**
 * Field — the one labelled text input. The `.field` markup (a `<label>`, the
 * crisp `.input`/`.field__input`, an optional hint, an optional error) was
 * hand-rolled identically across the simple single-input forms; this collapses
 * that shape into one place and wires the accessibility that each call site
 * otherwise had to remember: a real `htmlFor`/`id` pair, `aria-describedby`
 * pointing at whichever of hint/error is showing, and `aria-invalid` when the
 * field is in error.
 *
 * Scope is deliberately the SIMPLE case. Forms with an adjacent button inside
 * the row, an autosave indicator, a character counter, or a `<select>`/radio
 * stay on the raw `.field` classes — forcing those through here would mean a
 * prop for every quirk, which is the abstraction the house style avoids. When
 * a form outgrows Field, it drops back to the classes, not a fatter Field.
 *
 * The input class is `input field__input` (same as the consolidated call
 * sites): `.input` carries the crisp recipe + accent focus ring, `.field__input`
 * the sans face / card surface / field padding on top. `inputClassName` passes
 * through for the rare per-field tweak (e.g. `mono`).
 */
type Props = {
  id: string
  label: ReactNode
  value: string
  onChange: (value: string) => void
  required?: boolean
  hint?: ReactNode
  error?: ReactNode
  inputClassName?: string
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'value' | 'onChange' | 'required'>

export function Field({
  id,
  label,
  value,
  onChange,
  required,
  hint,
  error,
  inputClassName,
  ...rest
}: Props) {
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  // Point the input at whichever helper text is actually rendered. Error wins
  // the read order when both are present — it's the message the visitor needs
  // to act on first.
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined

  return (
    <div className="field">
      <label htmlFor={id} className="field__label">
        {label}
        {required && <span className="field__req">*</span>}
      </label>
      <input
        id={id}
        className={`input field__input${inputClassName ? ` ${inputClassName}` : ''}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        {...rest}
      />
      {hint && (
        <p id={hintId} className="field__hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="field__hint field__hint--error">
          {error}
        </p>
      )}
    </div>
  )
}
