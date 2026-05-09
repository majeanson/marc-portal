import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Lang } from '../i18n'
import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import { useAuth } from '../lib/authContext'
import {
  listSessions,
  createSession,
  type SessionRow,
  type SessionStatus,
} from '../lib/sessionsApi'
import { clearDraft, loadDraftWithTTL } from '../lib/draft'
import { PENDING_INTAKE_KEY, type PendingIntake } from './Intake'
import { getSchemaForType, localized, type ProblemType } from '../lib/intakeSchemas'
import { computeSla, formatDate, formatRelativeWindow } from '../lib/format'
import { downloadJson, exportMyData } from '../lib/export'
import { isUnread, seedIfMissing } from '../lib/unread'

const COPY = {
  fr: {
    eyebrow: 'portail',
    title: 'Mes sessions',
    intro: (e: string) => `Connecté en tant que ${e}.`,
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
    unreadBadge: 'NOUVEAU',
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
    eyebrow: 'portal',
    title: 'My sessions',
    intro: (e: string) => `Signed in as ${e}.`,
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
    unreadBadge: 'NEW',
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
  const langPrefix = lang === 'en' ? '/en' : ''

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
      <>
        <Header lang={lang} />
        <main className="page">
          <p>{finalizing ? t.finalizing : t.loading}</p>
        </main>
        <Footer lang={lang} />
      </>
    )
  }

  if (!email) {
    return (
      <>
        <Header lang={lang} />
        <main className="page">
          <section className="page__panel">
            <h1>{t.title}</h1>
            <p>{t.notLoggedIn}</p>
            <p>
              <a href={`${langPrefix}/login`} className="hero__cta">
                {t.signIn}
              </a>
            </p>
          </section>
        </main>
        <Footer lang={lang} />
      </>
    )
  }

  const counts = countByStatus(sessions ?? [])
  const total = sessions?.length ?? 0
  const filtered = filterSessions(sessions ?? [], query, statusFilter, lang)

  return (
    <>
      <Header lang={lang} />
      <main className="me-portal">
        <section className="me-portal__hero">
          <div className="me-portal__hero-inner">
            <div className="section__eyebrow">{t.eyebrow}</div>
            <h1 className="me-portal__title">{t.title}</h1>
            <p className="me-portal__intro mono">{t.intro(email)}</p>

            {sessions !== null && sessions.length > 0 && (
              <div className="me-portal__stats">
                <Stat n={total} label={t.statsTotal} />
                {counts.active > 0 && (
                  <Stat n={counts.active} label={t.statsActive} tone="active" />
                )}
                {counts.triage > 0 && (
                  <Stat n={counts.triage} label={t.statsTriage} tone="triage" />
                )}
                {counts.draft > 0 && <Stat n={counts.draft} label={t.statsDraft} tone="draft" />}
                {counts.shipped > 0 && (
                  <Stat n={counts.shipped} label={t.statsShipped} tone="shipped" />
                )}
              </div>
            )}

            <div className="me-portal__hero-actions">
              <a href={`${langPrefix}/intake`} className="hero__cta">
                {t.newBtn}
              </a>
              {sessions !== null && sessions.length > 0 && (
                <button
                  type="button"
                  onClick={onExport}
                  className="link-btn mono"
                  disabled={exporting}
                >
                  {exporting ? t.exporting : t.exportData}
                </button>
              )}
              <button onClick={logout} className="link-btn mono me-portal__logout">
                {t.logout}
              </button>
            </div>
          </div>
        </section>

        <section className="me-portal__list-section">
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

function Stat({
  n,
  label,
  tone,
}: {
  n: number
  label: string
  tone?: 'active' | 'triage' | 'draft' | 'shipped' | 'rejected'
}) {
  return (
    <div className={`me-portal__stat${tone ? ` me-portal__stat--${tone}` : ''}`}>
      <span className="me-portal__stat-n">{n}</span>
      <span className="me-portal__stat-label">{label}</span>
    </div>
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
          <span className={`me-portal__pill me-portal__pill--${session.status}`}>
            {statusLabel}
          </span>
          <span className="me-portal__open mono">{copy.openBtn}</span>
        </div>
      </a>
    </li>
  )
}
