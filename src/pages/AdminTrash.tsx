import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Lang } from '../i18n'
import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import { useAuth } from '../lib/authContext'
import { listSessions, undeleteSession, type SessionRow } from '../lib/sessionsApi'
import { formatDateTime } from '../lib/format'

const COPY = {
  fr: {
    title: 'Corbeille',
    intro: 'Sessions retirées (par le visiteur ou par l’admin). Restaurer les remet en triage.',
    forbidden: 'Réservé à l’admin.',
    loading: 'Chargement…',
    none: 'Aucune session retirée.',
    headerEmail: 'Visiteur',
    headerStatus: 'Statut',
    headerWithdrawn: 'Retirée le',
    headerActions: '',
    restore: 'Restaurer',
    restoring: 'Restauration…',
    backToInbox: '← Inbox',
    refreshing: 'Mise à jour…',
  },
  en: {
    title: 'Trash',
    intro: 'Withdrawn sessions (by visitor or by admin). Restoring brings them back to triage.',
    forbidden: 'Admin only.',
    loading: 'Loading…',
    none: 'No withdrawn sessions.',
    headerEmail: 'Visitor',
    headerStatus: 'Status',
    headerWithdrawn: 'Withdrawn',
    headerActions: '',
    restore: 'Restore',
    restoring: 'Restoring…',
    backToInbox: '← Inbox',
    refreshing: 'Refreshing…',
  },
} as const

export function AdminTrash({ lang }: { lang: Lang }) {
  const t = COPY[lang]
  const navigate = useNavigate()
  const { email, isAdmin, loading: authLoading } = useAuth()
  const [sessions, setSessions] = useState<SessionRow[] | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [pending, setPending] = useState<Set<string>>(new Set())
  const langPrefix = lang === 'en' ? '/en' : ''

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      const r = await listSessions({ deleted: true })
      setSessions(r.sessions)
    } catch {
      setSessions([])
    } finally {
      setRefreshing(false)
    }
  }, [])

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
    let cancelled = false
    ;(async () => {
      try {
        const r = await listSessions({ deleted: true })
        if (cancelled) return
        setSessions(r.sessions)
      } catch {
        if (!cancelled) setSessions([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [authLoading, email, isAdmin, navigate, langPrefix])

  const onRestore = async (id: string) => {
    setPending((s) => new Set(s).add(id))
    try {
      await undeleteSession(id)
      // Optimistically drop from list.
      setSessions((prev) => (prev ? prev.filter((s) => s.id !== id) : prev))
    } finally {
      setPending((s) => {
        const next = new Set(s)
        next.delete(id)
        return next
      })
    }
  }

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
          <p>
            <a href={`${langPrefix}/admin/inbox`}>{t.backToInbox}</a>
          </p>
          <h1>{t.title}</h1>
          <p>{t.intro}</p>
          <div role="status" aria-live="polite" className="mono session-page__saving">
            {refreshing ? t.refreshing : ''}
          </div>

          {sessions === null ? (
            <p>{t.loading}</p>
          ) : sessions.length === 0 ? (
            <p>{t.none}</p>
          ) : (
            <div className="table-scroll">
              <table className="inbox-table">
                <thead>
                  <tr>
                    <th>{t.headerEmail}</th>
                    <th>{t.headerStatus}</th>
                    <th>{t.headerWithdrawn}</th>
                    <th>{t.headerActions}</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => (
                    <tr key={s.id}>
                      <td>{s.email}</td>
                      <td>
                        <span className={`status-pill status-pill--${s.status}`}>{s.status}</span>
                      </td>
                      <td className="mono">
                        {s.deleted_at ? formatDateTime(s.deleted_at, lang) : '—'}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="link-btn mono"
                          onClick={() => onRestore(s.id)}
                          disabled={pending.has(s.id)}
                        >
                          {pending.has(s.id) ? t.restoring : t.restore}
                        </button>
                        {' · '}
                        <a href={`${langPrefix}/session/${s.id}`}>open</a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <button
            type="button"
            className="link-btn mono"
            onClick={refresh}
            style={{ marginTop: 12 }}
          >
            ↻ {t.refreshing.replace('…', '')}
          </button>
        </section>
      </main>
      <Footer lang={lang} />
    </>
  )
}
