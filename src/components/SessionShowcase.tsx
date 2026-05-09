import { useState } from 'react'
import { DICT, type Lang } from '../i18n'
import { patchSession, type SessionRow } from '../lib/sessionsApi'

/**
 * Admin-only "Showcase as project" panel. Toggles whether this session
 * appears on /projects, and lets admin set the title + tagline shown on the
 * card. State is owned by SessionPage; this component just renders + dispatches
 * a single patch on save.
 */
export function SessionShowcase({
  session,
  lang,
  onPatched,
}: {
  session: SessionRow
  lang: Lang
  onPatched: (next: SessionRow) => void
}) {
  const t = DICT[lang].showcaseAdmin
  const langPrefix = lang === 'en' ? '/en' : ''
  // Initialised from the session prop on first mount. Local form state is
  // *not* re-synced if the parent reloads the session (visibility refresh),
  // because doing that would either trip react-hooks/set-state-in-effect or
  // clobber unsaved admin edits. SessionPage can re-mount this component
  // (key on session.updated_at) if hard re-sync is ever needed.
  const [enabled, setEnabled] = useState(session.showcased_at !== null)
  const [title, setTitle] = useState(session.showcase_title ?? '')
  const [tagline, setTagline] = useState(session.showcase_tagline ?? '')
  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [error, setError] = useState(false)

  const dirty =
    enabled !== (session.showcased_at !== null) ||
    title.trim() !== (session.showcase_title ?? '') ||
    tagline.trim() !== (session.showcase_tagline ?? '')

  const onSave = async () => {
    if (saving || !dirty) return
    setSaving(true)
    setError(false)
    try {
      const r = await patchSession(session.id, {
        ifUpdatedAt: session.updated_at,
        showcase: {
          enabled,
          title: title.trim() || null,
          tagline: tagline.trim() || null,
        },
      })
      onPatched(r.session)
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 2000)
    } catch {
      setError(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="intake__step session-frame__panel session-showcase">
      <h2>{t.sectionHeading}</h2>
      <p className="field__hint">{t.sectionHint}</p>

      <label className="session-showcase__toggle">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        <span>{t.enabledLabel}</span>
      </label>

      <label className="field">
        <span className="field__label">{t.titleLabel}</span>
        <input
          type="text"
          className="field__input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t.titlePlaceholder}
          maxLength={200}
        />
      </label>

      <label className="field">
        <span className="field__label">{t.taglineLabel}</span>
        <textarea
          className="field__input"
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
          placeholder={t.taglinePlaceholder}
          rows={2}
          maxLength={500}
        />
      </label>

      <div className="session-showcase__actions">
        <button type="button" className="hero__cta" onClick={onSave} disabled={saving || !dirty}>
          {saving ? t.saving : savedFlash ? t.saved : t.save}
        </button>
        {enabled && (
          <a
            className="link-btn mono"
            href={`${langPrefix}/projects`}
            target="_blank"
            rel="noreferrer"
          >
            {t.galleryLink}
          </a>
        )}
        {error && (
          <span className="mono session-page__save-error" role="alert">
            {t.saveError}
          </span>
        )}
      </div>
    </section>
  )
}
