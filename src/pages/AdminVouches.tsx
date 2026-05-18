/**
 * Admin moderation surface for vouches (testimonials). Submissions land in
 * status 'pending' via the open /api/vouches endpoint; this page is the
 * only place Marc can flip them to approved / rejected, edit the visitor's
 * copy (typos, length, voice), or soft-delete spam.
 *
 * Sections (rendered in this order, each only if non-empty so the page
 * doesn't look half-built early on):
 *   1. Pending  — the queue, surfaced first because it's the active work
 *   2. Approved — what's currently public on /vouches and /share/:id
 *   3. Rejected — kept around so a misclick is recoverable
 *   4. Trash    — soft-deleted, restorable in one click
 *
 * Editing is inline (no modal): a single row expands into a form with name
 * + relationship + body + link. Save patches via PATCH /api/admin/vouches/:id
 * and replaces the row in-place with the server's fresh copy. Email and
 * created_at are immutable so they're shown read-only.
 */

import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Footer } from '../components/Footer'
import { Header } from '../components/Header'
import type { Lang } from '../i18n'
import { useAuth } from '../lib/authContext'
import { formatDateTime } from '../lib/format'
import {
  VOUCH_LIMITS,
  VOUCH_RELATIONSHIPS,
  deleteAdminVouch,
  listAdminVouches,
  partitionAdminVouches,
  patchAdminVouch,
  type AdminPatchInput,
  type AdminVouch,
  type AdminVouchSection,
  type VouchRelationship,
  type VouchStatus,
} from '../lib/vouchesApi'

// Structural shape, defined explicitly so child components can take `t: Copy`
// without the FR/EN literal types colliding. The FR object below is the
// reference shape; EN must mirror it.
interface Copy {
  title: string
  intro: string
  backToHub: string
  loading: string
  forbidden: string
  refreshing: string
  refresh: string
  section: Record<Section, string>
  sectionEmpty: Record<Section, string>
  allEmpty: string
  relationshipLabels: Record<VouchRelationship, string>
  statusLabels: Record<VouchStatus, string>
  submittedOn: string
  approvedOn: string
  deletedOn: string
  forSession: string
  openSession: string
  fromLabel: string
  approve: string
  reject: string
  moveBackToPending: string
  edit: string
  cancel: string
  save: string
  saving: string
  softDelete: string
  restore: string
  fieldName: string
  fieldRelationship: string
  fieldBody: string
  fieldLink: string
  bodyCount: (n: number) => string
  confirmDelete: string
  errorGeneric: string
}

type Section = AdminVouchSection

const COPY: Record<Lang, Copy> = {
  fr: {
    title: 'Témoignages',
    intro:
      'File de modération. Soumissions ouvertes : tout part en « en attente ». Approuve pour publier sur /vouches (et sur la page de projet si attribué).',
    backToHub: '← Console',
    loading: 'Chargement…',
    forbidden: 'Réservé à l’admin.',
    refreshing: 'Mise à jour…',
    refresh: '↻ Rafraîchir',
    section: {
      pending: 'En attente',
      approved: 'Publiés',
      rejected: 'Rejetés',
      trash: 'Corbeille',
    },
    sectionEmpty: {
      pending: 'Aucun témoignage en attente.',
      approved: 'Rien de publié pour l’instant.',
      rejected: 'Rien dans les rejetés.',
      trash: 'Corbeille vide.',
    },
    allEmpty:
      'Aucun témoignage reçu pour l’instant. Ils apparaîtront ici dès la première soumission.',
    relationshipLabels: {
      client: 'Client',
      colleague: 'Collègue',
      friend: 'Ami·e',
      other: 'Autre',
    } as Record<VouchRelationship, string>,
    statusLabels: {
      pending: 'en attente',
      approved: 'publié',
      rejected: 'rejeté',
    } as Record<VouchStatus, string>,
    submittedOn: 'Soumis le',
    approvedOn: 'Publié le',
    deletedOn: 'Supprimé le',
    forSession: 'Sur le projet',
    openSession: 'voir →',
    fromLabel: 'de',
    approve: 'Approuver',
    reject: 'Rejeter',
    moveBackToPending: 'Remettre en attente',
    edit: 'Éditer',
    cancel: 'Annuler',
    save: 'Sauvegarder',
    saving: 'Sauvegarde…',
    softDelete: 'Supprimer',
    restore: 'Restaurer',
    fieldName: 'Nom',
    fieldRelationship: 'Lien',
    fieldBody: 'Texte',
    fieldLink: 'Lien (optionnel)',
    bodyCount: (n: number) => `${n} / ${VOUCH_LIMITS.bodyMin}–${VOUCH_LIMITS.bodyMax}`,
    confirmDelete: 'Supprimer ce témoignage (récupérable depuis la corbeille) ?',
    errorGeneric: 'L’opération a échoué — réessaie ?',
  },
  en: {
    title: 'Vouches',
    intro:
      'Moderation queue. Submissions are open, so everything lands as pending. Approve to publish on /vouches (and on the linked project page when attributed).',
    backToHub: '← Console',
    loading: 'Loading…',
    forbidden: 'Admin only.',
    refreshing: 'Refreshing…',
    refresh: '↻ Refresh',
    section: {
      pending: 'Pending',
      approved: 'Published',
      rejected: 'Rejected',
      trash: 'Trash',
    },
    sectionEmpty: {
      pending: 'No vouches awaiting moderation.',
      approved: 'Nothing published yet.',
      rejected: 'Nothing rejected.',
      trash: 'Trash is empty.',
    },
    allEmpty: 'No vouches submitted yet. They’ll show up here on the first submission.',
    relationshipLabels: {
      client: 'Client',
      colleague: 'Colleague',
      friend: 'Friend',
      other: 'Other',
    } as Record<VouchRelationship, string>,
    statusLabels: {
      pending: 'pending',
      approved: 'published',
      rejected: 'rejected',
    } as Record<VouchStatus, string>,
    submittedOn: 'Submitted',
    approvedOn: 'Published',
    deletedOn: 'Deleted',
    forSession: 'On project',
    openSession: 'open →',
    fromLabel: 'from',
    approve: 'Approve',
    reject: 'Reject',
    moveBackToPending: 'Back to pending',
    edit: 'Edit',
    cancel: 'Cancel',
    save: 'Save',
    saving: 'Saving…',
    softDelete: 'Delete',
    restore: 'Restore',
    fieldName: 'Name',
    fieldRelationship: 'Relationship',
    fieldBody: 'Body',
    fieldLink: 'Link (optional)',
    bodyCount: (n: number) => `${n} / ${VOUCH_LIMITS.bodyMin}–${VOUCH_LIMITS.bodyMax}`,
    confirmDelete: 'Soft-delete this vouch (recoverable from trash)?',
    errorGeneric: 'That failed — try again?',
  },
}

export function AdminVouches({ lang }: { lang: Lang }) {
  const t = COPY[lang]
  const navigate = useNavigate()
  const { email, isAdmin, loading: authLoading } = useAuth()
  const [vouches, setVouches] = useState<AdminVouch[] | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [pending, setPending] = useState<Set<string>>(new Set())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [globalError, setGlobalError] = useState<string | null>(null)
  const langPrefix = lang === 'en' ? '/en' : ''

  const refresh = useCallback(async () => {
    setRefreshing(true)
    setGlobalError(null)
    try {
      const r = await listAdminVouches()
      setVouches(r.vouches)
    } catch {
      setGlobalError(t.errorGeneric)
    } finally {
      setRefreshing(false)
    }
  }, [t])

  useEffect(() => {
    document.title = `${t.title} — Marc`
  }, [t])

  useEffect(() => {
    if (authLoading) return
    if (!email) {
      navigate(`${langPrefix}/login`)
      return
    }
    if (!isAdmin) return
    // Inline the load (rather than calling refresh()) so the setState
    // pair is the effect's own work — the react-hooks lint rule flags
    // setState that happens via a hoisted callback.
    let cancelled = false
    ;(async () => {
      try {
        const r = await listAdminVouches()
        if (cancelled) return
        setVouches(r.vouches)
      } catch {
        if (!cancelled) setGlobalError(t.errorGeneric)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [authLoading, email, isAdmin, navigate, langPrefix, t])

  const markPending = (id: string, isPending: boolean) => {
    setPending((s) => {
      const next = new Set(s)
      if (isPending) next.add(id)
      else next.delete(id)
      return next
    })
  }

  // Replace a row in-place after a server mutation. Keeps the page from
  // jumping (no full re-list) and preserves any open edit state.
  const replaceRow = (next: AdminVouch) => {
    setVouches((prev) => (prev ? prev.map((v) => (v.id === next.id ? next : v)) : prev))
  }

  const patchRow = useCallback(
    async (id: string, input: AdminPatchInput) => {
      markPending(id, true)
      setGlobalError(null)
      try {
        const r = await patchAdminVouch(id, input)
        replaceRow(r.vouch)
        return true
      } catch {
        setGlobalError(t.errorGeneric)
        return false
      } finally {
        markPending(id, false)
      }
    },
    [t],
  )

  const onApprove = (v: AdminVouch) => patchRow(v.id, { status: 'approved' })
  const onReject = (v: AdminVouch) => patchRow(v.id, { status: 'rejected' })
  const onUnpend = (v: AdminVouch) => patchRow(v.id, { status: 'pending' })

  const onDelete = async (v: AdminVouch) => {
    if (!window.confirm(t.confirmDelete)) return
    markPending(v.id, true)
    try {
      await deleteAdminVouch(v.id)
      // Soft-delete moves the row to trash. Re-fetch is simpler than
      // splicing in the deleted_at locally.
      await refresh()
    } catch {
      setGlobalError(t.errorGeneric)
    } finally {
      markPending(v.id, false)
    }
  }

  const onRestore = (v: AdminVouch) => patchRow(v.id, { undelete: true })

  if (authLoading) {
    return (
      <>
        <Header lang={lang} />
        <main className="page">
          <p>{t.loading}</p>
        </main>
        <Footer lang={lang} />
      </>
    )
  }

  if (!email || !isAdmin) {
    return (
      <>
        <Header lang={lang} />
        <main className="page">
          <section className="page__panel">
            <p>{t.forbidden}</p>
          </section>
        </main>
        <Footer lang={lang} />
      </>
    )
  }

  // Partition once, render four sections in the operator-friendly order:
  // active work (pending) first, then the published list (so Marc can spot-
  // check), then rejected and trash for recovery.
  const grouped = partitionAdminVouches(vouches ?? [])

  return (
    <>
      <Header lang={lang} />
      <main className="page">
        <section className="page__panel">
          <p>
            <Link to={`${langPrefix}/admin`}>{t.backToHub}</Link>
          </p>
          <h1>{t.title}</h1>
          <p>{t.intro}</p>

          <div role="status" aria-live="polite" className="mono session-page__saving">
            {refreshing ? t.refreshing : ''}
          </div>

          {globalError && (
            <p role="alert" className="form__error">
              {globalError}
            </p>
          )}

          {vouches === null ? (
            <p>{t.loading}</p>
          ) : vouches.length === 0 ? (
            // Fresh install / zero submissions ever. Rendering four empty
            // section scaffolds reads as broken — show a single quiet line
            // until at least one vouch has landed.
            <p className="field__hint admin-vouches__zero">{t.allEmpty}</p>
          ) : (
            <>
              <VouchSection
                lang={lang}
                t={t}
                section="pending"
                rows={grouped.pending}
                editingId={editingId}
                setEditingId={setEditingId}
                pendingIds={pending}
                onApprove={onApprove}
                onReject={onReject}
                onUnpend={onUnpend}
                onDelete={onDelete}
                onRestore={onRestore}
                onPatchSave={patchRow}
                langPrefix={langPrefix}
              />
              <VouchSection
                lang={lang}
                t={t}
                section="approved"
                rows={grouped.approved}
                editingId={editingId}
                setEditingId={setEditingId}
                pendingIds={pending}
                onApprove={onApprove}
                onReject={onReject}
                onUnpend={onUnpend}
                onDelete={onDelete}
                onRestore={onRestore}
                onPatchSave={patchRow}
                langPrefix={langPrefix}
              />
              <VouchSection
                lang={lang}
                t={t}
                section="rejected"
                rows={grouped.rejected}
                editingId={editingId}
                setEditingId={setEditingId}
                pendingIds={pending}
                onApprove={onApprove}
                onReject={onReject}
                onUnpend={onUnpend}
                onDelete={onDelete}
                onRestore={onRestore}
                onPatchSave={patchRow}
                langPrefix={langPrefix}
              />
              <VouchSection
                lang={lang}
                t={t}
                section="trash"
                rows={grouped.trash}
                editingId={editingId}
                setEditingId={setEditingId}
                pendingIds={pending}
                onApprove={onApprove}
                onReject={onReject}
                onUnpend={onUnpend}
                onDelete={onDelete}
                onRestore={onRestore}
                onPatchSave={patchRow}
                langPrefix={langPrefix}
              />
            </>
          )}

          <button
            type="button"
            className="link-btn mono"
            onClick={() => void refresh()}
            style={{ marginTop: 16 }}
          >
            {t.refresh}
          </button>
        </section>
      </main>
      <Footer lang={lang} />
    </>
  )
}

interface SectionProps {
  lang: Lang
  t: Copy
  section: Section
  rows: AdminVouch[]
  editingId: string | null
  setEditingId: (id: string | null) => void
  pendingIds: Set<string>
  onApprove: (v: AdminVouch) => Promise<boolean>
  onReject: (v: AdminVouch) => Promise<boolean>
  onUnpend: (v: AdminVouch) => Promise<boolean>
  onDelete: (v: AdminVouch) => Promise<void>
  onRestore: (v: AdminVouch) => Promise<boolean>
  onPatchSave: (id: string, input: AdminPatchInput) => Promise<boolean>
  langPrefix: string
}

function VouchSection(props: SectionProps) {
  const { t, section, rows } = props
  return (
    <section className="admin-vouches__section">
      <h2 className="admin-vouches__section-title mono">
        {t.section[section]} <span className="admin-vouches__section-count">({rows.length})</span>
      </h2>
      {rows.length === 0 ? (
        <p className="field__hint">{t.sectionEmpty[section]}</p>
      ) : (
        <ul className="admin-vouches__list">
          {rows.map((v) => (
            <VouchRow key={v.id} v={v} {...props} />
          ))}
        </ul>
      )}
    </section>
  )
}

interface RowProps extends SectionProps {
  v: AdminVouch
}

function VouchRow(props: RowProps) {
  const {
    lang,
    t,
    v,
    section,
    editingId,
    setEditingId,
    pendingIds,
    onApprove,
    onReject,
    onUnpend,
    onDelete,
    onRestore,
    onPatchSave,
    langPrefix,
  } = props
  const isEditing = editingId === v.id
  const isPending = pendingIds.has(v.id)
  const relLabel =
    t.relationshipLabels[v.author_relationship as VouchRelationship] ?? v.author_relationship

  return (
    <li className="admin-vouches__row">
      <header className="admin-vouches__row-head">
        <div className="admin-vouches__row-meta">
          <span className={`status-pill status-pill--${v.status}`}>{t.statusLabels[v.status]}</span>
          <span className="admin-vouches__row-date mono">
            {section === 'trash' && v.deleted_at
              ? `${t.deletedOn} ${formatDateTime(v.deleted_at, lang)}`
              : v.status === 'approved' && v.approved_at
                ? `${t.approvedOn} ${formatDateTime(v.approved_at, lang)}`
                : `${t.submittedOn} ${formatDateTime(v.created_at, lang)}`}
          </span>
          {v.session_id && (
            <span className="admin-vouches__row-session mono">
              {t.forSession}{' '}
              <a href={`${langPrefix}/share/${v.session_id}`} target="_blank" rel="noreferrer">
                {v.session_id.slice(0, 8)}… {t.openSession}
              </a>
            </span>
          )}
        </div>
      </header>

      {isEditing ? (
        <VouchEditForm
          v={v}
          t={t}
          isPending={isPending}
          onCancel={() => setEditingId(null)}
          onSave={async (input) => {
            const ok = await onPatchSave(v.id, input)
            if (ok) setEditingId(null)
          }}
        />
      ) : (
        <>
          <blockquote className="admin-vouches__row-body">
            <p>{v.body}</p>
          </blockquote>
          <p className="admin-vouches__row-attribution">
            <strong>{v.author_name}</strong> · {relLabel} · {t.fromLabel}{' '}
            <code>{v.author_email}</code>
            {v.link_url && (
              <>
                {' · '}
                <a href={v.link_url} target="_blank" rel="noreferrer noopener nofollow">
                  {v.link_url}
                </a>
              </>
            )}
          </p>
          <div className="admin-vouches__row-actions">
            {section === 'pending' && (
              <>
                <button
                  type="button"
                  className="link-btn mono"
                  onClick={() => void onApprove(v)}
                  disabled={isPending}
                >
                  {t.approve}
                </button>
                <button
                  type="button"
                  className="link-btn mono"
                  onClick={() => void onReject(v)}
                  disabled={isPending}
                >
                  {t.reject}
                </button>
              </>
            )}
            {(section === 'approved' || section === 'rejected') && (
              <button
                type="button"
                className="link-btn mono"
                onClick={() => void onUnpend(v)}
                disabled={isPending}
              >
                {t.moveBackToPending}
              </button>
            )}
            {section !== 'trash' && (
              <button
                type="button"
                className="link-btn mono"
                onClick={() => setEditingId(v.id)}
                disabled={isPending}
              >
                {t.edit}
              </button>
            )}
            {section === 'trash' ? (
              <button
                type="button"
                className="link-btn mono"
                onClick={() => void onRestore(v)}
                disabled={isPending}
              >
                {t.restore}
              </button>
            ) : (
              <button
                type="button"
                className="link-btn link-btn--danger mono"
                onClick={() => void onDelete(v)}
                disabled={isPending}
              >
                {t.softDelete}
              </button>
            )}
          </div>
        </>
      )}
    </li>
  )
}

function VouchEditForm({
  v,
  t,
  isPending,
  onCancel,
  onSave,
}: {
  v: AdminVouch
  t: Copy
  isPending: boolean
  onCancel: () => void
  onSave: (input: AdminPatchInput) => void | Promise<void>
}) {
  const [name, setName] = useState(v.author_name)
  const [rel, setRel] = useState<VouchRelationship>(
    (v.author_relationship as VouchRelationship) ?? 'other',
  )
  const [body, setBody] = useState(v.body)
  const [linkUrl, setLinkUrl] = useState(v.link_url ?? '')

  // Mirror server-side length rules so the save button greys out before a
  // 400 round-trip happens. Server is still authoritative; these just
  // catch the obvious cases inline.
  const trimmedName = name.trim()
  const trimmedBody = body.trim()
  const nameValid =
    trimmedName.length >= VOUCH_LIMITS.nameMin && trimmedName.length <= VOUCH_LIMITS.nameMax
  const bodyValid =
    trimmedBody.length >= VOUCH_LIMITS.bodyMin && trimmedBody.length <= VOUCH_LIMITS.bodyMax
  const bodyTooShort = trimmedBody.length < VOUCH_LIMITS.bodyMin

  // Build a minimal PATCH — only include fields the operator actually
  // touched. Keeps the server's validation surface tight and the diff log
  // readable. If nothing changed, skip the round-trip entirely and just
  // close the edit form (server would no-op anyway).
  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!nameValid || !bodyValid) return
    const input: AdminPatchInput = {}
    if (trimmedName !== v.author_name) input.authorName = trimmedName
    if (rel !== v.author_relationship) input.authorRelationship = rel
    if (trimmedBody !== v.body) input.body = trimmedBody
    const nextLink = linkUrl.trim()
    const prevLink = v.link_url ?? ''
    if (nextLink !== prevLink) input.linkUrl = nextLink || null
    if (Object.keys(input).length === 0) {
      onCancel()
      return
    }
    void onSave(input)
  }

  const canSave = nameValid && bodyValid && !isPending

  return (
    <form onSubmit={submit} className="admin-vouches__edit">
      <div className="field">
        <label htmlFor={`v-name-${v.id}`} className="field__label">
          {t.fieldName}
        </label>
        <input
          id={`v-name-${v.id}`}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="field__input"
          maxLength={VOUCH_LIMITS.nameMax}
          required
        />
      </div>
      <div className="field">
        <label htmlFor={`v-rel-${v.id}`} className="field__label">
          {t.fieldRelationship}
        </label>
        <select
          id={`v-rel-${v.id}`}
          value={rel}
          onChange={(e) => setRel(e.target.value as VouchRelationship)}
          className="field__input"
        >
          {VOUCH_RELATIONSHIPS.map((r) => (
            <option key={r} value={r}>
              {t.relationshipLabels[r]}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor={`v-body-${v.id}`} className="field__label">
          {t.fieldBody}
        </label>
        <textarea
          id={`v-body-${v.id}`}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="field__input"
          rows={5}
          maxLength={VOUCH_LIMITS.bodyMax}
          required
        />
        <p className={`field__hint mono${bodyTooShort ? ' field__hint--error' : ''}`}>
          {t.bodyCount(trimmedBody.length)}
        </p>
      </div>
      <div className="field">
        <label htmlFor={`v-link-${v.id}`} className="field__label">
          {t.fieldLink}
        </label>
        <input
          id={`v-link-${v.id}`}
          type="url"
          value={linkUrl}
          onChange={(e) => setLinkUrl(e.target.value)}
          className="field__input"
          maxLength={VOUCH_LIMITS.linkUrlMax}
        />
      </div>
      <div className="admin-vouches__edit-actions">
        <button type="submit" className="link-btn mono" disabled={!canSave}>
          {isPending ? t.saving : t.save}
        </button>
        <button type="button" className="link-btn mono" onClick={onCancel} disabled={isPending}>
          {t.cancel}
        </button>
      </div>
    </form>
  )
}
