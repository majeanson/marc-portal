// This file exports a component + a discriminator Error class the caller
// throws to signal the freeze case. React Refresh wants single-component
// modules; the error class is part of the component's contract (the toggle
// reads it to pick a render state), so co-locating is correct.
/* eslint-disable react-refresh/only-export-components */
/**
 * Admin-only "tarif communautaire" toggle for a session. Boolean switch that
 * PATCHes sessions.community_discount. Three render states for the hint line:
 *  - idle      : normal explanatory hint
 *  - frozen    : the server's freeze rule tripped (a build leg is paid)
 *  - error     : any other failure (network drop, 500, stale row, etc.)
 *
 * Distinguishing those matters: an admin who sees "figé — un versement a déjà
 * été payé" after a network blip would burn ten minutes hunting for paid legs
 * that don't exist. The caller (SessionPage) does the classification and
 * throws `CommunityDiscountFrozenError` for the freeze case; everything else
 * propagates and falls into the generic error state here.
 *
 * Mirrors Tier3SplitInput's two-pill layout so the admin tier strip reads
 * as one consistent ledger. Saves immediately on click; no separate
 * "Save" button — matches the rest of the admin tier controls.
 */

import { useState } from 'react'

/** Thrown by the caller's `onSave` when the server returned 409 with the
 *  freeze message. Lets this component render the precise "leg paid" hint
 *  rather than a generic "save failed" — those have very different fixes. */
export class CommunityDiscountFrozenError extends Error {
  constructor() {
    super('community discount frozen — a build leg is paid')
    this.name = 'CommunityDiscountFrozenError'
  }
}

export interface CommunityDiscountToggleCopy {
  communityDiscountLabel: string
  communityDiscountOn: string
  communityDiscountOff: string
  communityDiscountHint: string
  communityDiscountFrozen: string
  communityDiscountError: string
}

export function CommunityDiscountToggle({
  copy,
  on,
  frozen: frozenProp = false,
  onSave,
}: {
  copy: CommunityDiscountToggleCopy
  on: boolean
  /** Pre-rendered frozen state — set when the session already has a paid
   *  build leg. Surfaces the frozen hint without the admin having to click
   *  to discover it. The "click → 409 → frozen" path still works as a
   *  defense for race conditions (a leg paid between page load and click). */
  frozen?: boolean
  /** Resolves on success. Throws `CommunityDiscountFrozenError` when the
   *  freeze rule tripped server-side; any other thrown value renders as
   *  the generic error hint. */
  onSave: (next: boolean) => Promise<void>
}) {
  type HintState = 'idle' | 'frozen' | 'error'
  const [saving, setSaving] = useState(false)
  const [hint, setHint] = useState<HintState>('idle')
  // Server-known frozen state (the row already has a paid leg) wins over
  // the client-side hint when nothing's been attempted yet. A failed click
  // can transition us into 'error', which then takes precedence visually.
  const effectiveHint: HintState = hint === 'idle' && frozenProp ? 'frozen' : hint
  const disabledByFreeze = frozenProp && hint !== 'error'
  const pick = async (next: boolean) => {
    if (saving || on === next || disabledByFreeze) return
    setSaving(true)
    setHint('idle')
    try {
      await onSave(next)
    } catch (err) {
      setHint(err instanceof CommunityDiscountFrozenError ? 'frozen' : 'error')
    } finally {
      setSaving(false)
    }
  }
  const hintText =
    effectiveHint === 'frozen'
      ? copy.communityDiscountFrozen
      : effectiveHint === 'error'
        ? copy.communityDiscountError
        : copy.communityDiscountHint
  return (
    <div className="session-frame__community">
      <div className="field__label">{copy.communityDiscountLabel}</div>
      <div className="session-frame__tier3-row">
        <button
          type="button"
          className="link-btn mono"
          onClick={() => pick(false)}
          disabled={saving || !on || disabledByFreeze}
          aria-pressed={!on}
        >
          {copy.communityDiscountOff}
        </button>
        <button
          type="button"
          className="link-btn mono"
          onClick={() => pick(true)}
          disabled={saving || on || disabledByFreeze}
          aria-pressed={on}
        >
          {copy.communityDiscountOn}
        </button>
      </div>
      <p
        className="field__hint session-frame__strip-hint"
        role={effectiveHint === 'error' ? 'alert' : undefined}
      >
        {hintText}
      </p>
    </div>
  )
}
