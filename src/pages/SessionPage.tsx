import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { DICT, type Lang } from '../i18n'
import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import { PAGE_FEATURE } from '../lib/features'
import { SessionAdvancements } from '../components/SessionAdvancements'
import { SessionShowcase } from '../components/SessionShowcase'
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
  type SessionTier,
} from '../lib/sessionsApi'
import { listAdvancements, type AdvancementRow } from '../lib/advancementsApi'
import { ApiError } from '../lib/api'
import type { Account } from '../components/intake/AccountStep'
import type { FormData } from '../components/intake/TypeForm'
import { IntakeSummary } from '../components/intake/IntakeSummary'
import { SessionStatusStrip } from '../components/intake/SessionStatusStrip'
import { SessionTierStrip } from '../components/intake/SessionTierStrip'
import { PaymentActions } from '../components/PaymentActions'
import { SessionWhatsNext } from '../components/SessionWhatsNext'
import { getPaymentSummary, type PaymentSummary } from '../lib/paymentsApi'
import { SessionHeader } from '../components/intake/SessionHeader'
import { SectionEyebrow } from '../components/SectionEyebrow'
import { getSchemaForType, localized, type ProblemType } from '../lib/intakeSchemas'
import { computeSla, formatDateTime, formatRelativeWindow } from '../lib/format'
import { markSeen } from '../lib/unread'
import {
  attachmentUrl,
  deleteAttachment,
  formatFileSize,
  uploadAttachment,
  type AttachmentRow,
} from '../lib/attachmentsApi'

interface ParsedNapkin {
  png: string
  text: string
  savedAt: string
}

interface ParsedIntake {
  type: ProblemType
  account: Account
  formData: FormData
  submittedAt: string
  waitlist?: boolean
  lang?: Lang
  /** Optional Excalidraw sketch attached at intake time via /napkin. PNG is
   * stored inline as a data URL — small enough for typical drawings; the
   * SessionPage just renders it. */
  napkin?: ParsedNapkin
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
      let napkin: ParsedNapkin | undefined
      const n = (obj as { napkin?: unknown }).napkin
      if (
        n &&
        typeof n === 'object' &&
        typeof (n as ParsedNapkin).png === 'string' &&
        typeof (n as ParsedNapkin).text === 'string'
      ) {
        napkin = {
          png: (n as ParsedNapkin).png,
          text: (n as ParsedNapkin).text,
          savedAt: (n as ParsedNapkin).savedAt ?? '',
        }
      }
      return {
        type: obj.type as ProblemType,
        account: obj.account,
        formData: (obj.formData ?? {}) as FormData,
        submittedAt: obj.submittedAt,
        waitlist: obj.waitlist,
        lang: obj.lang,
        napkin,
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
    eyebrow: 'Session',
    loading: 'Chargement…',
    notFound: 'Session introuvable.',
    forbidden: 'Tu n’as pas accès à cette session.',
    threadHeading: 'Discussion',
    none: 'Marc répond en moins de 72h. Laisse-lui un mot ici dès que tu en as un.',
    placeholder: 'Écris un message…',
    sending: 'Envoi…',
    send: 'Envoyer',
    you: 'Toi',
    marc: 'Marc',
    visitor: 'Visiteur',
    statusLabel: 'Statut',
    changeStatus: 'Changer le statut',
    statusHint: 'Clique une étape pour changer le statut de la session.',
    tierHint:
      'Tier de la session — détermine le bouton « Payer » côté visiteur. T0 = gratuit, pas de bouton.',
    tier3AmountLabel: 'Montant Tier 3 (CAD)',
    tier3AmountHint:
      'Saisis le montant convenu en dollars canadiens. Le bouton « Payer (sur devis) » apparaît côté visiteur quand cette valeur est définie. Laisse vide pour cacher le bouton (pas de devis encore).',
    tier3AmountPlaceholder: 'ex. 4500',
    tier3AmountSave: 'Enregistrer',
    tier3AmountClear: 'Effacer',
    tier3AmountInvalid: 'Entre un montant entre 100 et 100 000 $.',
    statusConfirmReject: (id: string) =>
      `Marquer la session ${id} comme refusée ? Le visiteur le verra. Continue ?`,
    statusConfirmShip: (id: string) =>
      `Marquer la session ${id} comme livrée ? Cette transition signale que c’est fini.`,
    statusConfirmReopenShipped: (id: string) =>
      `Rouvrir la session ${id} (déjà livrée) ? Le visiteur sera notifié.`,
    statusConfirmReopenRejected: (id: string) =>
      `Réactiver la session ${id} (refusée) ? Le visiteur sera notifié.`,
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
      'Cette session a été modifiée ailleurs. Elle a été rechargée — ré-applique ton changement.',
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
    eyebrow: 'Session',
    loading: 'Loading…',
    notFound: 'Session not found.',
    forbidden: "You don't have access to this session.",
    threadHeading: 'Thread',
    none: 'Marc replies within 72h. Drop him a note here whenever you have one.',
    placeholder: 'Write a message…',
    sending: 'Sending…',
    send: 'Send',
    you: 'You',
    marc: 'Marc',
    visitor: 'Visitor',
    statusLabel: 'Status',
    changeStatus: 'Change status',
    statusHint: 'Click a stage to change the session status.',
    tierHint: 'Session tier — drives the visitor-side "Pay" button. T0 = free, no button.',
    tier3AmountLabel: 'Tier 3 amount (CAD)',
    tier3AmountHint:
      'Enter the agreed-upon dollar amount. The visitor\'s "Pay (quoted)" button appears once this is set. Leave blank to hide the button (no quote yet).',
    tier3AmountPlaceholder: 'e.g. 4500',
    tier3AmountSave: 'Save',
    tier3AmountClear: 'Clear',
    tier3AmountInvalid: 'Enter an amount between $100 and $100,000.',
    statusConfirmReject: (id: string) =>
      `Mark session ${id} as rejected? The visitor will see this. Continue?`,
    statusConfirmShip: (id: string) =>
      `Mark session ${id} as shipped? This signals the work is done.`,
    statusConfirmReopenShipped: (id: string) =>
      `Reopen session ${id} (already shipped)? The visitor will be notified.`,
    statusConfirmReopenRejected: (id: string) =>
      `Reactivate session ${id} (rejected)? The visitor will be notified.`,
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
      'This session was changed somewhere else. It’s been reloaded — re-apply your change.',
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

export function SessionPage({ lang }: { lang: Lang }) {
  const t = COPY[lang]
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { email, isAdmin, loading: authLoading } = useAuth()
  const [session, setSession] = useState<SessionRow | null>(null)
  const [messages, setMessages] = useState<MessageRow[]>([])
  const [advancements, setAdvancements] = useState<AdvancementRow[] | null>(null)
  const [advancementsLoading, setAdvancementsLoading] = useState<boolean>(true)
  // Payment summary mirrors what PaymentActions fetches internally. Lifted
  // here so SessionWhatsNext can render precise next-step copy (e.g. "you
  // paid the deposit, balance is at delivery") without an additional round-
  // trip. PaymentActions still self-fetches in MePortal compact cards.
  const [summary, setSummary] = useState<PaymentSummary | null>(null)
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

  // Advancements load — separate from the session+messages fetch so a 403/404
  // on advancements doesn't unmount the rest of the page. Empty list on error
  // is the safe default (matches the empty-state UI). Loading state is
  // toggled only in the async callback to keep the effect body free of
  // synchronous setState (lint rule react-hooks/set-state-in-effect).
  useEffect(() => {
    if (authLoading || !id || !email) return
    let cancelled = false
    listAdvancements(id)
      .then((r) => {
        if (cancelled) return
        setAdvancements(r.advancements)
        setAdvancementsLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setAdvancements([])
        setAdvancementsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [authLoading, email, id])

  // Payment summary — drives SessionWhatsNext's tier-aware copy. Failures
  // (Stripe unconfigured 503, network) just keep summary null and the strip
  // falls back to status-only copy. Effect re-fires on session updates so
  // post-payment redirects refresh the strip.
  useEffect(() => {
    if (authLoading || !id || !email) return
    let cancelled = false
    getPaymentSummary(id)
      .then((s) => {
        if (!cancelled) setSummary(s)
      })
      .catch(() => {
        if (!cancelled) setSummary(null)
      })
    return () => {
      cancelled = true
    }
  }, [authLoading, email, id, session?.updated_at])

  const onAdvCreated = useCallback((row: AdvancementRow) => {
    setAdvancements((prev) => (prev ? [row, ...prev] : [row]))
  }, [])
  const onAdvPatched = useCallback((row: AdvancementRow) => {
    setAdvancements((prev) => (prev ? prev.map((p) => (p.id === row.id ? row : p)) : [row]))
  }, [])
  const onAdvDeleted = useCallback((advId: string) => {
    setAdvancements((prev) => (prev ? prev.filter((p) => p.id !== advId) : prev))
  }, [])

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
    // Confirm destructive transitions: any move that touches a terminal state
    // (shipped/rejected) — either entering one, or reopening from one. The
    // visitor sees these transitions, so a stray click shouldn't drive them.
    const current = session.status
    const idTag = session.id.slice(0, 8)
    let prompt: string | null = null
    if (next === 'rejected') prompt = t.statusConfirmReject(idTag)
    else if (next === 'shipped') prompt = t.statusConfirmShip(idTag)
    else if (current === 'shipped') prompt = t.statusConfirmReopenShipped(idTag)
    else if (current === 'rejected') prompt = t.statusConfirmReopenRejected(idTag)
    if (prompt && !window.confirm(prompt)) return

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

  // Admin-only tier setter. Server gates this; no client-side confirm needed
  // since tier changes are non-destructive (visitor sees a different Pay
  // button, not a state-of-the-work signal like status).
  const onTierChange = async (next: SessionTier | null) => {
    if (!id || !session) return
    try {
      const r = await patchSession(id, { tier: next, ifUpdatedAt: session.updated_at })
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

  // Admin-only tier-3 quoted amount setter. Pass cents or null. Validated
  // server-side (10000..10000000); ifUpdatedAt enforces optimistic concurrency.
  const onTier3AmountChange = async (cents: number | null) => {
    if (!id || !session) return
    try {
      const r = await patchSession(id, {
        tier3AmountCents: cents,
        ifUpdatedAt: session.updated_at,
      })
      setSession(r.session)
      setStaleConflict(false)
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setStaleConflict(true)
        await refresh()
      }
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

  // Unified timeline: session-created + status transitions + advancements,
  // sorted ascending by timestamp. Computed before early returns so the
  // useMemo always runs in the same order (hooks-rules compliance). When
  // session is null the array is empty and the render block doesn't reach it.
  const advT = DICT[lang].sessionAdvancements
  type TimelineEntry =
    | { kind: 'created'; at: number }
    | {
        kind: 'status'
        at: number
        from: SessionStatus
        to: SessionStatus
        by: string
      }
    | { kind: 'advancement'; at: number; row: AdvancementRow }
  const timelineEntries = useMemo<TimelineEntry[]>(() => {
    if (!session) return []
    const out: TimelineEntry[] = [{ kind: 'created', at: session.created_at }]
    for (const s of parseStatusHistory(session.status_history)) {
      out.push({ kind: 'status', at: s.at, from: s.from, to: s.to, by: s.by })
    }
    for (const a of advancements ?? []) {
      out.push({ kind: 'advancement', at: a.date, row: a })
    }
    out.sort((x, y) => x.at - y.at)
    return out
  }, [session, advancements])

  // Thread items: messages + advancements flagged showInConversation,
  // chronological. Separate from the activity timeline above (which shows
  // ALL advancements regardless of flag). The flag opts an entry INTO the
  // back-and-forth conversation alongside messages.
  type ThreadItem =
    | { kind: 'message'; at: number; msg: MessageRow }
    | { kind: 'advancement'; at: number; row: AdvancementRow }
  const threadItems = useMemo<ThreadItem[]>(() => {
    const out: ThreadItem[] = []
    for (const m of messages) out.push({ kind: 'message', at: m.created_at, msg: m })
    for (const a of advancements ?? []) {
      if (a.flags.showInConversation) out.push({ kind: 'advancement', at: a.date, row: a })
    }
    out.sort((x, y) => x.at - y.at)
    return out
  }, [messages, advancements])

  // Most-recent advancement flagged showAsCurrentBuild — surfaced as a pinned
  // header pill. Falls back to null when admin hasn't pinned anything.
  const currentBuild = useMemo<AdvancementRow | null>(() => {
    if (!advancements || advancements.length === 0) return null
    const pinned = advancements.filter((a) => a.flags.showAsCurrentBuild)
    if (pinned.length === 0) return null
    // listAdvancements returns newest-first by date; pick the freshest pin.
    return pinned.reduce((a, b) => (a.date >= b.date ? a : b))
  }, [advancements])

  if (authLoading || (!session && !error)) {
    return (
      <div className="app" data-feature={PAGE_FEATURE['page.session-page']}>
        <Header lang={lang} variant="session" />
        <main id="main-content">
          <article className="section intake session-frame">
            <div className="section__inner">
              <p className="session-frame__pending">{t.loading}</p>
            </div>
          </article>
        </main>
        <Footer lang={lang} />
      </div>
    )
  }

  if (error === 'notfound') {
    return (
      <div className="app" data-feature={PAGE_FEATURE['page.session-page']}>
        <Header lang={lang} variant="session" />
        <main id="main-content">
          <article className="section intake session-frame">
            <div className="section__inner">
              <div className="intake__step">
                <SectionEyebrow lang={lang} feature={PAGE_FEATURE['page.session-page']}>
                  {t.eyebrow}
                </SectionEyebrow>
                <h1 className="session-frame__title">{t.notFound}</h1>
              </div>
            </div>
          </article>
        </main>
        <Footer lang={lang} />
      </div>
    )
  }

  if (error === 'forbidden' || !session) {
    return (
      <div className="app" data-feature={PAGE_FEATURE['page.session-page']}>
        <Header lang={lang} variant="session" />
        <main id="main-content">
          <article className="section intake session-frame">
            <div className="section__inner">
              <div className="intake__step">
                <SectionEyebrow lang={lang} feature={PAGE_FEATURE['page.session-page']}>
                  {t.eyebrow}
                </SectionEyebrow>
                <h1 className="session-frame__title">{t.forbidden}</h1>
              </div>
            </div>
          </article>
        </main>
        <Footer lang={lang} />
      </div>
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

  const sla = computeSla(session)
  const slaPill = sla.active ? (
    <span className={`me-portal__sla mono${sla.overdue ? ' me-portal__sla--overdue' : ''}`}>
      {t.slaPrefix} {sla.overdue ? t.slaOverdue : formatRelativeWindow(sla.msLeft, lang)}
    </span>
  ) : null

  return (
    <div className="app" data-feature={PAGE_FEATURE['page.session-page']}>
      <Header lang={lang} variant="session" />
      <main id="main-content">
        <article className="section intake session-frame">
          <div className="section__inner">
            <a className="showcase-page__back" href={backHref}>
              {backLabel}
            </a>

            <div id="session-statut">
              <SessionStatusStrip
                lang={lang}
                status={session.status}
                onPick={isAdmin ? onStatusChange : undefined}
              />
              {isAdmin && <p className="field__hint session-frame__strip-hint">{t.statusHint}</p>}
              {isAdmin && (
                <>
                  <SessionTierStrip lang={lang} tier={session.tier} onPick={onTierChange} />
                  <p className="field__hint session-frame__strip-hint">{t.tierHint}</p>
                </>
              )}

              {isAdmin && session.tier === 3 && (
                <Tier3AmountInput
                  // key resets local draft when the persisted value changes
                  // (post-save, post-409 reload). Avoids an effect+setState
                  // pattern the lint rule rejects.
                  key={String(session.tier3_amount_cents ?? '')}
                  lang={lang}
                  copy={t}
                  cents={session.tier3_amount_cents}
                  onSave={onTier3AmountChange}
                />
              )}

              <SessionWhatsNext session={session} summary={summary} isAdmin={isAdmin} lang={lang} />
            </div>

            {/* Render PaymentActions for active *and* shipped sessions: the
                ownership-decision (All yours vs Custodian) sections live
                inside the component and need the shipped state to surface.
                The component internally emits id="session-paiement" and
                id="session-livraison" anchors that the sub-header
                navigates to. */}
            {(session.status === 'active' || session.status === 'shipped') && (
              <PaymentActions session={session} lang={lang} />
            )}

            <SessionHeader
              lang={lang}
              feature={PAGE_FEATURE['page.session-page']}
              eyebrow={
                parsed
                  ? `${localized(getSchemaForType(parsed.type).title, lang)} · ${session.status}`
                  : `${t.eyebrow} · ${session.status}`
              }
              title={t.title}
              idTag={session.id.slice(0, 8)}
              meta={
                <>
                  <span
                    className={`session-frame__status-pill session-frame__status-pill--${session.status}`}
                  >
                    {session.status}
                  </span>
                  {slaPill}
                  {currentBuild &&
                    (currentBuild.build_url ? (
                      <a
                        className="session-frame__current-build mono"
                        href={`${currentBuild.build_url}${currentBuild.iframe_path ?? ''}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {advT.currentLabel}: {currentBuild.label} ↗
                      </a>
                    ) : (
                      <span className="session-frame__current-build session-frame__current-build--pending mono">
                        {advT.currentLabel}: {currentBuild.label} ({advT.pillPendingStamp})
                      </span>
                    ))}
                  <span
                    className="mono session-frame__refresh"
                    role="status"
                    aria-live="polite"
                    hidden={!refreshing}
                  >
                    {refreshing ? t.refreshing : ''}
                  </span>
                </>
              }
            />

            <section id="session-intake" className="intake__step session-frame__panel">
              <header className="session-page__intake-head">
                <h2>{t.intakeHeading}</h2>
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
                    <span
                      className="mono session-page__save-error"
                      role="alert"
                      aria-live="assertive"
                    >
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
                  {parsed.napkin && <NapkinSection lang={lang} napkin={parsed.napkin} />}
                </>
              ) : intakePretty ? (
                <pre className="mono session-page__intake">{intakePretty}</pre>
              ) : (
                <p>{t.noIntake}</p>
              )}
            </section>

            <section className="intake__step session-frame__panel">
              <h2>{t.timelineHeading}</h2>
              <ul className="session-timeline">
                {timelineEntries.map((entry, i) => {
                  if (entry.kind === 'created') {
                    return (
                      <li key={`c-${entry.at}`} className="session-timeline__entry">
                        <span className="session-timeline__dot" aria-hidden="true" />
                        <div className="session-timeline__body">
                          <div className="mono session-timeline__when">
                            {formatDateTime(entry.at, lang)}
                          </div>
                          <div>{t.timelineCreated(formatDateTime(entry.at, lang))}</div>
                        </div>
                      </li>
                    )
                  }
                  if (entry.kind === 'status') {
                    return (
                      <li key={`s-${entry.at}-${i}`} className="session-timeline__entry">
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
                    )
                  }
                  // advancement
                  const row = entry.row
                  const linkHref =
                    row.build_url && row.build_url.length > 0
                      ? `${row.build_url}${row.iframe_path ?? ''}`
                      : null
                  return (
                    <li
                      key={`a-${row.id}`}
                      className="session-timeline__entry session-timeline__entry--advancement"
                    >
                      <span
                        className="session-timeline__dot session-timeline__dot--advancement"
                        aria-hidden="true"
                      />
                      <div className="session-timeline__body">
                        <div className="mono session-timeline__when">
                          {formatDateTime(entry.at, lang)}
                        </div>
                        <div>
                          <strong>{advT.timelineLabel}:</strong> {row.label}
                          {linkHref ? (
                            <>
                              {' · '}
                              <a href={linkHref} target="_blank" rel="noreferrer" className="mono">
                                {advT.openInNewTab}
                              </a>
                            </>
                          ) : (
                            <>
                              {' · '}
                              <span className="mono session-timeline__pending">
                                {advT.pillPendingStamp}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>

            {isAdmin && (
              <SessionShowcase
                session={session}
                lang={lang}
                onPatched={(next) => setSession(next)}
              />
            )}

            <div id="session-builds">
              <SessionAdvancements
                sessionId={session.id}
                isAdmin={isAdmin}
                lang={lang}
                repoUrl="https://github.com/majeanson/marc-portal"
                items={advancements}
                loading={advancementsLoading}
                onCreated={onAdvCreated}
                onPatched={onAdvPatched}
                onDeleted={onAdvDeleted}
              />
            </div>

            <section id="session-conversation" className="intake__step session-frame__panel">
              <h2>{t.threadHeading}</h2>
              {threadItems.length === 0 ? (
                <p className="thread__empty">{t.none}</p>
              ) : (
                <ul className="thread">
                  {threadItems.map((item) => {
                    if (item.kind === 'message') {
                      const m = item.msg
                      const isMe =
                        (isAdmin && m.author === 'marc') || (!isAdmin && m.author === 'visitor')
                      const authorLabel = isMe ? t.you : m.author === 'marc' ? t.marc : t.visitor
                      return (
                        <li
                          key={`m-${m.id}`}
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
                    }
                    // advancement bubble — visually distinct from messages so
                    // a build announcement reads as a *milestone*, not chat.
                    const row = item.row
                    const linkHref =
                      row.build_url && row.build_url.length > 0
                        ? `${row.build_url}${row.iframe_path ?? ''}`
                        : null
                    return (
                      <li key={`a-${row.id}`} className="thread__msg thread__msg--build">
                        <div className="thread__head mono">
                          {advT.timelineLabel} · {formatDateTime(row.date, lang)}
                        </div>
                        <div className="thread__build-label">{row.label}</div>
                        {row.body && <div className="thread__body">{row.body}</div>}
                        {linkHref ? (
                          <a
                            className="thread__build-link mono"
                            href={linkHref}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {advT.openInNewTab}
                          </a>
                        ) : (
                          <span className="mono session-timeline__pending">
                            {advT.pillPendingStamp}
                          </span>
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
                  className="field__input thread__input"
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
                    <span
                      role="alert"
                      aria-live="assertive"
                      className="mono session-page__save-error"
                    >
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
              <section className="session-page__danger">
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
          </div>
        </article>
      </main>
      <Footer lang={lang} />
    </div>
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

/**
 * Renders the visitor's napkin sketch (if attached at intake time) inside the
 * SessionPage intake panel. The PNG sits at full width — Marc reviews it the
 * same way he'd read the prose. Click "Open PNG" to view full-size in a new
 * tab; right-click → "Save image as…" to download.
 */
function NapkinSection({ lang, napkin }: { lang: Lang; napkin: ParsedNapkin }) {
  const t = DICT[lang].napkin
  return (
    <div className="session-napkin">
      <div className="session-napkin__head">
        <span className="section__eyebrow">{t.eyebrow}</span>
        <a
          className="mono session-napkin__open"
          href={napkin.png}
          target="_blank"
          rel="noreferrer"
          download={`napkin-${napkin.savedAt.slice(0, 10) || 'sketch'}.png`}
        >
          {t.pillView} ↗
        </a>
      </div>
      {napkin.text && <p className="session-napkin__caption">{napkin.text}</p>}
      <div className="session-napkin__frame">
        <img
          src={napkin.png}
          alt={napkin.text || 'Napkin sketch'}
          className="session-napkin__img"
        />
      </div>
    </div>
  )
}

/**
 * Admin-only input for the Tier 3 quoted amount. Local state tracks the
 * draft (in dollars, as the admin types); commit on Save translates to cents
 * and PATCHes. Clear sends null which both removes the value AND hides the
 * visitor's "Payer (sur devis)" button.
 *
 * Validation: 100..100000 dollars (matches server-side cents range). Invalid
 * input shows an inline error and keeps the draft.
 */
function Tier3AmountInput({
  lang: _lang,
  copy,
  cents,
  onSave,
}: {
  lang: Lang
  copy: (typeof COPY)[Lang]
  cents: number | null
  onSave: (cents: number | null) => Promise<void>
}) {
  // Parent passes key={String(cents)} so when the persisted value changes
  // (post-save, post-409 reload), React unmounts and this state re-initializes
  // from the new prop — no effect+setState dance.
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
        {copy.tier3AmountLabel}
        <div className="session-frame__tier3-row">
          <span className="session-frame__tier3-prefix mono">$</span>
          <input
            type="number"
            inputMode="numeric"
            min={100}
            max={100000}
            step={1}
            value={draft}
            placeholder={copy.tier3AmountPlaceholder}
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
            {copy.tier3AmountSave}
          </button>
          {cents != null && (
            <button type="button" className="link-btn mono" onClick={onClear} disabled={saving}>
              {copy.tier3AmountClear}
            </button>
          )}
        </div>
      </label>
      <p className="field__hint session-frame__strip-hint">
        {error ? copy.tier3AmountInvalid : copy.tier3AmountHint}
      </p>
    </form>
  )
}
