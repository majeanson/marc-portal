import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Lang } from '../i18n'
import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import { useAuth } from '../lib/authContext'
import { listSessions, undeleteSession, type SessionRow } from '../lib/sessionsApi'
import { formatDateTime } from '../lib/format'
import { Surface } from '../components/Surface'
import { usePageMeta } from '../lib/usePageMeta'

const COPY = {
  fr: {
    title: 'Corbeille',
    intro:
      'Sessions retirées (par le visiteur ou par l’admin). Restaurer les remet avec le statut qu’elles avaient avant le retrait.',
    forbidden: 'Réservé à l’admin.',
    loading: 'Chargement…',
    loadError: 'Impossible de charger la corbeille. Réessaie.',
    retry: 'Réessayer',
    none: 'Aucune session retirée.',
    headerEmail: 'Visiteur',
    headerStatus: 'Statut',
    headerWithdrawn: 'Retirée le',
    headerActions: '',
    restore: 'Restaurer',
    restoring: 'Restauration…',
    restoreError: 'La restauration a pas passé. Réessaie.',
    backToInbox: '← Inbox',
    refreshing: 'Mise à jour…',
    statusLabels: {
      draft: 'Brouillon',
      triage: 'Triage',
      active: 'En cours',
      shipped: 'Livré',
      rejected: 'Refusé',
    },
  },
  en: {
    title: 'Trash',
    intro:
      'Withdrawn sessions (by visitor or by admin). Restoring brings them back with the status they had before withdrawal.',
    forbidden: 'Admin only.',
    loading: 'Loading…',
    loadError: 'Could not load the trash. Try again.',
    retry: 'Retry',
    none: 'No withdrawn sessions.',
    headerEmail: 'Visitor',
    headerStatus: 'Status',
    headerWithdrawn: 'Withdrawn',
    headerActions: '',
    restore: 'Restore',
    restoring: 'Restoring…',
    restoreError: "The restore didn't go through. Try again.",
    backToInbox: '← Inbox',
    refreshing: 'Refreshing…',
    statusLabels: {
      draft: 'Draft',
      triage: 'Triage',
      active: 'In progress',
      shipped: 'Shipped',
      rejected: 'Rejected',
    },
  },
} as const

export function AdminTrash({ lang }: { lang: Lang }) {
  const t = COPY[lang]
  const navigate = useNavigate()
  const { email, isAdmin, loading: authLoading } = useAuth()
  const [sessions, setSessions] = useState<SessionRow[] | null>(null)
  // Distinct from sessions===null (still loading) and sessions.length===0
  // (genuinely empty): a failed fetch must NOT read as "no withdrawn sessions"
  // or Marc can't tell a broken list from an empty trash at 11pm.
  const [loadError, setLoadError] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [pending, setPending] = useState<Set<string>>(new Set())
  // Distinct from loadError: a restore that fails leaves the row sitting in
  // the trash exactly where it was, but silently — without this, a 500 or
  // network blip looks identical to a successful restore that just hasn't
  // refreshed the list yet.
  const [restoreError, setRestoreError] = useState(false)
  const langPrefix = lang === 'en' ? '/en' : ''

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      const r = await listSessions({ deleted: true })
      setSessions(r.sessions)
      setLoadError(false)
    } catch {
      setLoadError(true)
    } finally {
      setRefreshing(false)
    }
  }, [])

  usePageMeta({ title: `${t.title} — Marc`, lang })

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
        setLoadError(false)
      } catch {
        if (!cancelled) setLoadError(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [authLoading, email, isAdmin, navigate, langPrefix])

  const onRestore = async (id: string) => {
    setPending((s) => new Set(s).add(id))
    setRestoreError(false)
    try {
      await undeleteSession(id)
      // Optimistically drop from list.
      setSessions((prev) => (prev ? prev.filter((s) => s.id !== id) : prev))
    } catch {
      setRestoreError(true)
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
      <div className="app">
        <Header lang={lang} />
        <main id="main-content" className="page">
          <p>{t.loading}</p>
        </main>
        <Footer lang={lang} />
      </div>
    )
  }

  if (!email || !isAdmin) {
    return (
      <div className="app">
        <Header lang={lang} />
        <main id="main-content" className="page">
          <Surface as="section" className="page__panel">
            <p>{t.forbidden}</p>
          </Surface>
        </main>
        <Footer lang={lang} />
      </div>
    )
  }

  return (
    <div className="app">
      <Header lang={lang} />
      <main id="main-content" className="page">
        <Surface as="section" className="page__panel">
          <p>
            <a href={`${langPrefix}/admin/inbox`}>{t.backToInbox}</a>
          </p>
          <h1>{t.title}</h1>
          <p>{t.intro}</p>
          <div role="status" aria-live="polite" className="mono session-page__saving">
            {refreshing ? t.refreshing : ''}
          </div>

          {restoreError && (
            <p role="alert" className="form__error">
              {t.restoreError}
            </p>
          )}

          {loadError ? (
            <p role="alert" className="form__error">
              {t.loadError}{' '}
              <button type="button" className="link-btn mono" onClick={refresh}>
                {t.retry}
              </button>
            </p>
          ) : sessions === null ? (
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
                        <span
                          className={`session-frame__status-pill session-frame__status-pill--${s.status}`}
                        >
                          {t.statusLabels[s.status]}
                        </span>
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
        </Surface>
      </main>
      <Footer lang={lang} />
    </div>
  )
}
