import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Lang } from '../i18n'
import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import { useAuth } from '../lib/authContext'
import { listSessions, type SessionRow, type SessionStatus } from '../lib/sessionsApi'
import { getSchemaForType, localized, type ProblemType } from '../lib/intakeSchemas'
import { computeSla, formatDate, formatRelativeWindow } from '../lib/format'

const COPY = {
  fr: {
    eyebrow: 'admin',
    title: 'Inbox admin',
    intro: 'Toutes les sessions, toutes statuts confondus.',
    forbidden: 'Réservé à l’admin.',
    loading: 'Chargement…',
    none: 'Aucune session.',
    open: 'Ouvrir →',
    refreshing: 'Mise à jour…',
    logout: 'Se déconnecter',
    viewTrash: 'Voir la corbeille →',
    custodianLink: 'Tableau dépositaires →',
    untitled: 'Session sans intake',
    slaDueLabel: 'Réponse',
    slaOverdue: 'En retard',
    countLabel: (n: number) => `${n} session${n === 1 ? '' : 's'}`,
    needsAttentionHeading: 'À traiter',
    filterAll: 'Toutes',
    filterActiveNoTier: 'Active sans tier',
    filterT4NoQuote: 'Tier 4 sans devis',
    filterShippedNoMode: 'Livrée — mode à choisir',
    filterCustodianPastDue: 'Dépositaire en retard',
    noFiltered: 'Rien à traiter dans cette catégorie.',
  },
  en: {
    eyebrow: 'admin',
    title: 'Admin inbox',
    intro: 'All sessions, every status.',
    forbidden: 'Admin only.',
    loading: 'Loading…',
    none: 'No sessions.',
    open: 'Open →',
    refreshing: 'Refreshing…',
    logout: 'Sign out',
    viewTrash: 'View trash →',
    custodianLink: 'Custodian dashboard →',
    untitled: 'Session without intake',
    slaDueLabel: 'Reply',
    slaOverdue: 'Overdue',
    countLabel: (n: number) => `${n} session${n === 1 ? '' : 's'}`,
    needsAttentionHeading: 'Needs attention',
    filterAll: 'All',
    filterActiveNoTier: 'Active w/o tier',
    filterT4NoQuote: 'Tier 4 w/o quote',
    filterShippedNoMode: 'Shipped — mode TBD',
    filterCustodianPastDue: 'Custodian past due',
    noFiltered: 'Nothing in this bucket.',
  },
} as const

type AttentionFilter =
  | 'all'
  | 'active_no_tier'
  | 't4_no_quote'
  | 'shipped_no_mode'
  | 'custodian_past_due'

const THIRTY_DAYS_S = 30 * 24 * 3600

function matchesFilter(s: SessionRow, f: AttentionFilter, nowS: number): boolean {
  if (f === 'all') return true
  if (f === 'active_no_tier') return s.status === 'active' && s.tier === null
  if (f === 't4_no_quote') return s.tier === 4 && s.tier4_amount_cents === null
  if (f === 'shipped_no_mode')
    return (
      s.status === 'shipped' &&
      (s.custodian_status === null || s.custodian_status === 'none') &&
      // Exclude visitors who explicitly confirmed Tout à toi — they made
      // an active decision, no follow-up needed from Marc.
      s.all_yours_acknowledged_at === null &&
      nowS - s.updated_at < THIRTY_DAYS_S
    )
  if (f === 'custodian_past_due') return s.custodian_status === 'past_due'
  return false
}

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

const STATUS_ORDER: Record<SessionStatus, number> = {
  triage: 0,
  active: 1,
  draft: 2,
  shipped: 3,
  rejected: 4,
}

/**
 * Inbox sort: overdue-SLA rows first (regardless of status), then status
 * priority (triage → active → draft → shipped → rejected), then newest
 * updated_at. The SLA-first tier exists so Marc never opens the inbox to a
 * triage row that aged past 72h sitting below an active one. computeSla
 * only marks `active` for triage/draft anyway, so this doesn't reshuffle
 * shipped/rejected.
 */
function sortInboxRows(rows: SessionRow[]): SessionRow[] {
  return [...rows].sort((a, b) => {
    const aSla = computeSla(a)
    const bSla = computeSla(b)
    const aOverdue = aSla.active && aSla.overdue ? 1 : 0
    const bOverdue = bSla.active && bSla.overdue ? 1 : 0
    if (aOverdue !== bOverdue) return bOverdue - aOverdue
    const ds = STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
    if (ds !== 0) return ds
    return b.updated_at - a.updated_at
  })
}

function formatTime(unix: number, lang: Lang): string {
  return new Date(unix * 1000).toLocaleString(lang === 'fr' ? 'fr-CA' : 'en-CA', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

function AdminCard({
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
  const sla = computeSla(session)
  const href = `${langPrefix}/session/${session.id}`
  return (
    <li className="me-portal__card">
      <a href={href} className="me-portal__card-link" aria-label={`${session.email} — ${title}`}>
        <div className="me-portal__card-main">
          <div className="me-portal__card-meta">
            <span className="mono admin-inbox__email">{session.email}</span>
            <span className="me-portal__id mono">{session.id.slice(0, 8)}</span>
            {submittedAt && <span className="me-portal__date">{submittedAt}</span>}
            <span className="mono me-portal__date">{formatTime(session.updated_at, lang)}</span>
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
            {session.status}
          </span>
          <span className="me-portal__open mono">{copy.open}</span>
        </div>
      </a>
    </li>
  )
}

export function AdminInbox({ lang }: { lang: Lang }) {
  const t = COPY[lang]
  const navigate = useNavigate()
  const { email, isAdmin, loading: authLoading, logout } = useAuth()
  const [sessions, setSessions] = useState<SessionRow[] | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [attentionFilter, setAttentionFilter] = useState<AttentionFilter>('all')
  // Captured once at mount. Coarse-grained — only used as the reference for
  // "shipped within 30 days" which doesn't need second-precision freshness.
  // Lazy init keeps render pure (react-hooks/purity).
  const [nowS] = useState<number>(() => Math.floor(Date.now() / 1000))
  const langPrefix = lang === 'en' ? '/en' : ''

  // Precompute the bucket counts so pills can show "Tier 3 w/o quote (2)"
  // even when the filter isn't active. Cheap — runs only when sessions changes.
  const bucketCount = (f: AttentionFilter) =>
    (sessions ?? []).filter((s) => matchesFilter(s, f, nowS)).length
  const filteredSessions = (sessions ?? []).filter((s) => matchesFilter(s, attentionFilter, nowS))

  // Refresh callable from event handlers only (visibility-change). Has a
  // synchronous setRefreshing(true) at the top, which keeps it out of effect
  // bodies (per react-hooks/set-state-in-effect).
  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      const r = await listSessions()
      setSessions(sortInboxRows(r.sessions))
    } catch {
      setSessions([])
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    document.title = `${t.title} — Marc`
  }, [t])

  // Initial load — inline async with cancelled flag.
  useEffect(() => {
    if (authLoading) return
    if (!email) {
      navigate(`${langPrefix}/login`)
      return
    }
    if (!isAdmin) return
    let cancelled = false
    ;(async () => {
      try {
        const r = await listSessions()
        if (cancelled) return
        setSessions(sortInboxRows(r.sessions))
      } catch {
        if (!cancelled) setSessions([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [authLoading, email, isAdmin, navigate, langPrefix])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && isAdmin) refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [refresh, isAdmin])

  if (authLoading) {
    return (
      <div className="app">
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

  if (!email || !isAdmin) {
    return (
      <div className="app">
        <Header lang={lang} variant="session" />
        <main id="main-content">
          <article className="section intake session-frame">
            <div className="section__inner">
              <div className="intake__step">
                <div className="section__eyebrow">{t.eyebrow}</div>
                <h1 className="session-frame__title">{t.forbidden}</h1>
              </div>
            </div>
          </article>
        </main>
        <Footer lang={lang} />
      </div>
    )
  }

  return (
    <div className="app">
      <Header lang={lang} variant="session" />
      <main id="main-content">
        <article className="section intake session-frame">
          <div className="section__inner">
            <header className="session-frame__header">
              <div className="section__eyebrow">{t.eyebrow}</div>
              <h1 className="session-frame__title">{t.title}</h1>
              <p>{t.intro}</p>
              <div className="session-frame__meta">
                {sessions !== null && (
                  <span className="mono admin-inbox__count">{t.countLabel(sessions.length)}</span>
                )}
                <a href={`${langPrefix}/admin/custodians`} className="link-btn mono">
                  {t.custodianLink}
                </a>
                <a href={`${langPrefix}/admin/trash`} className="link-btn mono">
                  {t.viewTrash}
                </a>
                <span
                  className="mono session-frame__refresh"
                  role="status"
                  aria-live="polite"
                  hidden={!refreshing}
                >
                  {refreshing ? t.refreshing : ''}
                </span>
              </div>
            </header>

            {sessions !== null && sessions.length > 0 && (
              <div
                className="admin-inbox__attention"
                role="tablist"
                aria-label={t.needsAttentionHeading}
              >
                <h2 className="admin-inbox__attention-heading mono">{t.needsAttentionHeading}</h2>
                <div className="admin-inbox__attention-pills">
                  <AttentionPill
                    active={attentionFilter === 'all'}
                    label={t.filterAll}
                    n={sessions.length}
                    onClick={() => setAttentionFilter('all')}
                  />
                  <AttentionPill
                    active={attentionFilter === 'active_no_tier'}
                    label={t.filterActiveNoTier}
                    n={bucketCount('active_no_tier')}
                    onClick={() => setAttentionFilter('active_no_tier')}
                    tone="warn"
                  />
                  <AttentionPill
                    active={attentionFilter === 't4_no_quote'}
                    label={t.filterT4NoQuote}
                    n={bucketCount('t4_no_quote')}
                    onClick={() => setAttentionFilter('t4_no_quote')}
                    tone="warn"
                  />
                  <AttentionPill
                    active={attentionFilter === 'shipped_no_mode'}
                    label={t.filterShippedNoMode}
                    n={bucketCount('shipped_no_mode')}
                    onClick={() => setAttentionFilter('shipped_no_mode')}
                    tone="info"
                  />
                  <AttentionPill
                    active={attentionFilter === 'custodian_past_due'}
                    label={t.filterCustodianPastDue}
                    n={bucketCount('custodian_past_due')}
                    onClick={() => setAttentionFilter('custodian_past_due')}
                    tone="urgent"
                  />
                </div>
              </div>
            )}

            {sessions === null ? (
              <p className="session-frame__pending">{t.loading}</p>
            ) : sessions.length === 0 ? (
              <div className="me-portal__empty">
                <p className="me-portal__empty-title">{t.none}</p>
              </div>
            ) : filteredSessions.length === 0 ? (
              <p className="me-portal__no-matches">{t.noFiltered}</p>
            ) : (
              <ul className="me-portal__cards">
                {filteredSessions.map((s) => (
                  <AdminCard key={s.id} session={s} lang={lang} langPrefix={langPrefix} copy={t} />
                ))}
              </ul>
            )}

            <p className="admin-inbox__signout">
              <button onClick={logout} className="link-btn mono">
                {t.logout}
              </button>
            </p>
          </div>
        </article>
      </main>
      <Footer lang={lang} />
    </div>
  )
}

function AttentionPill({
  active,
  label,
  n,
  onClick,
  tone,
}: {
  active: boolean
  label: string
  n: number
  onClick: () => void
  tone?: 'warn' | 'urgent' | 'info'
}) {
  const cls = [
    'admin-inbox__attention-pill',
    active ? 'admin-inbox__attention-pill--active' : '',
    tone ? `admin-inbox__attention-pill--${tone}` : '',
    n === 0 && !active ? 'admin-inbox__attention-pill--empty' : '',
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <button type="button" className={cls} onClick={onClick} role="tab" aria-selected={active}>
      <span>{label}</span>
      <span className="admin-inbox__attention-pill-n mono">{n}</span>
    </button>
  )
}
