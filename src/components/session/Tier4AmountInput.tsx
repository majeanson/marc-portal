/**
 * Admin-only input for the Tier 4 quoted amount. Local state tracks the
 * draft (in dollars, as the admin types); commit on Save translates to
 * cents and PATCHes. Clear sends null which both removes the value AND
 * hides the visitor's "Pay (quoted)" button.
 *
 * Validation: 100..100000 dollars (matches server-side cents range).
 * Invalid input shows an inline error and keeps the draft.
 *
 * Parent passes key={String(cents)} so when the persisted value changes
 * (post-save, post-409 reload), React unmounts and the draft state
 * re-initializes from the new prop — no effect+setState dance.
 */

import { useState } from 'react'

export interface Tier4AmountInputCopy {
  tier4AmountLabel: string
  tier4AmountPlaceholder: string
  tier4AmountSave: string
  tier4AmountClear: string
  tier4AmountInvalid: string
  tier4AmountHint: string
}

export function Tier4AmountInput({
  copy,
  cents,
  onSave,
}: {
  copy: Tier4AmountInputCopy
  cents: number | null
  onSave: (cents: number | null) => Promise<void>
}) {
  const initial = cents != null ? String(Math.round(cents / 100)) : ''
  const [draft, setDraft] = useState(initial)
  const [error, setError] = useState(false)
  const [saving, setSaving] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = draft.trim()
    if (trimmed === '') {
      // Empty submit = clear (same as the dedicated Clear button).
      setSaving(true)
      await onSave(null)
      setSaving(false)
      return
    }
    const dollars = Number(trimmed)
    if (
      !Number.isFinite(dollars) ||
      !Number.isInteger(dollars) ||
      dollars < 100 ||
      dollars > 100_000
    ) {
      setError(true)
      return
    }
    setError(false)
    setSaving(true)
    await onSave(dollars * 100)
    setSaving(false)
  }

  const onClear = async () => {
    setSaving(true)
    setDraft('')
    await onSave(null)
    setSaving(false)
  }

  return (
    <form className="session-frame__tier3" onSubmit={onSubmit}>
      <label className="field__label">
        {copy.tier4AmountLabel}
        <div className="session-frame__tier3-row">
          <span className="session-frame__tier3-prefix mono">$</span>
          <input
            type="number"
            inputMode="numeric"
            min={100}
            max={100000}
            step={1}
            value={draft}
            placeholder={copy.tier4AmountPlaceholder}
            onChange={(e) => {
              setDraft(e.target.value)
              if (error) setError(false)
            }}
            disabled={saving}
            className="session-frame__tier3-input mono"
          />
          <button
            type="submit"
            className="link-btn mono"
            disabled={saving || draft.trim() === initial}
          >
            {copy.tier4AmountSave}
          </button>
          {cents != null && (
            <button type="button" className="link-btn mono" onClick={onClear} disabled={saving}>
              {copy.tier4AmountClear}
            </button>
          )}
        </div>
      </label>
      <p className="field__hint session-frame__strip-hint">
        {error ? copy.tier4AmountInvalid : copy.tier4AmountHint}
      </p>
    </form>
  )
}
