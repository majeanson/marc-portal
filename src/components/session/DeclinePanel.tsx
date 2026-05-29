/**
 * The "generous no" — shown when a session is `rejected`. A decline isn't
 * a dead end: the visitor sees Marc's tailored note (if he wrote one)
 * framed by standing pointers — the free Tier 0 tools, the always-open
 * door to a fresh request. Admin sees the same panel plus an editor for
 * the note.
 *
 * Extracted so the rejected-state UI lives in one file instead of being
 * intermixed with SessionPage's other status branches.
 */

import { useState } from 'react'
import type { Lang } from '../../i18n'
import { patchSession, type SessionRow } from '../../lib/sessionsApi'

export interface DeclinePanelCopy {
  declineHeading: string
  declineLead: string
  declineNoteFrom: string
  declinePointersHeading: string
  declinePointerTier0: string
  declinePointerTier0Link: string
  declinePointerIntake: string
  declinePointerIntakeLink: string
  declineNoteEditorLabel: string
  declineNoteEditorPlaceholder: string
  declineNoteEmpty: string
  declineNoteSave: string
  declineNoteSaving: string
}

export function DeclinePanel({
  session,
  lang,
  copy,
  isAdmin,
  onSaved,
}: {
  session: SessionRow
  lang: Lang
  copy: DeclinePanelCopy
  isAdmin: boolean
  onSaved: (s: SessionRow) => void
}) {
  const langPrefix = lang === 'en' ? '/en' : ''
  const [draft, setDraft] = useState(session.decline_note ?? '')
  const [saving, setSaving] = useState(false)
  const note = session.decline_note?.trim()

  const save = async () => {
    setSaving(true)
    try {
      const r = await patchSession(session.id, {
        declineNote: draft.trim() || null,
        ifUpdatedAt: session.updated_at,
      })
      onSaved(r.session)
    } catch {
      // Leave the draft in place so the operator can retry.
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="surface intake__step session-frame__panel decline-panel">
      <h2>{copy.declineHeading}</h2>
      {note ? (
        <blockquote className="decline-panel__note">
          <span className="mono decline-panel__note-from">{copy.declineNoteFrom}</span>
          <p>{note}</p>
        </blockquote>
      ) : (
        <p className="decline-panel__lead">{copy.declineLead}</p>
      )}

      <div className="decline-panel__pointers">
        <span className="mono decline-panel__pointers-heading">{copy.declinePointersHeading}</span>
        <div className="surface decline-panel__pointer">
          <p>{copy.declinePointerTier0}</p>
          <a className="decline-panel__pointer-link" href={`${langPrefix}/tier-0`}>
            {copy.declinePointerTier0Link}
          </a>
        </div>
        <div className="surface decline-panel__pointer">
          <p>{copy.declinePointerIntake}</p>
          <a className="decline-panel__pointer-link" href={`${langPrefix}/intake`}>
            {copy.declinePointerIntakeLink}
          </a>
        </div>
      </div>

      {isAdmin && (
        <div className="decline-panel__editor">
          <label className="mono decline-panel__editor-label" htmlFor="decline-note">
            {copy.declineNoteEditorLabel}
          </label>
          {!note && <p className="mono decline-panel__editor-empty">{copy.declineNoteEmpty}</p>}
          <textarea
            id="decline-note"
            className="field__input decline-panel__textarea"
            rows={5}
            value={draft}
            placeholder={copy.declineNoteEditorPlaceholder}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button
            type="button"
            className="link-btn mono"
            onClick={save}
            disabled={saving || draft.trim() === (session.decline_note ?? '').trim()}
          >
            {saving ? copy.declineNoteSaving : copy.declineNoteSave}
          </button>
        </div>
      )}
    </section>
  )
}
