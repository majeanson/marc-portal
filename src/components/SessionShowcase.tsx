import { useState } from 'react'
import { DICT, type Lang } from '../i18n'
import { patchSession, type SessionRow, type SessionTier } from '../lib/sessionsApi'

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
  const [tier, setTier] = useState<SessionTier | null>(session.tier ?? null)
  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [error, setError] = useState(false)
  // Cache-buster for the OG preview image. Bumped after every successful
  // save so the <img> below refetches /og/share/:id with a fresh edge-cache
  // entry. Initialised to the row's updated_at so a fresh mount also
  // doesn't paint a stale day-cached card.
  const [ogVersion, setOgVersion] = useState<number>(session.updated_at)
  const isPublished = session.showcased_at !== null
  const ogPreviewSrc = isPublished
    ? `/og/share/${session.id}?${lang === 'en' ? 'lang=en&' : ''}v=${ogVersion}`
    : null

  const dirty =
    enabled !== (session.showcased_at !== null) ||
    title.trim() !== (session.showcase_title ?? '') ||
    tagline.trim() !== (session.showcase_tagline ?? '') ||
    tier !== (session.tier ?? null)

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
        tier,
      })
      onPatched(r.session)
      setSavedFlash(true)
      setOgVersion(r.session.updated_at)
      setTimeout(() => setSavedFlash(false), 2000)
    } catch {
      setError(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="surface intake__step session-frame__panel session-showcase">
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
          className="input field__input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t.titlePlaceholder}
          maxLength={200}
        />
      </label>

      <label className="field">
        <span className="field__label">{t.taglineLabel}</span>
        <textarea
          className="input field__input"
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
          placeholder={t.taglinePlaceholder}
          rows={2}
          maxLength={500}
        />
      </label>

      <label className="field">
        <span className="field__label">{t.tierLabel}</span>
        <span className="field__hint">{t.tierHint}</span>
        <select
          className="input field__input"
          value={tier === null ? '' : String(tier)}
          onChange={(e) => {
            const v = e.target.value
            setTier(v === '' ? null : (Number(v) as SessionTier))
          }}
        >
          <option value="">{t.tierOptionNone}</option>
          <option value="0">{t.tierOption0}</option>
          <option value="1">{t.tierOption1}</option>
          <option value="2">{t.tierOption2}</option>
          <option value="3">{t.tierOption3}</option>
          <option value="4">{t.tierOption4}</option>
        </select>
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

      <div className="session-showcase__preview">
        <div className="session-showcase__preview-head">
          <span className="section__eyebrow">{t.previewHeading}</span>
          {ogPreviewSrc && (
            <a
              className="mono session-showcase__preview-open"
              href={ogPreviewSrc}
              target="_blank"
              rel="noreferrer"
            >
              {t.previewOpenInTab} ↗
            </a>
          )}
        </div>
        {ogPreviewSrc ? (
          <>
            <div className="session-showcase__preview-frame">
              <img
                key={ogVersion}
                src={ogPreviewSrc}
                alt={t.previewHeading}
                width={1200}
                height={630}
                loading="lazy"
                className="session-showcase__preview-img"
              />
            </div>
            <p className="field__hint session-showcase__preview-hint">{t.previewHint}</p>
          </>
        ) : (
          <p className="field__hint session-showcase__preview-hint">{t.previewDisabledHint}</p>
        )}
      </div>
    </section>
  )
}
