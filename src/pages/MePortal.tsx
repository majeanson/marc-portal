import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Lang } from '../i18n'
import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import { useAuth } from '../lib/authContext'
import { listSessions, createSession, type SessionRow } from '../lib/sessionsApi'
import { loadDraft, clearDraft } from '../lib/draft'
import { PENDING_INTAKE_KEY, type PendingIntake } from './Intake'

const COPY = {
  fr: {
    title: 'Mes sessions',
    intro: (e: string) => `Connecté en tant que ${e}.`,
    none: 'Aucune session pour l’instant. Démarre une nouvelle proposition de projet.',
    newBtn: 'Nouvelle proposition',
    finalizing: 'Finalisation de ton intake…',
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
    finalizing: 'Finalizing your intake…',
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
  // Initialise from localStorage at construction time. If a pending intake is
  // stashed, we render the "finalizing" spinner straight away — no setState
  // in an effect (that would trip react-hooks/set-state-in-effect).
  const [finalizing, setFinalizing] = useState<boolean>(
    () => loadDraft<PendingIntake>(PENDING_INTAKE_KEY) !== null,
  )
  const langPrefix = lang === 'en' ? '/en' : ''

  useEffect(() => {
    document.title = `${t.title} — Marc`
  }, [t])

  // Pending-intake handoff. After a magic-link sign-in, the visitor lands
  // here; if their pre-login intake is stashed in localStorage we persist it
  // as a session and jump them straight into it. Idempotent: a missing or
  // wrong-email stash falls through to the normal session list.
  useEffect(() => {
    if (loading || !email) return
    const pending = loadDraft<PendingIntake>(PENDING_INTAKE_KEY)
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
        if (!cancelled) setSessions(r.sessions)
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

  return (
    <>
      <Header lang={lang} />
      <main className="page">
        <section className="page__panel">
          <h1>{t.title}</h1>
          <p>{t.intro(email)}</p>
          <p>
            <a href={`${langPrefix}/intake`} className="hero__cta">
              {t.newBtn}
            </a>
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
