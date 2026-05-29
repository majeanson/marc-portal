/**
 * Admin-only operator notes panel on /session/:id (and /admin/inbox/:id).
 *
 * A free-text scratch pad scoped to the session. The visitor never sees it.
 * Useful for what the message thread can't hold: scope-creep callouts,
 * follow-up reminders, conversational context from out-of-band channels.
 *
 * Server: GET/PUT/DELETE /api/admin/sessions/:id/notes (operator_notes
 * table, see migration 0028). 4 KB body cap enforced server-side.
 *
 * The panel mounts only when isAdmin is true — the caller guards.
 */

import { useEffect, useState } from 'react'
import type { Lang } from '../i18n'
import { ApiError } from '../lib/api'
import { deleteOperatorNote, getOperatorNote, putOperatorNote } from '../lib/todayApi'
import { formatDateTime } from '../lib/format'

const COPY = {
  fr: {
    heading: 'Notes opérateur',
    sub: 'Ton bloc-notes pour cette session. Le visiteur ne le voit jamais. À utiliser pour les rappels, le contexte hors-fil, les remarques que tu te laisses à toi-même.',
    placeholder: 'Ce qui t’est passé par la tête…',
    save: 'Enregistrer',
    saving: 'Enregistrement…',
    saved: 'Enregistré',
    clear: 'Vider',
    error: 'Échec de l’enregistrement. Réessayer.',
    charLeft: (n: number) => `${n} caractères restants`,
    lastEdited: (s: string) => `Mis à jour ${s}`,
    loading: 'Chargement…',
  },
  en: {
    heading: 'Operator notes',
    sub: 'Your scratch pad for this session. The visitor never sees it. Use it for reminders, out-of-thread context, notes-to-self.',
    placeholder: 'Whatever you’re thinking…',
    save: 'Save',
    saving: 'Saving…',
    saved: 'Saved',
    clear: 'Clear',
    error: 'Save failed. Try again.',
    charLeft: (n: number) => `${n} characters left`,
    lastEdited: (s: string) => `Updated ${s}`,
    loading: 'Loading…',
  },
} as const

// Mirror the server's MAX_BODY_BYTES so the textarea hint matches what
// will actually be accepted. The check is bytes on the server; we approximate
// with characters here (ASCII-dominant content for ops notes).
const MAX_CHARS = 4096

export function OperatorNotesPanel({ sessionId, lang }: { sessionId: string; lang: Lang }) {
  const t = COPY[lang]
  const [body, setBody] = useState('')
  const [savedBody, setSavedBody] = useState('')
  const [updatedAt, setUpdatedAt] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)
  const [justSaved, setJustSaved] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await getOperatorNote(sessionId)
        if (cancelled) return
        const text = r.note?.body ?? ''
        setBody(text)
        setSavedBody(text)
        setUpdatedAt(r.note?.updatedAt ?? null)
      } catch {
        // Leave empty — the GET endpoint already returns null gracefully
        // when the table is missing, so a true error here is rare.
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [sessionId])

  const dirty = body !== savedBody
  const remaining = MAX_CHARS - body.length

  async function onSave() {
    if (!dirty || saving) return
    setSaving(true)
    setError(false)
    try {
      const r = await putOperatorNote(sessionId, body)
      setSavedBody(r.note?.body ?? '')
      setUpdatedAt(r.note?.updatedAt ?? null)
      setJustSaved(true)
      // Quiet the "Saved" tag after a couple of seconds.
      window.setTimeout(() => setJustSaved(false), 2000)
    } catch (err) {
      // 413 / 400 surface as a generic message — the textarea already
      // shows the character count so the cause is visible.
      if (!(err instanceof ApiError)) console.error(err)
      setError(true)
    } finally {
      setSaving(false)
    }
  }

  async function onClear() {
    if (saving) return
    setSaving(true)
    setError(false)
    try {
      await deleteOperatorNote(sessionId)
      setBody('')
      setSavedBody('')
      setUpdatedAt(null)
    } catch (err) {
      if (!(err instanceof ApiError)) console.error(err)
      setError(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="surface intake__step session-frame__panel operator-notes">
      <h2 className="operator-notes__heading">{t.heading}</h2>
      <p className="operator-notes__sub">{t.sub}</p>
      {loading ? (
        <p className="mono operator-notes__loading">{t.loading}</p>
      ) : (
        <>
          <textarea
            className="operator-notes__textarea"
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, MAX_CHARS))}
            placeholder={t.placeholder}
            rows={6}
            spellCheck={true}
            aria-label={t.heading}
          />
          <div className="operator-notes__actions">
            <button
              type="button"
              className="link-btn mono operator-notes__save"
              onClick={() => void onSave()}
              disabled={!dirty || saving}
            >
              {saving ? t.saving : t.save}
            </button>
            {savedBody.length > 0 && !dirty && (
              <button
                type="button"
                className="link-btn mono operator-notes__clear"
                onClick={() => void onClear()}
                disabled={saving}
              >
                {t.clear}
              </button>
            )}
            <span className="mono operator-notes__count">{t.charLeft(remaining)}</span>
            {error && (
              <span className="mono operator-notes__error" role="alert">
                {t.error}
              </span>
            )}
            {justSaved && !error && <span className="mono operator-notes__saved">{t.saved}</span>}
            {updatedAt && !justSaved && !error && (
              <span className="mono operator-notes__stamp">
                {t.lastEdited(formatDateTime(updatedAt, lang))}
              </span>
            )}
          </div>
        </>
      )}
    </section>
  )
}
