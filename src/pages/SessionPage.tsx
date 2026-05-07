import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { Lang } from '../i18n'
import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import { useAuth } from '../lib/authContext'
import {
  getSession,
  listMessages,
  patchSession,
  postMessage,
  type MessageRow,
  type SessionRow,
  type SessionStatus,
} from '../lib/sessionsApi'
import { ApiError } from '../lib/api'

const COPY = {
  fr: {
    title: 'Session',
    loading: 'Chargement…',
    notFound: 'Session introuvable.',
    forbidden: 'Tu n’as pas accès à cette session.',
    threadHeading: 'Discussion',
    none: 'Aucun message pour l’instant.',
    placeholder: 'Écris un message…',
    sending: 'Envoi…',
    send: 'Envoyer',
    you: 'Toi',
    marc: 'Marc',
    visitor: 'Visiteur',
    statusLabel: 'Statut',
    changeStatus: 'Changer le statut',
    intakeHeading: 'Intake',
    noIntake: 'Aucun contenu d’intake — la session a été démarrée vide.',
    backToInbox: '← Retour à la liste',
    backToMe: '← Retour à mes sessions',
    refreshing: 'Mise à jour…',
  },
  en: {
    title: 'Session',
    loading: 'Loading…',
    notFound: 'Session not found.',
    forbidden: "You don't have access to this session.",
    threadHeading: 'Thread',
    none: 'No messages yet.',
    placeholder: 'Write a message…',
    sending: 'Sending…',
    send: 'Send',
    you: 'You',
    marc: 'Marc',
    visitor: 'Visitor',
    statusLabel: 'Status',
    changeStatus: 'Change status',
    intakeHeading: 'Intake',
    noIntake: 'No intake content — session was started empty.',
    backToInbox: '← Back to inbox',
    backToMe: '← Back to my sessions',
    refreshing: 'Refreshing…',
  },
} as const

const STATUSES: SessionStatus[] = ['draft', 'triage', 'active', 'shipped', 'rejected']

function formatTime(unix: number, lang: Lang): string {
  return new Date(unix * 1000).toLocaleString(lang === 'fr' ? 'fr-CA' : 'en-CA', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

export function SessionPage({ lang }: { lang: Lang }) {
  const t = COPY[lang]
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { email, isAdmin, loading: authLoading } = useAuth()
  const [session, setSession] = useState<SessionRow | null>(null)
  const [messages, setMessages] = useState<MessageRow[]>([])
  const [error, setError] = useState<'forbidden' | 'notfound' | null>(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const langPrefix = lang === 'en' ? '/en' : ''

  // Refresh callable from event handlers only (post-send, visibility).
  // NOT called from inside a useEffect body — that would trip the
  // react-hooks/set-state-in-effect rule due to the synchronous setRefreshing.
  const refresh = useCallback(async () => {
    if (!id) return
    setRefreshing(true)
    try {
      const [s, m] = await Promise.all([getSession(id), listMessages(id)])
      setSession(s.session)
      setMessages(m.messages)
      setError(null)
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 404) setError('notfound')
        else if (err.status === 403) setError('forbidden')
        else if (err.status === 401) navigate(`${langPrefix}/login`)
      }
    } finally {
      setRefreshing(false)
    }
  }, [id, navigate, langPrefix])

  useEffect(() => {
    document.title = `${t.title} — Marc`
  }, [t])

  // Initial load. Inline async with cancelled flag — setState only fires in
  // .then-equivalent callback position (after await), which the lint rule
  // accepts. Avoids calling refresh() (which has a synchronous setState).
  useEffect(() => {
    if (authLoading || !id) return
    if (!email) {
      navigate(`${langPrefix}/login`)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const [s, m] = await Promise.all([getSession(id), listMessages(id)])
        if (cancelled) return
        setSession(s.session)
        setMessages(m.messages)
        setError(null)
      } catch (err) {
        if (cancelled) return
        if (err instanceof ApiError) {
          if (err.status === 404) setError('notfound')
          else if (err.status === 403) setError('forbidden')
          else if (err.status === 401) navigate(`${langPrefix}/login`)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [authLoading, email, id, navigate, langPrefix])

  // Visibility-based polling (per the bedrock decision: never push, never WS).
  // refresh() is invoked from inside the event handler, not the effect body.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [refresh])

  const onSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id || !draft.trim() || sending) return
    setSending(true)
    try {
      await postMessage(id, draft.trim())
      setDraft('')
      await refresh()
    } finally {
      setSending(false)
    }
  }

  const onStatusChange = async (next: SessionStatus) => {
    if (!id) return
    try {
      const r = await patchSession(id, { status: next })
      setSession(r.session)
    } catch {
      // ignore — server-side check will refuse non-admins anyway
    }
  }

  if (authLoading || (!session && !error)) {
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

  if (error === 'notfound') {
    return (
      <>
        <Header lang={lang} />
        <main className="page">
          <section className="page__panel">
            <p>{t.notFound}</p>
          </section>
        </main>
        <Footer lang={lang} />
      </>
    )
  }

  if (error === 'forbidden' || !session) {
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

  const backHref = isAdmin ? `${langPrefix}/admin/inbox` : `${langPrefix}/me`
  const backLabel = isAdmin ? t.backToInbox : t.backToMe
  const intakeText = session.intake_json
  let intakePretty: string | null = null
  if (intakeText) {
    try {
      intakePretty = JSON.stringify(JSON.parse(intakeText), null, 2)
    } catch {
      intakePretty = intakeText
    }
  }

  return (
    <>
      <Header lang={lang} />
      <main className="page session-page">
        <p>
          <a href={backHref}>{backLabel}</a>
        </p>
        <header className="session-page__header">
          <h1>
            {t.title} <span className="mono">{session.id.slice(0, 8)}</span>
          </h1>
          <div className="session-page__meta">
            <span>
              <strong>{t.statusLabel}:</strong> {session.status}
            </span>
            {refreshing && <span className="mono">{t.refreshing}</span>}
          </div>
        </header>

        {isAdmin && (
          <section className="page__panel">
            <h2 className="snd-demo__h">{t.changeStatus}</h2>
            <div className="status-buttons">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => onStatusChange(s)}
                  disabled={s === session.status}
                  className={`status-btn${s === session.status ? ' status-btn--current' : ''}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="page__panel">
          <h2 className="snd-demo__h">{t.intakeHeading}</h2>
          {intakePretty ? (
            <pre className="mono session-page__intake">{intakePretty}</pre>
          ) : (
            <p>{t.noIntake}</p>
          )}
        </section>

        <section className="page__panel">
          <h2 className="snd-demo__h">{t.threadHeading}</h2>
          {messages.length === 0 ? (
            <p>{t.none}</p>
          ) : (
            <ul className="thread">
              {messages.map((m) => {
                const isMe =
                  (isAdmin && m.author === 'marc') || (!isAdmin && m.author === 'visitor')
                const authorLabel = isMe ? t.you : m.author === 'marc' ? t.marc : t.visitor
                return (
                  <li
                    key={m.id}
                    className={`thread__msg thread__msg--${m.author}${isMe ? ' thread__msg--mine' : ''}`}
                  >
                    <div className="thread__head mono">
                      {authorLabel} · {formatTime(m.created_at, lang)}
                    </div>
                    <div className="thread__body">{m.body}</div>
                  </li>
                )
              })}
            </ul>
          )}

          <form onSubmit={onSend} className="thread__form">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t.placeholder}
              rows={3}
              className="form__input"
            />
            <button type="submit" disabled={sending || !draft.trim()} className="hero__cta">
              {sending ? t.sending : t.send}
            </button>
          </form>
        </section>
      </main>
      <Footer lang={lang} />
    </>
  )
}
