import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Lang } from '../i18n'
import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import { useAuth } from '../lib/authContext'
import {
  listSessions,
  createSession,
  deleteMyAccount,
  type SessionRow,
  type SessionStatus,
} from '../lib/sessionsApi'
import { clearDraft, loadDraftWithTTL } from '../lib/draft'
import { PENDING_INTAKE_KEY, type PendingIntake } from './Intake'
import { getSchemaForType, localized, type ProblemType } from '../lib/intakeSchemas'
import { computeSla, formatDate, formatRelativeWindow } from '../lib/format'
import { downloadJson, exportMyData } from '../lib/export'
import { isUnread, seedIfMissing } from '../lib/unread'
import {
  getPaymentSummary,
  openCustomerPortal,
  startCheckout,
  type PaymentKind,
  type PaymentSummary,
} from '../lib/paymentsApi'

const COPY = {
  fr: {
    eyebrow: 'console',
    title: 'Mon espace',
    sub: 'Tes sessions, tes données, ton compte. Tout au même endroit.',
    intro: (e: string) => `Connecté en tant que ${e}.`,
    tileSessionsTitle: 'Mes sessions',
    tileSessionsBody: (n: number, active: number) =>
      n === 0
        ? 'Aucune pour l’instant.'
        : `${n} session${n > 1 ? 's' : ''}${active > 0 ? ` · ${active} active${active > 1 ? 's' : ''}` : ''}.`,
    tileSessionsAction: 'Voir la liste ↓',
    tileNewTitle: 'Nouvelle proposition',
    tileNewBody: 'Démarre un intake pour un nouveau projet.',
    tileNewAction: 'Commencer →',
    tileDataTitle: 'Mes données',
    tileDataBody:
      'Loi 25 — droit d’accès. Télécharge un export JSON de toutes tes sessions et messages.',
    tileDataAction: 'Télécharger',
    tilePrivacyTitle: 'Confidentialité',
    tilePrivacyBody: 'Politique de confidentialité, hébergement, mes droits.',
    tilePrivacyAction: 'Lire la politique ↗',
    tileAccountTitle: 'Mon compte',
    tileAccountBody: 'Déconnexion ou suppression complète (Loi 25 — droit à l’effacement).',
    tileAccountSignout: 'Se déconnecter',
    tileAccountDelete: 'Supprimer mon compte',
    sectionSessionsTitle: 'Sessions',
    sectionAccountTitle: 'Compte & données',
    none: 'Aucune session pour l’instant.',
    noneCta: 'Démarre une nouvelle proposition de projet.',
    newBtn: 'Nouvelle proposition',
    finalizing: 'Finalisation de ton intake…',
    statusLabel: 'Statut',
    openBtn: 'Ouvrir →',
    logout: 'Se déconnecter',
    loading: 'Chargement…',
    notLoggedIn: 'Tu n’es pas connecté.',
    signIn: 'Se connecter',
    statsTotal: 'session(s)',
    statsActive: 'active',
    statsTriage: 'en triage',
    statsDraft: 'brouillon',
    statsShipped: 'livrée',
    statsRejected: 'refusée',
    statusNames: {
      draft: 'brouillon',
      triage: 'en triage',
      active: 'active',
      shipped: 'livrée',
      rejected: 'refusée',
    } as const,
    untitled: 'Session sans intake',
    searchPlaceholder: 'Filtrer par mot-clé…',
    filterAll: 'Toutes',
    noMatches: 'Aucune session ne correspond.',
    slaDueLabel: 'Réponse de Marc',
    slaOverdue: 'En retard',
    exportData: 'Télécharger mes données',
    exporting: 'Préparation…',
    deleteHeading: 'Supprimer mon compte et toutes mes données',
    deleteBody:
      'Loi 25 — droit à l’effacement. Cette action est immédiate et irréversible. Toutes tes sessions, messages et pièces jointes sont supprimés du serveur.',
    deleteBtn: 'Supprimer mes données',
    deleteConfirm: 'Confirmer la suppression',
    deleteCancel: 'Annuler',
    deleting: 'Suppression…',
    deleteFailed: 'La suppression a échoué — réessaie ou écris-moi.',
    unreadBadge: 'NOUVEAU',
    payNow: 'Payer maintenant →',
    payTier1: 'Payer Tier 1 (≈ 300 $) →',
    payTier2Deposit: 'Payer le dépôt (≈ 750 $) →',
    payTier2Final: 'Payer le solde (≈ 750 $) →',
    payTier3: 'Payer (sur devis) →',
    paid: 'Payé ✓',
    paidAmount: (amount: string) => `Payé · ${amount}`,
    paySubscribe: 'Devenir dépositaire (200 $/an) →',
    manageSub: 'Gérer l’abonnement ↗',
    custodianActive: 'Mode dépositaire · actif',
    custodianPastDue: 'Renouvellement échoué — voir l’abonnement',
    custodianSwitched: 'Mode Tout à toi (abonnement terminé)',
    checkoutPending: 'Ouverture du paiement…',
    paymentJustReceived: 'Merci — paiement reçu.',
    paymentCanceled: 'Paiement annulé. Tu peux réessayer.',
    helpToggle: 'Comment ça marche ?',
    helpItems: [
      {
        q: 'C’est quoi une session ?',
        a: 'Chaque demande que tu envoies est sauvegardée comme une « session ». Tu peux la rouvrir, la modifier, et discuter avec Marc dans le fil.',
      },
      {
        q: 'Que veulent dire les statuts ?',
        a: 'Brouillon = juste reçu. En triage = Marc lit et répond bientôt. Active = build en cours. Livrée = terminé. Refusée = pas un fit, Marc t’a expliqué pourquoi.',
      },
      {
        q: 'Pourquoi 72h ?',
        a: 'Marc s’engage à répondre — oui, non, ou « raconte-moi plus » — dans les 72 heures suivant ta soumission. Tu vois le compte à rebours sur chaque session en triage.',
      },
      {
        q: 'Lien magique ?',
        a: 'Pas de mot de passe. Tu reçois un lien par courriel valide 30 minutes. Clique-le pour te connecter. Tu peux en redemander un à tout moment.',
      },
      {
        q: 'Modifier ou retirer une session ?',
        a: 'Ouvre la session, clique « Modifier » pour ajuster tes réponses. « Retirer cette session » la cache du portail (Marc reçoit une notification).',
      },
      {
        q: 'Mes données ?',
        a: 'Tu peux télécharger un export JSON de toutes tes sessions (incluant le fil) avec le bouton ci-dessous.',
      },
    ],
  },
  en: {
    eyebrow: 'console',
    title: 'My space',
    sub: 'Your sessions, your data, your account. All in one place.',
    intro: (e: string) => `Signed in as ${e}.`,
    tileSessionsTitle: 'My sessions',
    tileSessionsBody: (n: number, active: number) =>
      n === 0
        ? 'None yet.'
        : `${n} session${n > 1 ? 's' : ''}${active > 0 ? ` · ${active} active` : ''}.`,
    tileSessionsAction: 'See the list ↓',
    tileNewTitle: 'New proposal',
    tileNewBody: 'Start an intake for a new project.',
    tileNewAction: 'Start →',
    tileDataTitle: 'My data',
    tileDataBody:
      'Bill 25 — right of access. Download a JSON export of all your sessions and messages.',
    tileDataAction: 'Download',
    tilePrivacyTitle: 'Privacy',
    tilePrivacyBody: 'Privacy policy, hosting, your rights.',
    tilePrivacyAction: 'Read the policy ↗',
    tileAccountTitle: 'My account',
    tileAccountBody: 'Sign out or delete entirely (Bill 25 — right to erasure).',
    tileAccountSignout: 'Sign out',
    tileAccountDelete: 'Delete my account',
    sectionSessionsTitle: 'Sessions',
    sectionAccountTitle: 'Account & data',
    none: 'No sessions yet.',
    noneCta: 'Start a new project proposal.',
    newBtn: 'New proposal',
    finalizing: 'Finalizing your intake…',
    statusLabel: 'Status',
    openBtn: 'Open →',
    logout: 'Sign out',
    loading: 'Loading…',
    notLoggedIn: "You're not signed in.",
    signIn: 'Sign in',
    statsTotal: 'session(s)',
    statsActive: 'active',
    statsTriage: 'in triage',
    statsDraft: 'draft',
    statsShipped: 'shipped',
    statsRejected: 'rejected',
    statusNames: {
      draft: 'draft',
      triage: 'in triage',
      active: 'active',
      shipped: 'shipped',
      rejected: 'rejected',
    } as const,
    untitled: 'Session without intake',
    searchPlaceholder: 'Filter by keyword…',
    filterAll: 'All',
    noMatches: 'No sessions match.',
    slaDueLabel: "Marc's reply",
    slaOverdue: 'Overdue',
    exportData: 'Download my data',
    exporting: 'Preparing…',
    deleteHeading: 'Delete my account and all my data',
    deleteBody:
      'Bill 25 — right to erasure. This action is immediate and irreversible. All your sessions, messages, and attachments are deleted from the server.',
    deleteBtn: 'Delete my data',
    deleteConfirm: 'Confirm deletion',
    deleteCancel: 'Cancel',
    deleting: 'Deleting…',
    deleteFailed: 'Deletion failed — retry or write to me.',
    unreadBadge: 'NEW',
    payNow: 'Pay now →',
    payTier1: 'Pay Tier 1 (≈ $300) →',
    payTier2Deposit: 'Pay deposit (≈ $750) →',
    payTier2Final: 'Pay final balance (≈ $750) →',
    payTier3: 'Pay (quoted amount) →',
    paid: 'Paid ✓',
    paidAmount: (amount: string) => `Paid · ${amount}`,
    paySubscribe: 'Become custodian ($200/yr) →',
    manageSub: 'Manage subscription ↗',
    custodianActive: 'Custodian mode · active',
    custodianPastDue: 'Renewal failed — open subscription',
    custodianSwitched: "Mode 'All yours' (subscription ended)",
    checkoutPending: 'Opening checkout…',
    paymentJustReceived: 'Thanks — payment received.',
    paymentCanceled: 'Payment canceled. You can try again.',
    helpToggle: 'How this works',
    helpItems: [
      {
        q: 'What is a session?',
        a: 'Every request you send is saved as a "session." You can reopen it, edit it, and chat with Marc in the thread.',
      },
      {
        q: 'What do the statuses mean?',
        a: "Draft = just received. Triage = Marc is reading and will reply soon. Active = build in progress. Shipped = done. Rejected = not a fit, Marc'll have told you why.",
      },
      {
        q: 'Why 72 hours?',
        a: "Marc commits to a reply — yes, no, or 'tell me more' — within 72 hours of submission. You'll see the countdown on every session in triage.",
      },
      {
        q: 'Magic link?',
        a: 'No password. You get a link by email valid for 30 minutes. Click to sign in. You can request a new one anytime.',
      },
      {
        q: 'Edit or withdraw a session?',
        a: "Open it, hit Edit to adjust your answers. 'Withdraw this session' hides it from the portal (Marc gets a heads-up).",
      },
      {
        q: 'My data?',
        a: 'You can download a JSON export of all your sessions (including the thread) with the button below.',
      },
    ],
  },
} as const

interface IntakePreview {
  type: ProblemType
  submittedAt: string
}

function previewFromIntake(raw: string | null): IntakePreview | null {
  if (!raw) return null
  try {
    const obj = JSON.parse(raw) as { type?: unknown; submittedAt?: unknown }
    if (typeof obj.type === 'string' && typeof obj.submittedAt === 'string') {
      return { type: obj.type as ProblemType, submittedAt: obj.submittedAt }
    }
  } catch {
    // fall through
  }
  return null
}

export function MePortal({ lang }: { lang: Lang }) {
  const t = COPY[lang]
  const navigate = useNavigate()
  const { email, loading, logout } = useAuth()
  const [sessions, setSessions] = useState<SessionRow[] | null>(null)
  // Initialise from localStorage at construction time. If a pending intake is
  // stashed, we render the "finalizing" spinner straight away — no setState
  // in an effect (that would trip react-hooks/set-state-in-effect).
  // Pending-intake stash: only honour it if saved in the last 7 days. An
  // abandoned magic-link flow shouldn't auto-resurrect months later.
  const [finalizing, setFinalizing] = useState<boolean>(
    () => loadDraftWithTTL<PendingIntake>(PENDING_INTAKE_KEY, 7 * 24 * 3600 * 1000) !== null,
  )
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<SessionStatus | 'all'>('all')
  const [exporting, setExporting] = useState(false)
  const [deleteState, setDeleteState] = useState<'idle' | 'confirming' | 'deleting' | 'error'>(
    'idle',
  )
  const langPrefix = lang === 'en' ? '/en' : ''

  const onDeleteAccount = async () => {
    if (deleteState !== 'confirming') {
      setDeleteState('confirming')
      return
    }
    setDeleteState('deleting')
    try {
      await deleteMyAccount()
      // Cookie is cleared server-side; navigate home and force a reload so the
      // auth context starts cold.
      window.location.href = lang === 'fr' ? '/' : '/en'
    } catch {
      setDeleteState('error')
    }
  }

  const onExport = async () => {
    if (!email || exporting) return
    setExporting(true)
    try {
      const bundle = await exportMyData(email)
      downloadJson(bundle)
    } finally {
      setExporting(false)
    }
  }

  useEffect(() => {
    document.title = `${t.title} — Marc`
  }, [t])

  // Pending-intake handoff. After a magic-link sign-in, the visitor lands
  // here; if their pre-login intake is stashed in localStorage we persist it
  // as a session and jump them straight into it. Idempotent: a missing or
  // wrong-email stash falls through to the normal session list.
  useEffect(() => {
    if (loading || !email) return
    const pending = loadDraftWithTTL<PendingIntake>(PENDING_INTAKE_KEY, 7 * 24 * 3600 * 1000)
    if (!pending) return

    let cancelled = false
    ;(async () => {
      try {
        const { session } = await createSession(pending.intake)
        if (cancelled) return
        clearDraft(PENDING_INTAKE_KEY)
        clearDraft('intake-draft')
        navigate(`${langPrefix}/session/${session.id}`, { replace: true })
      } catch {
        // Server rejected the stashed intake (rare). Surface the visitor's
        // session list so they aren't stuck on a spinner; they can re-submit.
        if (cancelled) return
        clearDraft(PENDING_INTAKE_KEY)
        setFinalizing(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [loading, email, navigate, langPrefix])

  useEffect(() => {
    if (!email || finalizing) return
    let cancelled = false
    listSessions()
      .then((r) => {
        if (cancelled) return
        // Seed last-seen for any session we've never tracked. Without this,
        // the visitor's own freshly-created session would render with a
        // "NEW" pill on first /me load.
        for (const s of r.sessions) seedIfMissing(s)
        setSessions(r.sessions)
      })
      .catch(() => {
        if (!cancelled) setSessions([])
      })
    return () => {
      cancelled = true
    }
  }, [email, finalizing])

  if (loading || finalizing) {
    return (
      <div className="app">
        <Header lang={lang} />
        <main id="main-content">
          <article className="section intake session-frame">
            <div className="section__inner">
              <p className="session-frame__pending">{finalizing ? t.finalizing : t.loading}</p>
            </div>
          </article>
        </main>
        <Footer lang={lang} />
      </div>
    )
  }

  if (!email) {
    return (
      <div className="app">
        <Header lang={lang} />
        <main id="main-content">
          <article className="section intake session-frame">
            <div className="section__inner">
              <div className="intake__step">
                <div className="section__eyebrow">{t.eyebrow}</div>
                <h1 className="session-frame__title">{t.title}</h1>
                <p>{t.notLoggedIn}</p>
                <p>
                  <a href={`${langPrefix}/login`} className="hero__cta">
                    {t.signIn}
                  </a>
                </p>
              </div>
            </div>
          </article>
        </main>
        <Footer lang={lang} />
      </div>
    )
  }

  const counts = countByStatus(sessions ?? [])
  const total = sessions?.length ?? 0
  const filtered = filterSessions(sessions ?? [], query, statusFilter, lang)

  const privacyHref = lang === 'fr' ? '/confidentialite' : '/en/privacy'

  return (
    <>
      <Header lang={lang} />
      <main className="me-portal me-portal--console">
        <section className="me-portal__head">
          <div className="section__eyebrow">{t.eyebrow}</div>
          <h1 className="me-portal__title">{t.title}</h1>
          <p className="me-portal__sub">{t.sub}</p>
          <p className="me-portal__intro mono">{t.intro(email)}</p>
        </section>

        {/* Tile-grid hub — quick-access to every visitor surface. The
            session list below is the working surface; tiles handle the
            "what else can I do here?" question without scrolling. */}
        <ul className="me-portal__tiles">
          <li className="me-portal__tile">
            <a href="#sessions" className="me-portal__tile-link">
              <div className="me-portal__tile-head">
                <h2 className="me-portal__tile-title">{t.tileSessionsTitle}</h2>
                {sessions !== null && sessions.length > 0 && (
                  <span className="mono me-portal__tile-badge">{total}</span>
                )}
              </div>
              <p className="me-portal__tile-body">
                {sessions === null ? t.loading : t.tileSessionsBody(total, counts.active)}
              </p>
              <span className="mono me-portal__tile-action">{t.tileSessionsAction}</span>
            </a>
          </li>

          <li className="me-portal__tile me-portal__tile--accent">
            <a href={`${langPrefix}/intake`} className="me-portal__tile-link">
              <div className="me-portal__tile-head">
                <h2 className="me-portal__tile-title">{t.tileNewTitle}</h2>
              </div>
              <p className="me-portal__tile-body">{t.tileNewBody}</p>
              <span className="mono me-portal__tile-action">{t.tileNewAction}</span>
            </a>
          </li>

          <li className="me-portal__tile">
            <button
              type="button"
              className="me-portal__tile-link me-portal__tile-link--btn"
              onClick={onExport}
              disabled={exporting || sessions === null || sessions.length === 0}
            >
              <div className="me-portal__tile-head">
                <h2 className="me-portal__tile-title">{t.tileDataTitle}</h2>
              </div>
              <p className="me-portal__tile-body">{t.tileDataBody}</p>
              <span className="mono me-portal__tile-action">
                {exporting ? t.exporting : t.tileDataAction}
              </span>
            </button>
          </li>

          <li className="me-portal__tile">
            <a href={privacyHref} target="_blank" rel="noreferrer" className="me-portal__tile-link">
              <div className="me-portal__tile-head">
                <h2 className="me-portal__tile-title">{t.tilePrivacyTitle}</h2>
              </div>
              <p className="me-portal__tile-body">{t.tilePrivacyBody}</p>
              <span className="mono me-portal__tile-action">{t.tilePrivacyAction}</span>
            </a>
          </li>
        </ul>

        <section className="me-portal__list-section" id="sessions">
          <h2 className="me-portal__section-title mono">{t.sectionSessionsTitle}</h2>
          <details className="me-portal__help">
            <summary className="me-portal__help-summary mono">{t.helpToggle}</summary>
            <ul className="me-portal__help-list">
              {t.helpItems.map((item) => (
                <li key={item.q} className="me-portal__help-item">
                  <strong>{item.q}</strong>
                  <p>{item.a}</p>
                </li>
              ))}
            </ul>
          </details>
          {sessions === null ? (
            <ul className="me-portal__cards" aria-busy="true">
              {Array.from({ length: 3 }).map((_, i) => (
                <li key={i} className="me-portal__skeleton">
                  <div className="me-portal__skeleton-bar me-portal__skeleton-bar--meta" />
                  <div className="me-portal__skeleton-bar me-portal__skeleton-bar--title" />
                </li>
              ))}
            </ul>
          ) : sessions.length === 0 ? (
            <div className="me-portal__empty">
              <div className="me-portal__empty-mark" aria-hidden="true">
                ✦
              </div>
              <p className="me-portal__empty-title">{t.none}</p>
              <p className="me-portal__empty-body">{t.noneCta}</p>
              <a href={`${langPrefix}/intake`} className="hero__cta">
                {t.newBtn}
              </a>
            </div>
          ) : (
            <>
              <div className="me-portal__toolbar">
                <input
                  type="search"
                  className="me-portal__search field__input"
                  placeholder={t.searchPlaceholder}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <div className="me-portal__filter-pills" role="tablist">
                  <FilterPill
                    active={statusFilter === 'all'}
                    onClick={() => setStatusFilter('all')}
                    label={t.filterAll}
                    n={total}
                  />
                  {(['active', 'triage', 'draft', 'shipped', 'rejected'] as const).map((s) =>
                    counts[s] > 0 ? (
                      <FilterPill
                        key={s}
                        active={statusFilter === s}
                        onClick={() => setStatusFilter(s)}
                        label={t.statusNames[s]}
                        n={counts[s]}
                        tone={s}
                      />
                    ) : null,
                  )}
                </div>
              </div>
              {filtered.length === 0 ? (
                <p className="me-portal__no-matches">{t.noMatches}</p>
              ) : (
                <ul className="me-portal__cards">
                  {filtered.map((s) => (
                    <SessionCard
                      key={s.id}
                      session={s}
                      lang={lang}
                      langPrefix={langPrefix}
                      copy={t}
                    />
                  ))}
                </ul>
              )}
            </>
          )}
        </section>

        <section className="me-portal__account-section">
          <h2 className="me-portal__section-title mono">{t.sectionAccountTitle}</h2>
          <div className="me-portal__account-actions">
            <button
              type="button"
              onClick={logout}
              className="link-btn mono me-portal__account-signout"
            >
              {t.tileAccountSignout}
            </button>
          </div>
          <div className="me-portal__danger-zone">
            <h3 className="me-portal__danger-heading">{t.deleteHeading}</h3>
            <p className="me-portal__danger-body">{t.deleteBody}</p>
            {deleteState === 'idle' || deleteState === 'error' ? (
              <button
                type="button"
                className="me-portal__danger-btn"
                onClick={() => setDeleteState('confirming')}
              >
                {t.deleteBtn}
              </button>
            ) : (
              <div className="me-portal__danger-actions">
                <button
                  type="button"
                  className="me-portal__danger-btn me-portal__danger-btn--confirm"
                  onClick={onDeleteAccount}
                  disabled={deleteState === 'deleting'}
                >
                  {deleteState === 'deleting' ? t.deleting : t.deleteConfirm}
                </button>
                <button
                  type="button"
                  className="link-btn mono"
                  onClick={() => setDeleteState('idle')}
                  disabled={deleteState === 'deleting'}
                >
                  {t.deleteCancel}
                </button>
              </div>
            )}
            {deleteState === 'error' && (
              <p className="me-portal__danger-error mono">{t.deleteFailed}</p>
            )}
          </div>
        </section>
      </main>
      <Footer lang={lang} />
    </>
  )
}

function filterSessions(
  sessions: SessionRow[],
  query: string,
  status: SessionStatus | 'all',
  lang: Lang,
): SessionRow[] {
  const q = query.trim().toLowerCase()
  return sessions.filter((s) => {
    if (status !== 'all' && s.status !== status) return false
    if (!q) return true
    if (s.id.toLowerCase().includes(q)) return true
    const preview = previewFromIntake(s.intake_json)
    if (preview) {
      const title = localized(getSchemaForType(preview.type).title, lang).toLowerCase()
      if (title.includes(q)) return true
      if (preview.submittedAt.toLowerCase().includes(q)) return true
    }
    return false
  })
}

function countByStatus(sessions: SessionRow[]) {
  const c = { draft: 0, triage: 0, active: 0, shipped: 0, rejected: 0 }
  for (const s of sessions) {
    if (s.status in c) c[s.status as keyof typeof c] += 1
  }
  return c
}

function FilterPill({
  active,
  label,
  n,
  tone,
  onClick,
}: {
  active: boolean
  label: string
  n: number
  tone?: 'active' | 'triage' | 'draft' | 'shipped' | 'rejected'
  onClick: () => void
}) {
  const cls = [
    'me-portal__filter-pill',
    active ? 'me-portal__filter-pill--active' : '',
    tone ? `me-portal__filter-pill--${tone}` : '',
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <button type="button" className={cls} onClick={onClick} role="tab" aria-selected={active}>
      <span>{label}</span>
      <span className="me-portal__filter-pill-n mono">{n}</span>
    </button>
  )
}

function SessionCard({
  session,
  lang,
  langPrefix,
  copy,
}: {
  session: SessionRow
  lang: Lang
  langPrefix: string
  copy: (typeof COPY)[Lang]
}) {
  const preview = previewFromIntake(session.intake_json)
  const title = preview ? localized(getSchemaForType(preview.type).title, lang) : copy.untitled
  const submittedAt = preview?.submittedAt ? formatDate(preview.submittedAt, lang) : null
  const href = `${langPrefix}/session/${session.id}`
  const statusLabel = copy.statusNames[session.status] ?? session.status
  const sla = computeSla(session)
  const unread = isUnread(session)
  return (
    <li className={`me-portal__card${unread ? ' me-portal__card--unread' : ''}`}>
      <a href={href} className="me-portal__card-link" aria-label={title}>
        <div className="me-portal__card-main">
          <div className="me-portal__card-meta">
            <span className="me-portal__id mono">{session.id.slice(0, 8)}</span>
            {submittedAt && <span className="me-portal__date">{submittedAt}</span>}
            {unread && (
              <span className="me-portal__unread mono" aria-label="new activity">
                {copy.unreadBadge}
              </span>
            )}
            {sla.active && (
              <span
                className={`me-portal__sla mono${sla.overdue ? ' me-portal__sla--overdue' : ''}`}
              >
                {copy.slaDueLabel}{' '}
                {sla.overdue ? copy.slaOverdue : formatRelativeWindow(sla.msLeft, lang)}
              </span>
            )}
          </div>
          <h2 className="me-portal__card-title">{title}</h2>
        </div>
        <div className="me-portal__card-side">
          <span
            className={`session-frame__status-pill session-frame__status-pill--${session.status}`}
          >
            {statusLabel}
          </span>
          <span className="me-portal__open mono">{copy.openBtn}</span>
        </div>
      </a>
      {session.status === 'active' && <PaymentActions session={session} lang={lang} copy={copy} />}
    </li>
  )
}

/**
 * Render-on-active payment surface. Lazy-fetches /api/payments?sessionId=...
 * and renders one of:
 *   - "Pay tier N →"  when the session has a tier classified and no paid deposit
 *   - "Paid · amount" when the deposit/payment is in (terminal state)
 *   - custodian-sub status link/pill mirroring sessions.custodian_status
 *
 * Hidden entirely for sessions that aren't active or whose tier is not yet set
 * (admin sets the tier in the showcase admin; that's the signal that pricing
 * is locked). Failure modes are silent — if /api/payments returns 503 (Stripe
 * not configured), the pill simply doesn't appear; visitor sees the regular
 * session card.
 */
function PaymentActions({
  session,
  lang,
  copy,
}: {
  session: SessionRow
  lang: Lang
  copy: (typeof COPY)[Lang]
}) {
  const [summary, setSummary] = useState<PaymentSummary | null>(null)
  const [pending, setPending] = useState<'idle' | 'checkout' | 'portal'>('idle')

  useEffect(() => {
    let cancelled = false
    getPaymentSummary(session.id)
      .then((s) => {
        if (!cancelled) setSummary(s)
      })
      .catch(() => {
        // 503 (Stripe unconfigured) / 404 / network — render nothing.
      })
    return () => {
      cancelled = true
    }
  }, [session.id])

  if (!summary) return null

  const onPay = async (kind: PaymentKind) => {
    setPending('checkout')
    try {
      const r = await startCheckout({ sessionId: session.id, kind, lang })
      window.location.assign(r.url)
    } catch {
      setPending('idle')
    }
  }
  const onPortal = async () => {
    setPending('portal')
    try {
      const r = await openCustomerPortal({ sessionId: session.id, lang })
      window.location.assign(r.url)
    } catch {
      setPending('idle')
    }
  }

  // One-time payment button. Mapping: tier1 → one charge; tier2 → deposit
  // first, final later (separate row, separate Checkout); tier3 → quoted
  // (admin uses amount override via the API).
  let payButton: { label: string; kind: PaymentKind } | null = null
  if (session.tier === 1 && !summary.hasPaidDeposit) {
    payButton = { label: copy.payTier1, kind: 'tier1' }
  } else if (session.tier === 2) {
    const hasPaidDepositRow = summary.rows.some(
      (r) => r.kind === 'tier2-deposit' && r.status === 'paid',
    )
    const hasPaidFinalRow = summary.rows.some(
      (r) => r.kind === 'tier2-final' && r.status === 'paid',
    )
    if (!hasPaidDepositRow) {
      payButton = { label: copy.payTier2Deposit, kind: 'tier2-deposit' }
    } else if (!hasPaidFinalRow) {
      payButton = { label: copy.payTier2Final, kind: 'tier2-final' }
    }
  } else if (session.tier === 3 && !summary.hasPaidDeposit) {
    payButton = { label: copy.payTier3, kind: 'tier3' }
  }

  const showCustodianLink =
    summary.custodianStatus === 'active' || summary.custodianStatus === 'past_due'
  const showSwitchedNote = summary.custodianStatus === 'switched_to_tout_a_toi'
  // "Start subscription" surfaces when there's no live sub on the session.
  // 'switched_to_tout_a_toi' means a prior sub ended (visitor can re-subscribe);
  // 'canceled' is a historical state (no webhook writes it today but the type
  // allows it). Both flow back into a fresh Checkout via the same button.
  const showCustodianStartButton =
    summary.custodianStatus === 'none' ||
    summary.custodianStatus === 'switched_to_tout_a_toi' ||
    summary.custodianStatus === 'canceled'

  if (
    !payButton &&
    !summary.hasPaidDeposit &&
    !showCustodianLink &&
    !showSwitchedNote &&
    !showCustodianStartButton
  ) {
    // Tier not set AND no custodian state to surface. Card stays clean.
    return null
  }

  // Sum all paid one-time rows on this session so a Tier-2 visitor who paid
  // both deposit and final sees "Paid · $1500" rather than just the most
  // recent leg's $750. Custodian sub renewals are excluded (they're a
  // separate, perpetual flow with its own Manage link).
  const paidOneTimeCents = summary.rows
    .filter((r) => r.status === 'paid' && r.kind !== 'custodian-sub' && r.paid_at)
    .reduce((sum, r) => sum + r.amount_cents, 0)
  const paidLabel =
    paidOneTimeCents > 0 ? copy.paidAmount(formatCadCents(paidOneTimeCents, lang)) : copy.paid

  return (
    <div className="me-portal__card-payments mono">
      {payButton && (
        <button
          type="button"
          className="me-portal__pay-btn"
          onClick={() => onPay(payButton!.kind)}
          disabled={pending !== 'idle'}
        >
          {pending === 'checkout' ? copy.checkoutPending : payButton.label}
        </button>
      )}
      {summary.hasPaidDeposit && <span className="me-portal__pay-paid">{paidLabel}</span>}
      {showCustodianLink && (
        <button
          type="button"
          className="me-portal__pay-portal link-btn"
          onClick={onPortal}
          disabled={pending !== 'idle'}
        >
          {summary.custodianStatus === 'past_due' ? copy.custodianPastDue : copy.manageSub}
        </button>
      )}
      {showSwitchedNote && (
        <span className="me-portal__pay-switched">{copy.custodianSwitched}</span>
      )}
      {showCustodianStartButton && (
        <button
          type="button"
          className="me-portal__pay-portal link-btn"
          onClick={() => onPay('custodian-sub')}
          disabled={pending !== 'idle'}
        >
          {pending === 'checkout' ? copy.checkoutPending : copy.paySubscribe}
        </button>
      )}
    </div>
  )
}

/**
 * Format CAD cents per OQLF convention (FR) or standard locale (EN).
 * 75000 cents → "750,00 $" (fr-CA) or "CA$750.00" (en-CA).
 */
function formatCadCents(cents: number, lang: Lang): string {
  return new Intl.NumberFormat(lang === 'fr' ? 'fr-CA' : 'en-CA', {
    style: 'currency',
    currency: 'CAD',
    currencyDisplay: lang === 'fr' ? 'symbol' : 'narrowSymbol',
  }).format(cents / 100)
}
