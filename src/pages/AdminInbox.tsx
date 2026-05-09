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
    untitled: 'Session sans intake',
    slaDueLabel: 'Réponse',
    slaOverdue: 'En retard',
    countLabel: (n: number) => `${n} session${n === 1 ? '' : 's'}`,
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
    untitled: 'Session without intake',
    slaDueLabel: 'Reply',
    slaOverdue: 'Overdue',
    countLabel: (n: number) => `${n} session${n === 1 ? '' : 's'}`,
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

const STATUS_ORDER: Record<SessionStatus, number> = {
  triage: 0,
  active: 1,
  draft: 2,
  shipped: 3,
  rejected: 4,
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
  const langPrefix = lang === 'en' ? '/en' : ''

  // Refresh callable from event handlers only (visibility-change). Has a
  // synchronous setRefreshing(true) at the top, which keeps it out of effect
  // bodies (per react-hooks/set-state-in-effect).
  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      const r = await listSessions()
      const sorted = [...r.sessions].sort((a, b) => {
        const da = STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
        if (da !== 0) return da
        return b.updated_at - a.updated_at
      })
      setSessions(sorted)
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
        const sorted = [...r.sessions].sort((a, b) => {
          const da = STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
          if (da !== 0) return da
          return b.updated_at - a.updated_at
        })
        setSessions(sorted)
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
        <Header lang={lang} />
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
        <Header lang={lang} />
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
      <Header lang={lang} />
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

            {sessions === null ? (
              <p className="session-frame__pending">{t.loading}</p>
            ) : sessions.length === 0 ? (
              <div className="me-portal__empty">
                <p className="me-portal__empty-title">{t.none}</p>
              </div>
            ) : (
              <ul className="me-portal__cards">
                {sessions.map((s) => (
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
