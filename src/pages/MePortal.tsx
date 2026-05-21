import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { Lang } from '../i18n'
import { Header } from '../components/Header'
import { SectionEyebrow } from '../components/SectionEyebrow'
import { PAGE_FEATURE } from '../lib/features'
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
import { isUnread, seedIfMissing } from '../lib/unread'
import { PaymentActions } from '../components/PaymentActions'
import { LangPrefCard } from '../components/LangPrefCard'

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
      'Loi 25 — droit d’accès. Tout ce que je détiens sur toi, en clair, sur une page — et en JSON si tu veux.',
    tileDataAction: 'Voir mes données →',
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
    deleteHeading: 'Supprimer mon compte et toutes mes données',
    deleteBody:
      'Loi 25 — droit à l’effacement. Cette action est immédiate et irréversible. Toutes tes sessions, messages et pièces jointes sont supprimés du serveur.',
    deleteBtn: 'Supprimer mes données',
    deleteConfirm: 'Confirmer la suppression',
    deleteCancel: 'Annuler',
    deleting: 'Suppression…',
    deleteFailed: 'La suppression a échoué — réessaie ou écris-moi.',
    unreadBadge: 'NOUVEAU',
    // Payment copy now lives in src/components/PaymentActions.tsx (which owns
    // the section UI). Only the post-payment toast copy stays here because
    // it's rendered by /me's top-level <main>, not by PaymentActions.
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
        q: 'Lien de connexion ?',
        a: 'Pas de mot de passe. Tu reçois un lien par courriel valide 30 minutes. Clique-le pour te connecter. Tu peux en redemander un à tout moment — c’est gratuit et instantané.',
      },
      {
        q: 'Modifier ou retirer une session ?',
        a: 'Ouvre la session, clique « Modifier » pour ajuster tes réponses. « Retirer cette session » la cache du portail (Marc reçoit une notification).',
      },
      {
        q: 'Mes données ?',
        a: 'La tuile « Mes données » ouvre une page qui montre, en clair, tout ce que je détiens sur toi — avec un export JSON si tu en veux une copie.',
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
      'Bill 25 — right of access. Everything I hold about you, in plain words, on one page — and as JSON if you want it.',
    tileDataAction: 'See my data →',
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
    deleteHeading: 'Delete my account and all my data',
    deleteBody:
      'Bill 25 — right to erasure. This action is immediate and irreversible. All your sessions, messages, and attachments are deleted from the server.',
    deleteBtn: 'Delete my data',
    deleteConfirm: 'Confirm deletion',
    deleteCancel: 'Cancel',
    deleting: 'Deleting…',
    deleteFailed: 'Deletion failed — retry or write to me.',
    unreadBadge: 'NEW',
    // See FR side — payment copy lives in PaymentActions; toast copy stays.
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
        q: 'Sign-in link?',
        a: 'No password. You get a link by email valid for 30 minutes. Click to sign in. You can request a new one anytime — it’s free and instant.',
      },
      {
        q: 'Edit or withdraw a session?',
        a: "Open it, hit Edit to adjust your answers. 'Withdraw this session' hides it from the portal (Marc gets a heads-up).",
      },
      {
        q: 'My data?',
        a: 'The "My data" tile opens a page that shows, in plain words, everything I hold about you — with a JSON export if you want a copy.',
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
  const [deleteState, setDeleteState] = useState<'idle' | 'confirming' | 'deleting' | 'error'>(
    'idle',
  )
  const langPrefix = lang === 'en' ? '/en' : ''

  // Post-payment toast. Stripe redirects to /me?paid=1 (success) or ?paid=0
  // (visitor canceled at Checkout). Initialize from URL at construction so a
  // render-cycle race can't race past it.
  const [searchParams, setSearchParams] = useSearchParams()
  const [paymentToast, setPaymentToast] = useState<'paid' | 'canceled' | null>(() => {
    const v = searchParams.get('paid')
    return v === '1' ? 'paid' : v === '0' ? 'canceled' : null
  })
  // Once initialized, clear the URL params (so reload / share-link is clean)
  // and arm an auto-dismiss. Runs only when the toast first becomes non-null,
  // not on every searchParams change — react-router gives us a stable
  // setSearchParams, but reading searchParams.get() inside this effect would
  // re-fire it after we strip the params, which would race with auto-dismiss.
  useEffect(() => {
    if (paymentToast === null) return
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('paid')
        next.delete('pay')
        return next
      },
      { replace: true },
    )
    const timer = window.setTimeout(() => setPaymentToast(null), 8000)
    return () => window.clearTimeout(timer)
  }, [paymentToast, setSearchParams])

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
      <div className="app" data-feature={PAGE_FEATURE['page.me-portal']}>
        <Header lang={lang} variant="session" />
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
      <div className="app" data-feature={PAGE_FEATURE['page.me-portal']}>
        <Header lang={lang} variant="session" />
        <main id="main-content">
          <article className="section intake session-frame">
            <div className="section__inner">
              <div className="intake__step">
                <SectionEyebrow lang={lang} feature={PAGE_FEATURE['page.me-portal']}>
                  {t.eyebrow}
                </SectionEyebrow>
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
      <Header lang={lang} variant="session" />
      <main className="me-portal me-portal--console">
        {paymentToast !== null && (
          <div
            className={`me-portal__toast me-portal__toast--${paymentToast}`}
            role="status"
            aria-live="polite"
          >
            <span className="me-portal__toast-body">
              {paymentToast === 'paid' ? t.paymentJustReceived : t.paymentCanceled}
            </span>
            <button
              type="button"
              className="me-portal__toast-dismiss"
              onClick={() => setPaymentToast(null)}
              aria-label={lang === 'fr' ? 'Fermer' : 'Dismiss'}
            >
              ✕
            </button>
          </div>
        )}
        <section className="me-portal__head">
          <SectionEyebrow lang={lang} feature={PAGE_FEATURE['page.me-portal']}>
            {t.eyebrow}
          </SectionEyebrow>
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
            <a href={`${langPrefix}/me/data`} className="me-portal__tile-link">
              <div className="me-portal__tile-head">
                <h2 className="me-portal__tile-title">{t.tileDataTitle}</h2>
              </div>
              <p className="me-portal__tile-body">{t.tileDataBody}</p>
              <span className="mono me-portal__tile-action">{t.tileDataAction}</span>
            </a>
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
          <LangPrefCard lang={lang} />
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
      {session.status === 'active' && (
        <PaymentActions session={session} lang={lang} variant="compact" />
      )}
    </li>
  )
}
