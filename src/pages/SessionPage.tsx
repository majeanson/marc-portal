import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  uploadSketch,
  uploadVoice,
  type AttachmentRow,
} from '../lib/attachmentsApi'
import type { ExcalidrawAPI, NapkinScene } from '../lib/napkin'
import type { VoiceNapkin } from '../lib/intakeMediaApi'
import { NapkinReplay } from '../components/NapkinReplay'
import { VoiceRecorder } from '../components/VoiceRecorder'

// Excalidraw is ~600 KB — the compose-box sketch surface stays behind
// React.lazy so a thread the visitor never sketches into doesn't pay for it.
const SketchCanvas = lazy(() =>
  import('../components/SketchCanvas').then((m) => ({ default: m.SketchCanvas })),
)

interface ParsedNapkin {
  png: string
  text: string
  savedAt: string
  /** Editable Excalidraw scene, present on intakes submitted after the napkin
   * was folded into the form. Older sessions only have the flat PNG. */
  scene?: NapkinScene
}

interface ParsedIntake {
  type: ProblemType
  account: Account
  formData: FormData
  submittedAt: string
  waitlist?: boolean
  lang?: Lang
  /** Optional Excalidraw sketch attached on the intake form. The PNG renders
   * at a glance; the editable scene (newer intakes) can be opened interactively. */
  napkin?: ParsedNapkin
  /** Optional voice note recorded on the intake form — transcript only (the
   * audio is transcribed at the edge and discarded; see intakeMediaApi.ts). */
  voiceNapkin?: VoiceNapkin
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
        // The editable scene only rides on intakes submitted after the napkin
        // was folded into the form; guard its shape so older PNG-only sessions
        // (and any malformed payload) still parse.
        const sc = (n as { scene?: unknown }).scene
        const scene =
          sc && typeof sc === 'object' && Array.isArray((sc as NapkinScene).elements)
            ? { elements: (sc as NapkinScene).elements }
            : undefined
        napkin = {
          png: (n as ParsedNapkin).png,
          text: (n as ParsedNapkin).text,
          savedAt: (n as ParsedNapkin).savedAt ?? '',
          scene,
        }
      }
      let voiceNapkin: VoiceNapkin | undefined
      const vn = (obj as { voiceNapkin?: unknown }).voiceNapkin
      if (
        vn &&
        typeof vn === 'object' &&
        typeof (vn as VoiceNapkin).transcript === 'string' &&
        (vn as VoiceNapkin).transcript.trim().length > 0
      ) {
        voiceNapkin = {
          transcript: (vn as VoiceNapkin).transcript,
          savedAt:
            typeof (vn as VoiceNapkin).savedAt === 'string' ? (vn as VoiceNapkin).savedAt : '',
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
        voiceNapkin,
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
    arcPinnedHeading: 'Le croquis de départ',
    arcShippedHeading: 'Du croquis au livré',
    arcSketchLabel: 'Le croquis',
    arcShippedLabel: 'Le livré',
    arcViewLive: 'Voir en ligne ↗',
    arcShippedFallback: 'Projet livré',
    certificateHeading: 'Le certificat de passation',
    certificateBody:
      'Une page signée — le projet, la date, et tout ce qui t’a été remis. À télécharger et à garder.',
    certificateDownload: 'Télécharger le certificat ↓',
    declineHeading: 'Pas retenu — mais pas un cul-de-sac',
    declineLead:
      'Ce projet n’est pas un fit pour moi cette fois. Ça n’enlève rien à l’idée — juste, ce n’est pas moi qui devrais la bâtir.',
    declineNoteFrom: 'Le mot de Marc',
    declinePointersHeading: 'Où aller à partir d’ici',
    declinePointerTier0:
      'Les outils gratuits du Tier 0 règlent souvent les plus petits besoins, sans personne au milieu.',
    declinePointerTier0Link: 'Voir le Tier 0 →',
    declinePointerIntake:
      'Si l’idée évolue ou grossit, la porte reste ouverte — une nouvelle demande, quand tu veux.',
    declinePointerIntakeLink: 'Nouvelle demande →',
    declineNoteEditorLabel: 'Note de refus — le « non » généreux, visible par le visiteur',
    declineNoteEditorPlaceholder:
      'Ce que tu ferais à sa place : quel patron Tier 0, quel gabarit, qui d’autre aller voir…',
    declineNoteEmpty:
      'Aucune note pour l’instant — le visiteur ne voit que les repères ci-dessous.',
    declineNoteSave: 'Enregistrer la note',
    declineNoteSaving: 'Enregistrement…',
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
    arcPinnedHeading: 'The starting sketch',
    arcShippedHeading: 'From sketch to shipped',
    arcSketchLabel: 'The sketch',
    arcShippedLabel: 'Shipped',
    arcViewLive: 'See it live ↗',
    arcShippedFallback: 'Project shipped',
    certificateHeading: 'The handoff certificate',
    certificateBody:
      'A signed page — the project, the date, and everything handed to you. Download it and keep it.',
    certificateDownload: 'Download the certificate ↓',
    declineHeading: 'Not taken on — but not a dead end',
    declineLead:
      'This one isn’t a fit for me this time. That takes nothing away from the idea — it just shouldn’t be me building it.',
    declineNoteFrom: 'A note from Marc',
    declinePointersHeading: 'Where to go from here',
    declinePointerTier0:
      'The free Tier 0 tools often settle the smaller needs, with no one in the middle.',
    declinePointerTier0Link: 'See Tier 0 →',
    declinePointerIntake:
      'If the idea grows or shifts, the door stays open — a new request, whenever you like.',
    declinePointerIntakeLink: 'New request →',
    declineNoteEditorLabel: 'Decline note — the generous "no", visible to the visitor',
    declineNoteEditorPlaceholder:
      'What you’d do in their place: which Tier 0 pattern, which template, who else to see…',
    declineNoteEmpty: 'No note yet — the visitor sees only the pointers below.',
    declineNoteSave: 'Save the note',
    declineNoteSaving: 'Saving…',
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
  const tMedia = DICT[lang].media
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
  // Rich-media compose: which inline panel is open ('voice' | 'sketch'), and
  // a busy flag while the recorded clip / drawn scene is being uploaded.
  const [composeMedia, setComposeMedia] = useState<'none' | 'voice' | 'sketch'>('none')
  const [mediaBusy, setMediaBusy] = useState(false)
  const sketchApiRef = useRef<ExcalidrawAPI | null>(null)
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

  // A recorded voice note → uploaded as a 'voice' attachment (server transcribes
  // it at the edge) and staged into the pending list like any other upload.
  const onVoiceRecorded = async (blob: Blob) => {
    if (!id || mediaBusy || pendingAttachments.length >= 5) return
    setAttachError(null)
    setMediaBusy(true)
    try {
      const r = await uploadVoice(id, blob)
      setPendingAttachments((prev) => [...prev, r.attachment])
      setComposeMedia('none')
    } catch (err) {
      setAttachError(err instanceof ApiError ? err.message : t.attachError)
    } finally {
      setMediaBusy(false)
    }
  }

  // The drawn Excalidraw scene → uploaded as a 'sketch' attachment. An empty
  // canvas just closes the panel (nothing to attach).
  const onAttachSketch = async () => {
    if (!id || mediaBusy) return
    const api = sketchApiRef.current
    const elements = api ? [...api.getSceneElements()] : []
    if (elements.length === 0) {
      sketchApiRef.current = null
      setComposeMedia('none')
      return
    }
    if (pendingAttachments.length >= 5) return
    setAttachError(null)
    setMediaBusy(true)
    try {
      const r = await uploadSketch(id, { elements })
      setPendingAttachments((prev) => [...prev, r.attachment])
      sketchApiRef.current = null
      setComposeMedia('none')
    } catch (err) {
      setAttachError(err instanceof ApiError ? err.message : t.attachError)
    } finally {
      setMediaBusy(false)
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

            {/* The generous no — a rejected session is not a dead end. */}
            {session.status === 'rejected' && (
              <DeclinePanel session={session} lang={lang} isAdmin={isAdmin} onSaved={setSession} />
            )}

            {/* The napkin as the through-line — pinned high on the session,
                and at shipped it completes into a from-sketch-to-shipped
                pairing. */}
            {parsed?.napkin && (
              <NapkinArc
                lang={lang}
                napkin={parsed.napkin}
                session={session}
                currentBuild={currentBuild}
              />
            )}

            {/* Handoff certificate — a downloadable keepsake, once shipped. */}
            {session.status === 'shipped' && (
              <section className="intake__step session-frame__panel session-certificate">
                <h2>{t.certificateHeading}</h2>
                <p className="session-certificate__body">{t.certificateBody}</p>
                <a
                  className="session-certificate__btn mono"
                  href={`/og/certificate/${session.id}?lang=${lang}`}
                  download="certificat-passation.png"
                >
                  {t.certificateDownload}
                </a>
              </section>
            )}

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
                  {parsed.voiceNapkin && (
                    <div className="session-voicenapkin">
                      <span className="mono session-voicenapkin__label">
                        🎙 {tMedia.thread.voiceLabel}
                      </span>
                      <p className="session-voicenapkin__text">{parsed.voiceNapkin.transcript}</p>
                    </div>
                  )}
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
                                  lang={lang}
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
                    {pendingAttachments.map((a) => {
                      const chipLabel =
                        a.kind === 'voice'
                          ? tMedia.compose.voiceChip
                          : a.kind === 'sketch'
                            ? tMedia.compose.sketchChip
                            : a.filename
                      return (
                        <li
                          key={a.id}
                          className={`thread__attach-chip thread__attach-chip--${a.kind}`}
                        >
                          <span className="mono thread__attach-name">{chipLabel}</span>
                          {a.kind === 'file' && (
                            <span className="mono thread__attach-size">
                              {formatFileSize(a.size)}
                            </span>
                          )}
                          <button
                            type="button"
                            className="link-btn mono thread__attach-remove"
                            onClick={() => onRemoveAttachment(a)}
                            aria-label={`${t.attachRemove} ${chipLabel}`}
                          >
                            ×
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}

                {composeMedia === 'voice' && (
                  <div className="thread__media-panel">
                    <VoiceRecorder
                      lang={lang}
                      consent={tMedia.compose.voiceConsent}
                      confirmLabel={tMedia.compose.voiceAttach}
                      busy={mediaBusy}
                      onRecorded={onVoiceRecorded}
                      onCancel={() => setComposeMedia('none')}
                    />
                  </div>
                )}

                {composeMedia === 'sketch' && (
                  <div className="thread__media-panel">
                    <p className="field__hint">{tMedia.compose.sketchHint}</p>
                    <Suspense
                      fallback={
                        <div className="napkin__canvas-wrap">
                          <div className="napkin__loading mono">
                            {DICT[lang].napkin.loadingCanvas}
                          </div>
                        </div>
                      }
                    >
                      <SketchCanvas
                        loadingLabel={DICT[lang].napkin.loadingCanvas}
                        onApiReady={(api) => {
                          sketchApiRef.current = api
                        }}
                      />
                    </Suspense>
                    <div className="thread__media-panel-actions">
                      <button
                        type="button"
                        className="hero__cta"
                        disabled={mediaBusy}
                        onClick={onAttachSketch}
                      >
                        {mediaBusy ? tMedia.compose.processing : tMedia.compose.sketchAttach}
                      </button>
                      <button
                        type="button"
                        className="link-btn mono"
                        disabled={mediaBusy}
                        onClick={() => {
                          sketchApiRef.current = null
                          setComposeMedia('none')
                        }}
                      >
                        {tMedia.compose.sketchCancel}
                      </button>
                    </div>
                  </div>
                )}

                <div className="thread__form-actions">
                  <label className="link-btn mono thread__attach-trigger">
                    <input
                      type="file"
                      multiple
                      className="thread__attach-input"
                      disabled={
                        uploading || composeMedia !== 'none' || pendingAttachments.length >= 5
                      }
                      onChange={(e) => {
                        void onAttach(e.target.files)
                        e.target.value = ''
                      }}
                    />
                    {uploading ? t.attaching : `+ ${t.attachLabel}`}
                  </label>
                  <button
                    type="button"
                    className="link-btn mono thread__media-trigger"
                    disabled={composeMedia !== 'none' || pendingAttachments.length >= 5}
                    onClick={() => setComposeMedia('voice')}
                  >
                    {tMedia.compose.voiceTrigger}
                  </button>
                  <button
                    type="button"
                    className="link-btn mono thread__media-trigger"
                    disabled={composeMedia !== 'none' || pendingAttachments.length >= 5}
                    onClick={() => setComposeMedia('sketch')}
                  >
                    {tMedia.compose.sketchTrigger}
                  </button>
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
                      sending ||
                      uploading ||
                      mediaBusy ||
                      (!draft.trim() && pendingAttachments.length === 0)
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

/**
 * One sketch attachment in a thread. The editable Excalidraw scene is fetched
 * on demand (the ~600 KB canvas chunk + the network round-trip only land when
 * a visitor actually opens it) and rendered through <NapkinReplay>, so a
 * message sketch is pan/zoomable and replays stroke-by-stroke like the intake
 * napkin does.
 */
function SketchAttachment({
  att,
  sessionId,
  lang,
}: {
  att: AttachmentRow
  sessionId: string
  lang: Lang
}) {
  const tm = DICT[lang].media.thread
  const [open, setOpen] = useState(false)
  const [scene, setScene] = useState<NapkinScene | null>(null)
  const [failed, setFailed] = useState(false)

  const reveal = async () => {
    setOpen(true)
    if (scene || failed) return
    try {
      const res = await fetch(attachmentUrl(sessionId, att.id), { credentials: 'same-origin' })
      if (!res.ok) {
        setFailed(true)
        return
      }
      const json = (await res.json()) as { elements?: unknown }
      if (json && Array.isArray(json.elements)) setScene({ elements: json.elements })
      else setFailed(true)
    } catch {
      setFailed(true)
    }
  }

  return (
    <li className="thread__attach-tile thread__attach-tile--sketch">
      <div className="thread__sketch-head">
        <span className="mono thread__sketch-label">✎ {tm.sketchLabel}</span>
        <button
          type="button"
          className="link-btn mono"
          onClick={open ? () => setOpen(false) : reveal}
        >
          {open ? tm.sketchClose : tm.sketchOpen}
        </button>
      </div>
      {open && scene && <NapkinReplay lang={lang} scene={scene} />}
      {open && !scene && !failed && (
        <div className="napkin__loading mono">{DICT[lang].napkin.loadingCanvas}</div>
      )}
      {open && failed && <p className="mono thread__transcript-pending">—</p>}
    </li>
  )
}

function AttachmentTile({
  att,
  sessionId,
  lang,
  openLabel,
}: {
  att: AttachmentRow
  sessionId: string
  lang: Lang
  openLabel: string
}) {
  const url = attachmentUrl(sessionId, att.id)
  const tm = DICT[lang].media.thread

  // Voice note — an inline player plus the edge transcript (collapsed; Marc
  // reads to scan, listens when a session is borderline).
  if (att.kind === 'voice') {
    return (
      <li className="thread__attach-tile thread__attach-tile--voice">
        <div className="thread__voice">
          <span className="mono thread__voice-label">🎙 {tm.voiceLabel}</span>
          {/* No caption track for a visitor-recorded clip — the edge transcript
              rendered just below is the accessible text equivalent. */}
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio className="thread__voice-player" src={url} controls preload="metadata" />
        </div>
        {att.transcript ? (
          <details className="thread__transcript">
            <summary className="mono thread__transcript-label">{tm.transcriptLabel}</summary>
            <p className="thread__transcript-text">{att.transcript}</p>
          </details>
        ) : (
          <p className="mono thread__transcript-pending">{tm.transcriptPending}</p>
        )}
      </li>
    )
  }

  if (att.kind === 'sketch') {
    return <SketchAttachment att={att} sessionId={sessionId} lang={lang} />
  }

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
 * same way he'd read the prose. Click "View sketch" to open the PNG full-size
 * in a new tab; right-click → "Save image as…" to download.
 *
 * Intakes submitted after the napkin was folded into the form also carry the
 * editable Excalidraw scene — "Open the interactive sketch" swaps the flat PNG
 * for a pan/zoomable canvas (<NapkinReplay>) that can also play the drawing
 * back stroke by stroke. The ~600 KB Excalidraw chunk only loads on that click.
 */
function NapkinSection({ lang, napkin }: { lang: Lang; napkin: ParsedNapkin }) {
  const t = DICT[lang].napkin
  const hasScene = !!napkin.scene && napkin.scene.elements.length > 0
  const [sceneOpen, setSceneOpen] = useState(false)
  return (
    <div className="session-napkin">
      <div className="session-napkin__head">
        <span className="section__eyebrow">{t.eyebrow}</span>
        <div className="session-napkin__actions">
          {hasScene && (
            <button
              type="button"
              className="mono session-napkin__toggle"
              onClick={() => setSceneOpen((open) => !open)}
            >
              {sceneOpen ? t.sceneHide : t.sceneOpen}
            </button>
          )}
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
      </div>
      {napkin.text && <p className="session-napkin__caption">{napkin.text}</p>}
      <div className="session-napkin__frame">
        {sceneOpen && napkin.scene ? (
          <NapkinReplay lang={lang} scene={napkin.scene} />
        ) : (
          <img
            src={napkin.png}
            alt={napkin.text || 'Napkin sketch'}
            className="session-napkin__img"
          />
        )}
      </div>
    </div>
  )
}

/**
 * The napkin as the through-line. Pinned high on the session so the sketch
 * the visitor arrived with stays present the whole way through. Once the
 * session ships it completes into a from-sketch-to-shipped pairing — the
 * first scribble beside what it became, a small keepsake of the arc.
 */
function NapkinArc({
  lang,
  napkin,
  session,
  currentBuild,
}: {
  lang: Lang
  napkin: ParsedNapkin
  session: SessionRow
  currentBuild: AdvancementRow | null
}) {
  const t = COPY[lang]
  const shipped = session.status === 'shipped'
  const buildHref = currentBuild?.build_url
    ? `${currentBuild.build_url}${currentBuild.iframe_path ?? ''}`
    : null
  return (
    <section
      className="intake__step session-frame__panel session-arc"
      data-shipped={shipped || undefined}
    >
      <h2>{shipped ? t.arcShippedHeading : t.arcPinnedHeading}</h2>
      <div className="session-arc__pair">
        <div className="session-arc__col">
          {shipped && <span className="mono session-arc__col-label">{t.arcSketchLabel}</span>}
          <NapkinSection lang={lang} napkin={napkin} />
        </div>
        {shipped && (
          <>
            <div className="session-arc__arrow" aria-hidden="true">
              →
            </div>
            <div className="session-arc__col session-arc__col--shipped">
              <span className="mono session-arc__col-label">{t.arcShippedLabel}</span>
              <div className="session-arc__shipped">
                <h3 className="session-arc__shipped-title">
                  {session.showcase_title?.trim() || t.arcShippedFallback}
                </h3>
                {session.showcase_tagline?.trim() && (
                  <p className="session-arc__shipped-tagline">{session.showcase_tagline}</p>
                )}
                {buildHref && (
                  <a
                    className="mono session-arc__shipped-link"
                    href={buildHref}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t.arcViewLive}
                  </a>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  )
}

/**
 * The "generous no" — shown when a session is `rejected`. A decline isn't a
 * dead end: the visitor sees Marc's tailored note (if he wrote one) framed
 * by standing pointers — the free Tier 0 tools, the always-open door to a
 * fresh request. Admin sees the same panel plus an editor for the note.
 */
function DeclinePanel({
  session,
  lang,
  isAdmin,
  onSaved,
}: {
  session: SessionRow
  lang: Lang
  isAdmin: boolean
  onSaved: (s: SessionRow) => void
}) {
  const t = COPY[lang]
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
    <section className="intake__step session-frame__panel decline-panel">
      <h2>{t.declineHeading}</h2>
      {note ? (
        <blockquote className="decline-panel__note">
          <span className="mono decline-panel__note-from">{t.declineNoteFrom}</span>
          <p>{note}</p>
        </blockquote>
      ) : (
        <p className="decline-panel__lead">{t.declineLead}</p>
      )}

      <div className="decline-panel__pointers">
        <span className="mono decline-panel__pointers-heading">{t.declinePointersHeading}</span>
        <div className="decline-panel__pointer">
          <p>{t.declinePointerTier0}</p>
          <a className="decline-panel__pointer-link" href={`${langPrefix}/tier-0`}>
            {t.declinePointerTier0Link}
          </a>
        </div>
        <div className="decline-panel__pointer">
          <p>{t.declinePointerIntake}</p>
          <a className="decline-panel__pointer-link" href={`${langPrefix}/intake`}>
            {t.declinePointerIntakeLink}
          </a>
        </div>
      </div>

      {isAdmin && (
        <div className="decline-panel__editor">
          <label className="mono decline-panel__editor-label" htmlFor="decline-note">
            {t.declineNoteEditorLabel}
          </label>
          {!note && <p className="mono decline-panel__editor-empty">{t.declineNoteEmpty}</p>}
          <textarea
            id="decline-note"
            className="field__input decline-panel__textarea"
            rows={5}
            value={draft}
            placeholder={t.declineNoteEditorPlaceholder}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button
            type="button"
            className="link-btn mono"
            onClick={save}
            disabled={saving || draft.trim() === (session.decline_note ?? '').trim()}
          >
            {saving ? t.declineNoteSaving : t.declineNoteSave}
          </button>
        </div>
      )}
    </section>
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
