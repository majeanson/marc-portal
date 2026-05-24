/**
 * Admin-only Tier-3 installment-split picker. Two pills: 50/50 or 40/40/20.
 * NULL (not chosen) renders with neither pill active — checkout.ts defaults
 * to 50/50 in that case.
 */

import { useState } from 'react'

export interface Tier3SplitInputCopy {
  tier3SplitLabel: string
  tier3Split5050: string
  tier3Split404020: string
  tier3SplitHint: string
}

export function Tier3SplitInput({
  copy,
  split,
  onSave,
}: {
  copy: Tier3SplitInputCopy
  split: string | null
  onSave: (split: '50-50' | '40-40-20' | null) => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  const pick = async (next: '50-50' | '40-40-20') => {
    if (saving || split === next) return
    setSaving(true)
    await onSave(next)
    setSaving(false)
  }
  return (
    <div className="session-frame__tier3">
      <div className="field__label">{copy.tier3SplitLabel}</div>
      <div className="session-frame__tier3-row">
        <button
          type="button"
          className="link-btn mono"
          onClick={() => pick('50-50')}
          disabled={saving || split === '50-50'}
          aria-pressed={split === '50-50'}
        >
          {copy.tier3Split5050}
        </button>
        <button
          type="button"
          className="link-btn mono"
          onClick={() => pick('40-40-20')}
          disabled={saving || split === '40-40-20'}
          aria-pressed={split === '40-40-20'}
        >
          {copy.tier3Split404020}
        </button>
      </div>
      <p className="field__hint session-frame__strip-hint">{copy.tier3SplitHint}</p>
    </div>
  )
}
