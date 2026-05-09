import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { Lang } from '../i18n'
import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import { useAuth } from '../lib/authContext'
import {
  deleteSession,
  getSession,
  listMessages,
  parseStatusHistory,
  patchSession,
  postMessage,
  type MessageRow,
  type SessionRow,
  type SessionStatus,
} from '../lib/sessionsApi'
import { ApiError } from '../lib/api'
import type { Account } from '../components/intake/AccountStep'
import type { FormData } from '../components/intake/TypeForm'
import { IntakeSummary } from '../components/intake/IntakeSummary'
import type { ProblemType } from '../lib/intakeSchemas'
import { computeSla, formatDateTime, formatRelativeWindow } from '../lib/format'
import { markSeen } from '../lib/unread'
import {
  attachmentUrl,
  deleteAttachment,
  formatFileSize,
  uploadAttachment,
  type AttachmentRow,
} from '../lib/attachmentsApi'

interface ParsedIntake {
  type: ProblemType
  account: Account
  formData: FormData
  submittedAt: string
  waitlist?: boolean
  lang?: Lang
}

function tryParseIntake(raw: string | null): ParsedIntake | null {
  if (!raw) return null
  try {
    const obj = JSON.parse(raw) as Partial<ParsedIntake>
    if (
      obj &&
      typeof obj === 'object' &&
      typeof obj.type === 'string' &&
      obj.account &&
      typeof obj.account.email === 'string' &&
      typeof obj.submittedAt === 'string'
    ) {
      return {
        type: obj.type as ProblemType,
        account: obj.account,
        formData: (obj.formData ?? {}) as FormData,
        submittedAt: obj.submittedAt,
        waitlist: obj.waitlist,
        lang: obj.lang,
      }
    }
  } catch {
    // fall through
  }
  return null
}

const COPY = {
  fr: {
    title: 'Session',
    loading: 'Chargement…',
    notFound: 'Session introuvable.',
    forbidden: 'Tu n’as pas accès à cette session.',
    threadHeading: 'Discussion',
    none: 'Aucun message pour l’instant.',
    placeholder: 'Écris un message…',
    sending: 'Envoi…',
    send: 'Envoyer',
    you: 'Toi',
    marc: 'Marc',
    visitor: 'Visiteur',
    statusLabel: 'Statut',
    changeStatus: 'Changer le statut',
    intakeHeading: 'Intake',
    noIntake: 'Aucun contenu d’intake — la session a été démarrée vide.',
    backToInbox: '← Retour à la liste',
    backToMe: '← Retour à mes sessions',
    refreshing: 'Mise à jour…',
    editIntake: 'Modifier',
    doneEditing: 'Terminer',
    saving: 'Enregistrement…',
    saveError: 'Échec de l’enregistrement — réessaie.',
    editHint: 'Clique un champ pour le modifier, puis clique ailleurs pour enregistrer.',
    staleConflict:
      'Cette session a été modifiée ailleurs. On l’a rechargée — ré-applique ton changement.',
    requiredEmptyConfirm: 'Ce champ est requis. Le vider quand même ?',
    typeChangeWarn: 'Changer le type peut rendre tes autres réponses invalides. Continuer ?',
    withdrawCta: 'Retirer cette session',
    withdrawConfirm:
      'Retirer cette session du portail ? Cette action ne peut pas être annulée par toi-même.',
    withdrawn: 'Session retirée.',
    timelineHeading: 'Activité',
    timelineCreated: (d: string) => `Créée le ${d}`,
    timelineStatus: (from: string, to: string, by: string, d: string) =>
      `${from} → ${to} · par ${by} · ${d}`,
    timelineEmpty: 'Aucun changement de statut pour l’instant.',
    slaPrefix: 'Réponse de Marc',
    slaOverdue: 'En retard',
    attachLabel: 'Joindre un fichier',
    attaching: 'Téléversement…',
    attachError: 'Téléversement échoué',
    attachRemove: 'Retirer',
    attachOpen: 'Ouvrir',
    attachMax: 'Max 5 fichiers, 10 Mo chacun',
  },
  en: {
    title: 'Session',
    loading: 'Loading…',
    notFound: 'Session not found.',
    forbidden: "You don't have access to this session.",
    threadHeading: 'Thread',
    none: 'No messages yet.',
    placeholder: 'Write a message…',
    sending: 'Sending…',
    send: 'Send',
    you: 'You',
    marc: 'Marc',
    visitor: 'Visitor',
    statusLabel: 'Status',
    changeStatus: 'Change status',
    intakeHeading: 'Intake',
    noIntake: 'No intake content — session was started empty.',
    backToInbox: '← Back to inbox',
    backToMe: '← Back to my sessions',
    refreshing: 'Refreshing…',
    editIntake: 'Edit',
    doneEditing: 'Done',
    saving: 'Saving…',
    saveError: 'Save failed — try again.',
    editHint: 'Click any field to edit, then click outside to save.',
    staleConflict:
      'This session was changed somewhere else. We reloaded it — re-apply your change.',
    requiredEmptyConfirm: 'This field is required. Clear it anyway?',
    typeChangeWarn: 'Changing the type may invalidate your other answers. Continue?',
    withdrawCta: 'Withdraw this session',
    withdrawConfirm: "Withdraw this session from the portal? You can't undo this yourself.",
    withdrawn: 'Session withdrawn.',
    timelineHeading: 'Activity',
    timelineCreated: (d: string) => `Created on ${d}`,
    timelineStatus: (from: string, to: string, by: string, d: string) =>
      `${from} → ${to} · by ${by} · ${d}`,
    timelineEmpty: 'No status changes yet.',
    slaPrefix: "Marc's reply",
    slaOverdue: 'Overdue',
    attachLabel: 'Attach file',
    attaching: 'Uploading…',
    attachError: 'Upload failed',
    attachRemove: 'Remove',
    attachOpen: 'Open',
    attachMax: 'Max 5 files, 10 MB each',
  },
} as const

const STATUSES: SessionStatus[] = ['draft', 'triage', 'active', 'shipped', 'rejected']

export function SessionPage({ lang }: { lang: Lang }) {
  const t = COPY[lang]
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { email, isAdmin, loading: authLoading } = useAuth()
  const [session, setSession] = useState<SessionRow | null>(null)
  const [messages, setMessages] = useState<MessageRow[]>([])
  const [error, setError] = useState<'forbidden' | 'notfound' | null>(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const [staleConflict, setStaleConflict] = useState(false)
  const [withdrawing, setWithdrawing] = useState(false)
  // Pending attachments — uploaded but not yet linked to a message. Cleared
  // on successful send (server links them) or on explicit remove.
  const [pendingAttachments, setPendingAttachments] = useState<AttachmentRow[]>([])
  const [uploading, setUploading] = useState(false)
  const [attachError, setAttachError] = useState<string | null>(null)
  const langPrefix = lang === 'en' ? '/en' : ''

  // Refresh callable from event handlers only (post-send, visibility).
  // NOT called from inside a useEffect body — that would trip the
  // react-hooks/set-state-in-effect rule due to the synchronous setRefreshing.
  const refresh = useCallback(async () => {
    if (!id) return
    setRefreshing(true)
    try {
      const [s, m] = await Promise.all([getSession(id), listMessages(id)])
      setSession(s.session)
      setMessages(m.messages)
      setError(null)
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 404) setError('notfound')
        else if (err.status === 403) setError('forbidden')
        else if (err.status === 401) navigate(`${langPrefix}/login`)
      }
    } finally {
      setRefreshing(false)
    }
  }, [id, navigate, langPrefix])

  useEffect(() => {
    document.title = `${t.title} — Marc`
  }, [t])

  // Mark this session as seen (clears the /me NEW badge) any time we have a
  // fresh row in hand. Pure localStorage write — no React state mutation, so
  // it's effect-safe.
  useEffect(() => {
    if (session) markSeen(session)
  }, [session])

  // Initial load. Inline async with cancelled flag — setState only fires in
  // .then-equivalent callback position (after await), which the lint rule
  // accepts. Avoids calling refresh() (which has a synchronous setState).
  useEffect(() => {
    if (authLoading || !id) return
    if (!email) {
      navigate(`${langPrefix}/login`)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const [s, m] = await Promise.all([getSession(id), listMessages(id)])
        if (cancelled) return
        setSession(s.session)
        setMessages(m.messages)
        setError(null)
      } catch (err) {
        if (cancelled) return
        if (err instanceof ApiError) {
          if (err.status === 404) setError('notfound')
          else if (err.status === 403) setError('forbidden')
          else if (err.status === 401) navigate(`${langPrefix}/login`)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [authLoading, email, id, navigate, langPrefix])

  // Visibility-based polling (per the bedrock decision: never push, never WS).
  // refresh() is invoked from inside the event handler, not the effect body.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [refresh])

  const onSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id || sending) return
    const trimmed = draft.trim()
    if (!trimmed && pendingAttachments.length === 0) return
    setSending(true)
    try {
      await postMessage(
        id,
        trimmed,
        pendingAttachments.map((a) => a.id),
      )
      setDraft('')
      setPendingAttachments([])
      await refresh()
    } finally {
      setSending(false)
    }
  }

  const onAttach = async (files: FileList | null) => {
    if (!id || !files || files.length === 0) return
    setAttachError(null)
    // Sequential — keeps progress legible and avoids parallel rate-limit hits.
    for (const file of Array.from(files)) {
      if (pendingAttachments.length >= 5) break
      setUploading(true)
      try {
        const r = await uploadAttachment(id, file)
        setPendingAttachments((prev) => [...prev, r.attachment])
      } catch (err) {
        setAttachError(err instanceof ApiError ? err.message : t.attachError)
        break
      } finally {
        setUploading(false)
      }
    }
  }

  const onRemoveAttachment = async (att: AttachmentRow) => {
    if (!id) return
    // Optimistically drop from UI; server delete is best-effort.
    setPendingAttachments((prev) => prev.filter((a) => a.id !== att.id))
    try {
      await deleteAttachment(id, att.id)
    } catch {
      // Restore on failure so user can retry.
      setPendingAttachments((prev) => [...prev, att])
    }
  }

  const onStatusChange = async (next: SessionStatus) => {
    if (!id || !session) return
    try {
      const r = await patchSession(id, { status: next, ifUpdatedAt: session.updated_at })
      setSession(r.session)
      setStaleConflict(false)
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setStaleConflict(true)
        await refresh()
      }
      // Other errors: server-side check refuses non-admins anyway, ignore.
    }
  }

  // Optimistic intake save. IntakeSummary updates its visible value
  // optimistically via local input state; here we mirror that by writing
  // intake_json before the request. On 409 (concurrent edit) we refresh
  // and surface a stale-conflict notice; on other failures we revert and
  // show the inline error pill so the user can retry.
  const onIntakeChange = async (next: {
    account: Account
    values: FormData
    type?: ProblemType
  }) => {
    if (!id || !session) return
    const prior = session
    const priorParsed = tryParseIntake(session.intake_json)
    if (!priorParsed) return
    const nextIntake = {
      ...priorParsed,
      type: next.type ?? priorParsed.type,
      account: next.account,
      formData: next.values,
    }
    const optimistic: SessionRow = {
      ...session,
      intake_json: JSON.stringify(nextIntake),
      updated_at: Math.floor(Date.now() / 1000),
    }
    setSession(optimistic)
    setSaving(true)
    setSaveError(false)
    setStaleConflict(false)
    try {
      const r = await patchSession(id, {
        intakeJson: nextIntake,
        ifUpdatedAt: prior.updated_at,
      })
      setSession(r.session)
    } catch (err) {
      setSession(prior)
      if (err instanceof ApiError && err.status === 409) {
        setStaleConflict(true)
        await refresh()
      } else {
        setSaveError(true)
      }
    } finally {
      setSaving(false)
    }
  }

  const onWithdraw = async () => {
    if (!id || withdrawing) return
    if (!window.confirm(t.withdrawConfirm)) return
    setWithdrawing(true)
    try {
      await deleteSession(id)
      navigate(`${langPrefix}/me`, { replace: true })
    } catch {
      setWithdrawing(false)
    }
  }

  if (authLoading || (!session && !error)) {
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

  if (error === 'notfound') {
    return (
      <>
        <Header lang={lang} />
        <main className="page">
          <section className="page__panel">
            <p>{t.notFound}</p>
          </section>
        </main>
        <Footer lang={lang} />
      </>
    )
  }

  if (error === 'forbidden' || !session) {
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

  const backHref = isAdmin ? `${langPrefix}/admin/inbox` : `${langPrefix}/me`
  const backLabel = isAdmin ? t.backToInbox : t.backToMe
  const intakeText = session.intake_json
  const parsed = tryParseIntake(intakeText)
  // Fallback only when parse fails — let users see the raw stored payload.
  let intakePretty: string | null = null
  if (!parsed && intakeText) {
    try {
      intakePretty = JSON.stringify(JSON.parse(intakeText), null, 2)
    } catch {
      intakePretty = intakeText
    }
  }
  // Visitor edits their own; admin can edit any. Server enforces this too.
  const canEditIntake = !!parsed && (isAdmin || session.email === email)

  return (
    <>
      <Header lang={lang} />
      <main className="page session-page">
        <p>
          <a href={backHref}>{backLabel}</a>
        </p>
        <header className="session-page__header">
          <h1>
            {t.title} <span className="mono">{session.id.slice(0, 8)}</span>
          </h1>
          <div className="session-page__meta">
            <span>
              <strong>{t.statusLabel}:</strong> {session.status}
            </span>
            {(() => {
              const sla = computeSla(session)
              if (!sla.active) return null
              return (
                <span
                  className={`me-portal__sla mono${sla.overdue ? ' me-portal__sla--overdue' : ''}`}
                >
                  {t.slaPrefix}{' '}
                  {sla.overdue ? t.slaOverdue : formatRelativeWindow(sla.msLeft, lang)}
                </span>
              )
            })()}
            <span className="mono" role="status" aria-live="polite" hidden={!refreshing}>
              {refreshing ? t.refreshing : ''}
            </span>
          </div>
        </header>

        {isAdmin && (
          <section className="page__panel">
            <h2 className="snd-demo__h">{t.changeStatus}</h2>
            <div className="status-buttons">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => onStatusChange(s)}
                  disabled={s === session.status}
                  className={`status-btn${s === session.status ? ' status-btn--current' : ''}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="page__panel">
          <header className="session-page__intake-head">
            <h2 className="snd-demo__h">{t.intakeHeading}</h2>
            <div className="session-page__intake-actions">
              <span
                role="status"
                aria-live="polite"
                className="mono session-page__saving"
                hidden={!saving}
              >
                {saving ? t.saving : ''}
              </span>
              {saveError && !saving && (
                <span className="mono session-page__save-error" role="alert" aria-live="assertive">
                  {t.saveError}
                </span>
              )}
              {canEditIntake && (
                <button
                  type="button"
                  className="link-btn mono"
                  onClick={() => {
                    setEditing((v) => !v)
                    setSaveError(false)
                  }}
                  aria-pressed={editing}
                >
                  {editing ? t.doneEditing : t.editIntake}
                </button>
              )}
            </div>
          </header>
          {staleConflict && (
            <p className="session-page__stale" role="alert" aria-live="assertive">
              {t.staleConflict}
            </p>
          )}
          {parsed ? (
            <>
              {editing && <p className="field__hint">{t.editHint}</p>}
              <IntakeSummary
                lang={lang}
                account={parsed.account}
                type={parsed.type}
                values={parsed.formData}
                submittedAt={parsed.submittedAt}
                editable={editing}
                editableType={editing}
                typeChangeConfirm={t.typeChangeWarn}
                requiredEmptyConfirm={t.requiredEmptyConfirm}
                onChange={onIntakeChange}
              />
            </>
          ) : intakePretty ? (
            <pre className="mono session-page__intake">{intakePretty}</pre>
          ) : (
            <p>{t.noIntake}</p>
          )}
        </section>

        <section className="page__panel">
          <h2 className="snd-demo__h">{t.timelineHeading}</h2>
          <ul className="session-timeline">
            <li className="session-timeline__entry">
              <span className="session-timeline__dot" aria-hidden="true" />
              <div className="session-timeline__body">
                <div className="mono session-timeline__when">
                  {formatDateTime(session.created_at, lang)}
                </div>
                <div>{t.timelineCreated(formatDateTime(session.created_at, lang))}</div>
              </div>
            </li>
            {parseStatusHistory(session.status_history).map((entry) => (
              <li key={entry.at} className="session-timeline__entry">
                <span className="session-timeline__dot" aria-hidden="true" />
                <div className="session-timeline__body">
                  <div className="mono session-timeline__when">
                    {formatDateTime(entry.at, lang)}
                  </div>
                  <div>
                    {t.timelineStatus(
                      entry.from,
                      entry.to,
                      entry.by,
                      formatDateTime(entry.at, lang),
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="page__panel">
          <h2 className="snd-demo__h">{t.threadHeading}</h2>
          {messages.length === 0 ? (
            <p>{t.none}</p>
          ) : (
            <ul className="thread">
              {messages.map((m) => {
                const isMe =
                  (isAdmin && m.author === 'marc') || (!isAdmin && m.author === 'visitor')
                const authorLabel = isMe ? t.you : m.author === 'marc' ? t.marc : t.visitor
                return (
                  <li
                    key={m.id}
                    className={`thread__msg thread__msg--${m.author}${isMe ? ' thread__msg--mine' : ''}`}
                  >
                    <div className="thread__head mono">
                      {authorLabel} · {formatDateTime(m.created_at, lang)}
                    </div>
                    {m.body && <div className="thread__body">{m.body}</div>}
                    {m.attachments && m.attachments.length > 0 && (
                      <ul className="thread__attach-list">
                        {m.attachments.map((a) => (
                          <AttachmentTile
                            key={a.id}
                            att={a}
                            sessionId={session.id}
                            openLabel={t.attachOpen}
                          />
                        ))}
                      </ul>
                    )}
                  </li>
                )
              })}
            </ul>
          )}

          <form onSubmit={onSend} className="thread__form">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t.placeholder}
              rows={3}
              className="form__input"
            />
            {pendingAttachments.length > 0 && (
              <ul className="thread__attach-pending" aria-label="pending attachments">
                {pendingAttachments.map((a) => (
                  <li key={a.id} className="thread__attach-chip">
                    <span className="mono thread__attach-name">{a.filename}</span>
                    <span className="mono thread__attach-size">{formatFileSize(a.size)}</span>
                    <button
                      type="button"
                      className="link-btn mono thread__attach-remove"
                      onClick={() => onRemoveAttachment(a)}
                      aria-label={`${t.attachRemove} ${a.filename}`}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="thread__form-actions">
              <label className="link-btn mono thread__attach-trigger">
                <input
                  type="file"
                  multiple
                  className="thread__attach-input"
                  disabled={uploading || pendingAttachments.length >= 5}
                  onChange={(e) => {
                    void onAttach(e.target.files)
                    e.target.value = ''
                  }}
                />
                {uploading ? t.attaching : `+ ${t.attachLabel}`}
              </label>
              <span className="field__hint thread__attach-max">{t.attachMax}</span>
              {attachError && (
                <span role="alert" aria-live="assertive" className="mono session-page__save-error">
                  {attachError}
                </span>
              )}
              <button
                type="submit"
                disabled={
                  sending || uploading || (!draft.trim() && pendingAttachments.length === 0)
                }
                className="hero__cta"
              >
                {sending ? t.sending : t.send}
              </button>
            </div>
          </form>
        </section>

        {(isAdmin || session.email === email) && (
          <section className="page__panel session-page__danger">
            <button
              type="button"
              className="link-btn mono session-page__withdraw"
              onClick={onWithdraw}
              disabled={withdrawing}
            >
              {t.withdrawCta}
            </button>
          </section>
        )}
      </main>
      <Footer lang={lang} />
    </>
  )
}

function AttachmentTile({
  att,
  sessionId,
  openLabel,
}: {
  att: AttachmentRow
  sessionId: string
  openLabel: string
}) {
  const url = attachmentUrl(sessionId, att.id)
  const isImage = att.content_type.startsWith('image/')
  if (isImage) {
    return (
      <li className="thread__attach-tile thread__attach-tile--image">
        <a href={url} target="_blank" rel="noopener noreferrer" aria-label={att.filename}>
          <img src={url} alt={att.filename} loading="lazy" />
        </a>
        <div className="thread__attach-caption mono">
          {att.filename} · {formatFileSize(att.size)}
        </div>
      </li>
    )
  }
  return (
    <li className="thread__attach-tile thread__attach-tile--file">
      <a href={url} target="_blank" rel="noopener noreferrer" download={att.filename}>
        <span className="thread__attach-icon" aria-hidden="true">
          ⎙
        </span>
        <span className="thread__attach-info">
          <span className="thread__attach-filename">{att.filename}</span>
          <span className="mono thread__attach-meta">
            {att.content_type} · {formatFileSize(att.size)}
          </span>
        </span>
        <span className="mono thread__attach-open">{openLabel} →</span>
      </a>
    </li>
  )
}
