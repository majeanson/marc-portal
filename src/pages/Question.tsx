// « Pose une question » (/question + /en/question). Anonymous, no account: the
// light door for someone who is not ready to open a request. POSTs to
// /api/questions, which stores it for the digest and mails Marc with the
// visitor as Reply-To.

import { type FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { Footer } from '../components/Footer'
import { Header } from '../components/Header'
import { Surface } from '../components/Surface'
import type { Lang } from '../i18n'
import { ApiError } from '../lib/api'
import { frPunct } from '../lib/frPunct'
import { QUESTION_LIMITS, submitQuestion } from '../lib/questionsApi'
import { usePageMeta } from '../lib/usePageMeta'

// Single-use copy, so inline (house pattern 2).
const COPY = {
  fr: {
    pageTitle: 'Poser une question',
    heading: 'Pose ta question',
    lead: 'Pas besoin de compte ni de demande. Écris-moi ce que tu veux savoir, par exemple « est-ce le genre de truc que tu fais ? », et je te réponds par courriel.',
    emailLabel: 'Ton courriel',
    emailHint: 'Seulement pour te répondre. Je ne l’utilise pas autrement.',
    bodyLabel: 'Ta question',
    bodyPlaceholder: 'Ex : je gère un club de course, j’aimerais suivre les inscriptions…',
    send: 'Envoyer',
    sending: 'Envoi…',
    successHeading: 'Reçu, je te réponds par courriel.',
    successBody:
      'En général dans les 72 h. Si finalement tu veux lancer quelque chose, une demande se démarre en quelques minutes.',
    startRequest: 'Démarrer une demande →',
    backHome: 'Retour à l’accueil',
    errors: {
      email: 'Ce courriel ne semble pas valide.',
      body: `Ta question doit faire entre ${QUESTION_LIMITS.bodyMin} et ${QUESTION_LIMITS.bodyMax} caractères.`,
      rateLimit: 'Beaucoup de questions en peu de temps. Réessaie dans une heure.',
      generic: 'Hmm, ça n’a pas passé. Réessaie dans un instant.',
    },
  },
  en: {
    pageTitle: 'Ask a question',
    heading: 'Ask your question',
    lead: 'No account or request needed. Write what you want to know, for example “is this the kind of thing you do?”, and I’ll answer by email.',
    emailLabel: 'Your email',
    emailHint: 'Only to reply to you. I don’t use it for anything else.',
    bodyLabel: 'Your question',
    bodyPlaceholder: 'Ex: I run a running club and want to track sign-ups…',
    send: 'Send',
    sending: 'Sending…',
    successHeading: 'Got it, I’ll reply by email.',
    successBody:
      'Usually within 72 h. If you do want to start something, a request takes a few minutes to open.',
    startRequest: 'Start a request →',
    backHome: 'Back home',
    errors: {
      email: 'That email doesn’t look valid.',
      body: `Your question must be between ${QUESTION_LIMITS.bodyMin} and ${QUESTION_LIMITS.bodyMax} characters.`,
      rateLimit: 'A lot of questions in a short time. Try again in an hour.',
      generic: 'Hmm, that didn’t go through. Try again in a moment.',
    },
  },
} as const

export function Question({ lang }: { lang: Lang }) {
  const t = COPY[lang]
  const langPrefix = lang === 'en' ? '/en' : ''
  const [email, setEmail] = useState('')
  const [body, setBody] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [bodyError, setBodyError] = useState<string | null>(null)
  const [globalError, setGlobalError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  usePageMeta({ title: `${t.pageTitle} — Marc`, lang })

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (sending) return
    const trimmedEmail = email.trim()
    const trimmedBody = body.trim()
    const badEmail =
      !/\S+@\S+\.\S+/.test(trimmedEmail) || trimmedEmail.length > QUESTION_LIMITS.emailMax
    const badBody =
      trimmedBody.length < QUESTION_LIMITS.bodyMin || trimmedBody.length > QUESTION_LIMITS.bodyMax
    setEmailError(badEmail ? t.errors.email : null)
    setBodyError(badBody ? t.errors.body : null)
    setGlobalError(null)
    if (badEmail || badBody) return
    setSending(true)
    try {
      await submitQuestion({ email: trimmedEmail, body: trimmedBody })
      setSent(true)
    } catch (err) {
      setGlobalError(
        err instanceof ApiError && err.status === 429 ? t.errors.rateLimit : t.errors.generic,
      )
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="app">
      <Header lang={lang} />
      <main id="main-content" className="page">
        <Surface as="section" className="page__panel">
          {sent ? (
            <>
              <h1>{t.successHeading}</h1>
              <p>{t.successBody}</p>
              <p>
                <Link to={`${langPrefix}/intake`} className="hero__cta">
                  {t.startRequest}
                </Link>
              </p>
              <p>
                <Link to={langPrefix || '/'}>{t.backHome}</Link>
              </p>
            </>
          ) : (
            <>
              <h1>{t.heading}</h1>
              <p>{frPunct(t.lead)}</p>
              {globalError && (
                <p role="alert" className="form__error">
                  {globalError}
                </p>
              )}
              <form onSubmit={onSubmit} className="form" noValidate>
                <div className="field">
                  <label htmlFor="q-email" className="field__label">
                    {t.emailLabel}
                  </label>
                  <input
                    id="q-email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      setEmailError(null)
                    }}
                    className="input field__input"
                    autoComplete="email"
                    maxLength={QUESTION_LIMITS.emailMax}
                    required
                  />
                  <p className="field__hint">{t.emailHint}</p>
                  {emailError && (
                    <p role="alert" className="field__hint field__hint--error">
                      {emailError}
                    </p>
                  )}
                </div>
                <div className="field">
                  <label htmlFor="q-body" className="field__label">
                    {t.bodyLabel}
                  </label>
                  <textarea
                    id="q-body"
                    value={body}
                    onChange={(e) => {
                      setBody(e.target.value)
                      setBodyError(null)
                    }}
                    placeholder={t.bodyPlaceholder}
                    className="input field__input"
                    rows={6}
                    maxLength={QUESTION_LIMITS.bodyMax}
                    required
                  />
                  {bodyError && (
                    <p role="alert" className="field__hint field__hint--error">
                      {bodyError}
                    </p>
                  )}
                </div>
                <button type="submit" className="hero__cta" disabled={sending}>
                  {sending ? t.sending : t.send}
                </button>
              </form>
            </>
          )}
        </Surface>
      </main>
      <Footer lang={lang} />
    </div>
  )
}
