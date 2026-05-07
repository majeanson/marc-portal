import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Lang } from '../i18n'
import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import { useAuth } from '../lib/authContext'
import { listSessions, createSession, type SessionRow } from '../lib/sessionsApi'

const COPY = {
  fr: {
    title: 'Mes sessions',
    intro: (e: string) => `Connecté en tant que ${e}.`,
    none: 'Aucune session pour l’instant. Démarre une nouvelle proposition de projet.',
    newBtn: 'Nouvelle proposition',
    creating: 'Création…',
    statusLabel: 'Statut :',
    openBtn: 'Ouvrir',
    logout: 'Se déconnecter',
    loading: 'Chargement…',
    notLoggedIn: 'Tu n’es pas connecté.',
    signIn: 'Se connecter',
  },
  en: {
    title: 'My sessions',
    intro: (e: string) => `Signed in as ${e}.`,
    none: 'No sessions yet. Start a new project proposal.',
    newBtn: 'New proposal',
    creating: 'Creating…',
    statusLabel: 'Status:',
    openBtn: 'Open',
    logout: 'Sign out',
    loading: 'Loading…',
    notLoggedIn: "You're not signed in.",
    signIn: 'Sign in',
  },
} as const

export function MePortal({ lang }: { lang: Lang }) {
  const t = COPY[lang]
  const navigate = useNavigate()
  const { email, loading, logout } = useAuth()
  const [sessions, setSessions] = useState<SessionRow[] | null>(null)
  const [creating, setCreating] = useState(false)
  const langPrefix = lang === 'en' ? '/en' : ''

  useEffect(() => {
    document.title = `${t.title} — Marc`
  }, [t])

  useEffect(() => {
    if (!email) return
    let cancelled = false
    listSessions()
      .then((r) => {
        if (!cancelled) setSessions(r.sessions)
      })
      .catch(() => {
        if (!cancelled) setSessions([])
      })
    return () => {
      cancelled = true
    }
  }, [email])

  if (loading) {
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

  const onCreate = async () => {
    if (creating) return
    setCreating(true)
    try {
      const { session } = await createSession()
      navigate(`${langPrefix}/session/${session.id}`)
    } finally {
      setCreating(false)
    }
  }

  return (
    <>
      <Header lang={lang} />
      <main className="page">
        <section className="page__panel">
          <h1>{t.title}</h1>
          <p>{t.intro(email)}</p>
          <p>
            <button onClick={onCreate} disabled={creating} className="hero__cta">
              {creating ? t.creating : t.newBtn}
            </button>
          </p>
          {sessions === null ? (
            <p>{t.loading}</p>
          ) : sessions.length === 0 ? (
            <p>{t.none}</p>
          ) : (
            <ul className="session-list">
              {sessions.map((s) => (
                <li key={s.id} className="session-list__item">
                  <span className="mono">{s.id.slice(0, 8)}</span>
                  <span>
                    {t.statusLabel} {s.status}
                  </span>
                  <a href={`${langPrefix}/session/${s.id}`}>{t.openBtn}</a>
                </li>
              ))}
            </ul>
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
