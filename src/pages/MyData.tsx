/**
 * /me/data + /en/me/data — "Mes données" / "My data".
 *
 * The Loi 25 right-of-access, reimagined. The machine-readable JSON export
 * still exists (the download button below), but this page renders the same
 * data as a designed, plain-language document: "everything I hold about
 * you, in clear words, on one page." A legal obligation turned into a trust
 * statement. Print-friendly — a visitor can keep a paper copy.
 *
 * Auth-gated like /me: the AuthProvider supplies the email; a signed-out
 * visitor sees the sign-in prompt.
 */

import { useEffect, useState, type ReactNode } from 'react'
import type { Lang } from '../i18n'
import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import { SectionEyebrow } from '../components/SectionEyebrow'
import { IntakeSummary } from '../components/intake/IntakeSummary'
import { useAuth } from '../lib/authContext'
import { exportMyData, downloadJson, type ExportBundle } from '../lib/export'
import { formatDate } from '../lib/format'
import type { ProblemType } from '../lib/intakeSchemas'
import type { SessionStatus } from '../lib/sessionsApi'

interface ParsedIntake {
  type: ProblemType
  account: { email: string; name?: string }
  formData: Record<string, string>
  submittedAt: string
  napkin?: { png: string; text: string; savedAt: string }
}

function parseIntake(raw: string | null): ParsedIntake | null {
  if (!raw) return null
  try {
    const p = JSON.parse(raw)
    if (p && typeof p === 'object' && p.type && p.account && p.formData) return p as ParsedIntake
  } catch {
    // fall through
  }
  return null
}

const COPY = {
  fr: {
    pageTitle: 'Mes données — Marc',
    eyebrow: 'loi 25 · droit d’accès',
    title: 'Ce que je détiens sur toi',
    lead: 'Pas un fichier brut, pas du jargon : voici, en clair, toutes les données que ce portail garde à ton sujet. Tu as le droit de les voir — la Loi 25 le dit, et c’est normal.',
    generatedFor: (email: string) => `Préparé pour ${email}`,
    generatedAt: (iso: string) => `le ${formatDate(iso, 'fr')}`,
    countLine: (n: number) =>
      n === 0 ? 'Aucune session — donc presque rien.' : `${n} session${n > 1 ? 's' : ''}.`,
    downloadJson: 'Télécharger en JSON',
    print: 'Imprimer',
    loading: 'Je rassemble tes données…',
    empty:
      'Je ne détiens aucune session à ton nom. Le seul renseignement que je garde est ton courriel, pour te reconnaître quand tu reviens.',
    notLoggedIn: 'Connecte-toi pour voir les données que je garde sur toi.',
    signIn: 'Se connecter',
    sessionHeading: (title: string) => title,
    statusLabel: 'État',
    createdLabel: 'Ouverte le',
    updatedLabel: 'Dernière mise à jour',
    napkinHeading: 'Le croquis que tu as apporté',
    threadHeading: (n: number) =>
      n === 0
        ? 'Aucun message échangé.'
        : `${n} message${n > 1 ? 's' : ''} échangé${n > 1 ? 's' : ''}`,
    you: 'Toi',
    marc: 'Marc',
    attachmentsLine: (n: number) => `${n} pièce${n > 1 ? 's' : ''} jointe${n > 1 ? 's' : ''}`,
    intakeUnavailable: 'Les détails de cette demande ne sont plus lisibles.',
    rightsHeading: 'Tes droits',
    rightsBody:
      'Tu peux corriger ces renseignements en m’écrivant dans le fil d’une session. Tu peux aussi tout effacer, d’un coup, depuis ton espace — aucune question posée.',
    erasureLink: 'Effacer tout mon compte →',
    privacyLink: 'Lire la politique de confidentialité ↗',
    backToMe: '← Retour à mon espace',
    statusNames: {
      draft: 'brouillon',
      triage: 'en triage',
      active: 'en cours',
      shipped: 'livré',
      rejected: 'pas retenu',
    } as Record<SessionStatus, string>,
  },
  en: {
    pageTitle: 'My data — Marc',
    eyebrow: 'bill 25 · right of access',
    title: 'What I hold about you',
    lead: 'Not a raw file, not jargon: here, in plain words, is every piece of data this portal keeps about you. You have the right to see it — Bill 25 says so, and that’s how it should be.',
    generatedFor: (email: string) => `Prepared for ${email}`,
    generatedAt: (iso: string) => `on ${formatDate(iso, 'en')}`,
    countLine: (n: number) =>
      n === 0 ? 'No sessions — so almost nothing.' : `${n} session${n > 1 ? 's' : ''}.`,
    downloadJson: 'Download as JSON',
    print: 'Print',
    loading: 'Gathering your data…',
    empty:
      'I hold no sessions in your name. The only thing I keep is your email, to recognise you when you return.',
    notLoggedIn: 'Sign in to see the data I keep about you.',
    signIn: 'Sign in',
    sessionHeading: (title: string) => title,
    statusLabel: 'Status',
    createdLabel: 'Opened on',
    updatedLabel: 'Last updated',
    napkinHeading: 'The sketch you brought',
    threadHeading: (n: number) =>
      n === 0 ? 'No messages exchanged.' : `${n} message${n > 1 ? 's' : ''} exchanged`,
    you: 'You',
    marc: 'Marc',
    attachmentsLine: (n: number) => `${n} attachment${n > 1 ? 's' : ''}`,
    intakeUnavailable: 'The details of this request are no longer readable.',
    rightsHeading: 'Your rights',
    rightsBody:
      'You can correct any of this by writing to me in a session thread. You can also erase all of it, at once, from your space — no questions asked.',
    erasureLink: 'Erase my whole account →',
    privacyLink: 'Read the privacy policy ↗',
    backToMe: '← Back to my space',
    statusNames: {
      draft: 'draft',
      triage: 'in triage',
      active: 'in progress',
      shipped: 'shipped',
      rejected: 'not taken on',
    } as Record<SessionStatus, string>,
  },
} as const

export function MyData({ lang }: { lang: Lang }) {
  const t = COPY[lang]
  const { email, loading } = useAuth()
  const langPrefix = lang === 'en' ? '/en' : ''
  const [bundle, setBundle] = useState<ExportBundle | null>(null)

  useEffect(() => {
    document.title = t.pageTitle
  }, [t])

  useEffect(() => {
    if (loading || !email) return
    let cancelled = false
    exportMyData(email)
      .then((b) => {
        if (!cancelled) setBundle(b)
      })
      .catch(() => {
        // An empty bundle still renders the page honestly.
        if (!cancelled)
          setBundle({
            exportFormat: 'marc-portal-export-v1',
            exportedAt: new Date().toISOString(),
            exportedBy: email,
            sessions: [],
          })
      })
    return () => {
      cancelled = true
    }
  }, [email, loading])

  const shell = (children: ReactNode) => (
    <div className="app">
      <Header lang={lang} variant="session" />
      <main id="main-content">
        <article className="section">
          <div className="section__inner privacy mydata">{children}</div>
        </article>
      </main>
      <Footer lang={lang} />
    </div>
  )

  if (loading) return shell(<p className="mydata__pending mono">{t.loading}</p>)

  if (!email) {
    return shell(
      <>
        <SectionEyebrow lang={lang} feature={undefined}>
          {t.eyebrow}
        </SectionEyebrow>
        <h1>{t.title}</h1>
        <p className="privacy__intro">{t.notLoggedIn}</p>
        <p>
          <a href={`${langPrefix}/login`} className="hero__cta">
            {t.signIn}
          </a>
        </p>
      </>,
    )
  }

  if (!bundle) return shell(<p className="mydata__pending mono">{t.loading}</p>)

  return shell(
    <>
      <a className="mydata__back mono" href={`${langPrefix}/me`}>
        {t.backToMe}
      </a>
      <SectionEyebrow lang={lang} feature={undefined}>
        {t.eyebrow}
      </SectionEyebrow>
      <h1>{t.title}</h1>
      <p className="privacy__intro">{t.lead}</p>
      <p className="mono mydata__meta">
        {t.generatedFor(bundle.exportedBy)} · {t.generatedAt(bundle.exportedAt)} ·{' '}
        {t.countLine(bundle.sessions.length)}
      </p>

      <div className="mydata__actions">
        <button type="button" className="mydata__btn" onClick={() => downloadJson(bundle)}>
          {t.downloadJson}
        </button>
        <button
          type="button"
          className="mydata__btn mydata__btn--ghost"
          onClick={() => window.print()}
        >
          {t.print}
        </button>
      </div>

      {bundle.sessions.length === 0 && <p className="mydata__empty">{t.empty}</p>}

      {bundle.sessions.map(({ session, messages }) => {
        const intake = parseIntake(session.intake_json)
        const title = session.showcase_title?.trim() || `Session ${session.id.slice(0, 8)}`
        return (
          <section key={session.id} className="mydata__entry">
            <header className="mydata__entry-head">
              <h2 className="mydata__entry-title">{t.sessionHeading(title)}</h2>
              <span className="mono mydata__entry-status">
                {t.statusLabel} · {t.statusNames[session.status] ?? session.status}
              </span>
            </header>
            <p className="mono mydata__entry-dates">
              {t.createdLabel} {formatDate(new Date(session.created_at * 1000).toISOString(), lang)}
              {' · '}
              {t.updatedLabel} {formatDate(new Date(session.updated_at * 1000).toISOString(), lang)}
            </p>

            {intake ? (
              <div className="mydata__intake">
                <IntakeSummary
                  lang={lang}
                  account={intake.account}
                  type={intake.type}
                  values={intake.formData}
                  submittedAt={intake.submittedAt}
                />
              </div>
            ) : (
              <p className="mydata__muted">{t.intakeUnavailable}</p>
            )}

            {intake?.napkin?.png && (
              <figure className="mydata__napkin">
                <figcaption className="mono">{t.napkinHeading}</figcaption>
                <img src={intake.napkin.png} alt={t.napkinHeading} />
              </figure>
            )}

            <h3 className="mydata__thread-heading">{t.threadHeading(messages.length)}</h3>
            {messages.length > 0 && (
              <ol className="mydata__thread">
                {messages.map((m) => (
                  <li key={m.id} className="mydata__msg">
                    <p className="mono mydata__msg-meta">
                      {m.author === 'marc' ? t.marc : t.you} ·{' '}
                      {formatDate(new Date(m.created_at * 1000).toISOString(), lang)}
                      {m.attachments && m.attachments.length > 0 && (
                        <> · {t.attachmentsLine(m.attachments.length)}</>
                      )}
                    </p>
                    <p className="mydata__msg-body">{m.body}</p>
                  </li>
                ))}
              </ol>
            )}
          </section>
        )
      })}

      <section className="mydata__rights">
        <h2>{t.rightsHeading}</h2>
        <p>{t.rightsBody}</p>
        <p className="mydata__rights-links">
          <a href={`${langPrefix}/me`}>{t.erasureLink}</a>
          <a
            href={lang === 'fr' ? '/confidentialite' : '/en/privacy'}
            target="_blank"
            rel="noreferrer"
          >
            {t.privacyLink}
          </a>
        </p>
      </section>
    </>,
  )
}
