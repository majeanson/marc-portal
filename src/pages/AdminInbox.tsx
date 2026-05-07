import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Lang } from '../i18n'
import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import { useAuth } from '../lib/authContext'
import { listSessions, type SessionRow, type SessionStatus } from '../lib/sessionsApi'

const COPY = {
  fr: {
    title: 'Inbox admin',
    intro: 'Toutes les sessions, toutes statuts confondus.',
    forbidden: 'Réservé à l’admin.',
    loading: 'Chargement…',
    none: 'Aucune session.',
    headerStatus: 'Statut',
    headerEmail: 'Visiteur',
    headerUpdated: 'Mis à jour',
    headerOpen: '',
    open: 'Ouvrir',
    refreshing: 'Mise à jour…',
    logout: 'Se déconnecter',
  },
  en: {
    title: 'Admin inbox',
    intro: 'All sessions, every status.',
    forbidden: 'Admin only.',
    loading: 'Loading…',
    none: 'No sessions.',
    headerStatus: 'Status',
    headerEmail: 'Visitor',
    headerUpdated: 'Updated',
    headerOpen: '',
    open: 'Open',
    refreshing: 'Refreshing…',
    logout: 'Sign out',
  },
} as const

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

  return (
    <>
      <Header lang={lang} />
      <main className="page">
        <section className="page__panel">
          <h1>{t.title}</h1>
          <p>{t.intro}</p>
          {refreshing && <p className="mono">{t.refreshing}</p>}

          {sessions === null ? (
            <p>{t.loading}</p>
          ) : sessions.length === 0 ? (
            <p>{t.none}</p>
          ) : (
            <table className="inbox-table">
              <thead>
                <tr>
                  <th>{t.headerStatus}</th>
                  <th>{t.headerEmail}</th>
                  <th>{t.headerUpdated}</th>
                  <th>{t.headerOpen}</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <span className={`status-pill status-pill--${s.status}`}>{s.status}</span>
                    </td>
                    <td>{s.email}</td>
                    <td className="mono">{formatTime(s.updated_at, lang)}</td>
                    <td>
                      <a href={`${langPrefix}/session/${s.id}`}>{t.open}</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <p>
            <button onClick={logout} className="form__link">
              {t.logout}
            </button>
          </p>
        </section>
      </main>
      <Footer lang={lang} />
    </>
  )
}
