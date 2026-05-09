import { useState } from 'react'
import type { Lang } from '../i18n'
import { DICT } from '../i18n'
import { formatDate } from '../lib/format'
import {
  type AdvancementFlags,
  type AdvancementRow,
  createAdvancement,
  deleteAdvancement,
  patchAdvancement,
} from '../lib/advancementsApi'

/**
 * Per-session advancement log. Admin posts entries describing what was built;
 * each entry can carry a Cloudflare Pages deploy URL (auto-stamped by CI) so
 * the visitor can iframe-time-travel through builds. Mirrors the feature.json
 * revisions[] pattern from RevisionLog, ported to D1-backed session rows.
 *
 * State is lifted to the parent (SessionPage) so the Activity timeline can
 * also show advancements interleaved with status_history. Parent fetches and
 * passes items + setters down.
 */
export function SessionAdvancements({
  sessionId,
  isAdmin,
  lang,
  repoUrl,
  items,
  loading,
  onCreated,
  onPatched,
  onDeleted,
}: {
  sessionId: string
  isAdmin: boolean
  lang: Lang
  /** GitHub repo URL for commit links. Optional. */
  repoUrl?: string
  items: AdvancementRow[] | null
  loading: boolean
  onCreated: (row: AdvancementRow) => void
  onPatched: (row: AdvancementRow) => void
  onDeleted: (id: string) => void
}) {
  const t = DICT[lang].sessionAdvancements
  const [error, setError] = useState<string | null>(null)
  const [openBuild, setOpenBuild] = useState<string | null>(null)

  const handleDeleted = (id: string) => {
    onDeleted(id)
    setOpenBuild((prev) => (prev === id ? null : prev))
  }

  if (items === null && loading) {
    return (
      <section className="intake__step session-frame__panel session-advancements">
        <h2>{t.heading}</h2>
        <p className="mono">{t.loading}</p>
      </section>
    )
  }

  // Headline entry: most-recent showAsCurrentBuild, falling back to nothing
  // (don't auto-pick — admin opts in).
  const current = items?.find((i) => i.flags.showAsCurrentBuild) ?? null

  return (
    <section className="intake__step session-frame__panel session-advancements">
      <h2>{t.heading}</h2>
      <p className="field__hint session-advancements__hint">{t.subtitle}</p>

      {isAdmin && (
        <AdvancementForm
          sessionId={sessionId}
          lang={lang}
          onCreated={onCreated}
          onError={setError}
        />
      )}

      {error && (
        <p className="session-page__save-error mono" role="alert">
          {error}
        </p>
      )}

      {items === null || items.length === 0 ? (
        <p className="thread__empty">{t.empty}</p>
      ) : (
        <>
          {current && (
            <div className="session-advancements__current">
              <div className="session-advancements__current-eyebrow mono">{t.currentLabel}</div>
              <AdvancementEntry
                row={current}
                lang={lang}
                isAdmin={isAdmin}
                repoUrl={repoUrl}
                isOpen={openBuild === current.id}
                onToggleBuild={() =>
                  setOpenBuild((prev) => (prev === current.id ? null : current.id))
                }
                onPatched={onPatched}
                onDeleted={handleDeleted}
                onError={setError}
                featured
              />
            </div>
          )}
          <ol className="session-advancements__list">
            {items
              .filter((i) => i !== current)
              .map((row) => (
                <AdvancementEntry
                  key={row.id}
                  row={row}
                  lang={lang}
                  isAdmin={isAdmin}
                  repoUrl={repoUrl}
                  isOpen={openBuild === row.id}
                  onToggleBuild={() =>
                    setOpenBuild((prev) => (prev === row.id ? null : row.id))
                  }
                  onPatched={onPatched}
                  onDeleted={handleDeleted}
                  onError={setError}
                />
              ))}
          </ol>
        </>
      )}
    </section>
  )
}

function AdvancementForm({
  sessionId,
  lang,
  onCreated,
  onError,
}: {
  sessionId: string
  lang: Lang
  onCreated: (row: AdvancementRow) => void
  onError: (msg: string | null) => void
}) {
  const t = DICT[lang].sessionAdvancements
  const [label, setLabel] = useState('')
  const [body, setBody] = useState('')
  const [iframePath, setIframePath] = useState('')
  const [allowedForPublic, setAllowedForPublic] = useState(false)
  const [showInConversation, setShowInConversation] = useState(false)
  const [showAsCurrentBuild, setShowAsCurrentBuild] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const reset = () => {
    setLabel('')
    setBody('')
    setIframePath('')
    setAllowedForPublic(false)
    setShowInConversation(false)
    setShowAsCurrentBuild(false)
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    if (!label.trim()) return
    setSubmitting(true)
    onError(null)
    try {
      const r = await createAdvancement(sessionId, {
        label: label.trim(),
        body: body.trim(),
        iframePath: iframePath.trim() || null,
        flags: { allowedForPublic, showInConversation, showAsCurrentBuild },
      })
      onCreated(r.advancement)
      reset()
    } catch (err) {
      onError(err instanceof Error ? err.message : t.formError)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="session-advancements__form" onSubmit={onSubmit}>
      <div className="session-advancements__form-eyebrow mono">{t.formEyebrow}</div>
      <label className="field">
        <span className="field__label">{t.formLabel}</span>
        <input
          type="text"
          className="field__input"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={t.formLabelPlaceholder}
          maxLength={200}
          required
        />
      </label>
      <label className="field">
        <span className="field__label">{t.formBody}</span>
        <textarea
          className="field__input"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          placeholder={t.formBodyPlaceholder}
        />
      </label>
      <label className="field">
        <span className="field__label">{t.formIframePath}</span>
        <input
          type="text"
          className="field__input"
          value={iframePath}
          onChange={(e) => setIframePath(e.target.value)}
          placeholder={t.formIframePathPlaceholder}
        />
        <span className="field__hint">{t.formIframePathHint}</span>
      </label>
      <fieldset className="session-advancements__flags">
        <legend className="field__label">{t.formFlags}</legend>
        <label className="session-advancements__flag">
          <input
            type="checkbox"
            checked={allowedForPublic}
            onChange={(e) => setAllowedForPublic(e.target.checked)}
          />
          <span>{t.flagAllowedForPublic}</span>
        </label>
        <label className="session-advancements__flag">
          <input
            type="checkbox"
            checked={showInConversation}
            onChange={(e) => setShowInConversation(e.target.checked)}
          />
          <span>{t.flagShowInConversation}</span>
        </label>
        <label className="session-advancements__flag">
          <input
            type="checkbox"
            checked={showAsCurrentBuild}
            onChange={(e) => setShowAsCurrentBuild(e.target.checked)}
          />
          <span>{t.flagShowAsCurrentBuild}</span>
        </label>
      </fieldset>
      <div className="session-advancements__form-actions">
        <button
          type="submit"
          className="hero__cta"
          disabled={submitting || !label.trim()}
        >
          {submitting ? t.formSubmitting : t.formSubmit}
        </button>
        <span className="field__hint">{t.formStampHint}</span>
      </div>
    </form>
  )
}

function AdvancementEntry({
  row,
  lang,
  isAdmin,
  repoUrl,
  isOpen,
  onToggleBuild,
  onPatched,
  onDeleted,
  onError,
  featured,
}: {
  row: AdvancementRow
  lang: Lang
  isAdmin: boolean
  repoUrl?: string
  isOpen: boolean
  onToggleBuild: () => void
  onPatched: (row: AdvancementRow) => void
  onDeleted: (id: string) => void
  onError: (msg: string | null) => void
  featured?: boolean
}) {
  const t = DICT[lang].sessionAdvancements
  const [editing, setEditing] = useState(false)
  const canShowBuild = !!row.build_url
  const iframeSrc = canShowBuild
    ? `${row.build_url}${row.iframe_path ?? ''}`
    : null
  const commitHref = row.commit_sha && repoUrl ? `${repoUrl}/commit/${row.commit_sha}` : null

  const onDelete = async () => {
    if (!window.confirm(t.confirmDelete(row.label))) return
    onError(null)
    try {
      await deleteAdvancement(row.session_id, row.id)
      onDeleted(row.id)
    } catch (err) {
      onError(err instanceof Error ? err.message : t.formError)
    }
  }

  const onToggleFlag = async (key: keyof AdvancementFlags) => {
    onError(null)
    try {
      const r = await patchAdvancement(row.session_id, row.id, {
        flags: { ...row.flags, [key]: !row.flags[key] },
      })
      onPatched(r.advancement)
    } catch (err) {
      onError(err instanceof Error ? err.message : t.formError)
    }
  }

  return (
    <li
      className={`session-advancements__entry${featured ? ' session-advancements__entry--featured' : ''}`}
    >
      <div className="session-advancements__head">
        <span className="session-advancements__date mono">{formatDate(row.date, lang)}</span>
        <span className="session-advancements__label">{row.label}</span>
        {row.flags.allowedForPublic && (
          <span className="session-advancements__flag-pill mono">{t.pillPublic}</span>
        )}
        {row.flags.showInConversation && (
          <span className="session-advancements__flag-pill mono">{t.pillInThread}</span>
        )}
        {!canShowBuild && (
          <span className="session-advancements__flag-pill session-advancements__flag-pill--pending mono">
            {t.pillPendingStamp}
          </span>
        )}
      </div>
      {row.body && <p className="session-advancements__body">{row.body}</p>}
      {(canShowBuild || commitHref) && (
        <div className="session-advancements__build-row">
          {canShowBuild && (
            <button
              type="button"
              className="rev-log__build-toggle mono"
              onClick={onToggleBuild}
              aria-expanded={isOpen}
            >
              {isOpen ? t.hideBuild : t.viewBuild}
            </button>
          )}
          {iframeSrc && (
            <a
              className="rev-log__open-tab mono"
              href={iframeSrc}
              target="_blank"
              rel="noreferrer"
            >
              {t.openInNewTab}
            </a>
          )}
          {commitHref && (
            <a
              className="rev-log__commit mono"
              href={commitHref}
              target="_blank"
              rel="noreferrer"
            >
              {t.commitLabel} {row.commit_sha?.slice(0, 7)}
            </a>
          )}
        </div>
      )}
      {isOpen && iframeSrc && (
        <div className="rev-log__build-frame session-advancements__frame">
          <p className="rev-log__build-hint mono">{t.buildHint}</p>
          <iframe
            src={iframeSrc}
            title={`${t.iframeTitle}: ${row.label}`}
            loading="lazy"
            sandbox="allow-scripts allow-same-origin allow-forms"
          />
        </div>
      )}
      {isAdmin && (
        <div className="session-advancements__admin-row">
          <button
            type="button"
            className="link-btn mono"
            onClick={() => setEditing((v) => !v)}
            aria-pressed={editing}
          >
            {editing ? t.doneEditing : t.editEntry}
          </button>
          <button
            type="button"
            className="link-btn mono session-advancements__danger"
            onClick={onDelete}
          >
            {t.deleteEntry}
          </button>
        </div>
      )}
      {isAdmin && editing && (
        <EditPanel
          row={row}
          lang={lang}
          onPatched={(next) => {
            onPatched(next)
            setEditing(false)
          }}
          onError={onError}
          onToggleFlag={onToggleFlag}
        />
      )}
    </li>
  )
}

function EditPanel({
  row,
  lang,
  onPatched,
  onError,
  onToggleFlag,
}: {
  row: AdvancementRow
  lang: Lang
  onPatched: (row: AdvancementRow) => void
  onError: (msg: string | null) => void
  onToggleFlag: (key: keyof AdvancementFlags) => void
}) {
  const t = DICT[lang].sessionAdvancements
  const [label, setLabel] = useState(row.label)
  const [body, setBody] = useState(row.body)
  const [iframePath, setIframePath] = useState(row.iframe_path ?? '')
  const [saving, setSaving] = useState(false)

  const onSave = async () => {
    if (saving) return
    setSaving(true)
    onError(null)
    try {
      const r = await patchAdvancement(row.session_id, row.id, {
        label: label.trim(),
        body: body.trim(),
        iframePath: iframePath.trim() || null,
      })
      onPatched(r.advancement)
    } catch (err) {
      onError(err instanceof Error ? err.message : t.formError)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="session-advancements__edit">
      <label className="field">
        <span className="field__label">{t.formLabel}</span>
        <input
          type="text"
          className="field__input"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          maxLength={200}
        />
      </label>
      <label className="field">
        <span className="field__label">{t.formBody}</span>
        <textarea
          className="field__input"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
        />
      </label>
      <label className="field">
        <span className="field__label">{t.formIframePath}</span>
        <input
          type="text"
          className="field__input"
          value={iframePath}
          onChange={(e) => setIframePath(e.target.value)}
        />
      </label>
      <fieldset className="session-advancements__flags">
        <legend className="field__label">{t.formFlags}</legend>
        <label className="session-advancements__flag">
          <input
            type="checkbox"
            checked={!!row.flags.allowedForPublic}
            onChange={() => onToggleFlag('allowedForPublic')}
          />
          <span>{t.flagAllowedForPublic}</span>
        </label>
        <label className="session-advancements__flag">
          <input
            type="checkbox"
            checked={!!row.flags.showInConversation}
            onChange={() => onToggleFlag('showInConversation')}
          />
          <span>{t.flagShowInConversation}</span>
        </label>
        <label className="session-advancements__flag">
          <input
            type="checkbox"
            checked={!!row.flags.showAsCurrentBuild}
            onChange={() => onToggleFlag('showAsCurrentBuild')}
          />
          <span>{t.flagShowAsCurrentBuild}</span>
        </label>
      </fieldset>
      <div className="session-advancements__form-actions">
        <button type="button" className="hero__cta" onClick={onSave} disabled={saving}>
          {saving ? t.saving : t.save}
        </button>
      </div>
    </div>
  )
}
