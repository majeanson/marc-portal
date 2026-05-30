import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import type { Lang } from '../i18n'
import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import { useAuth } from '../lib/authContext'
import { PAGE_FEATURE } from '../lib/features'
import { Surface } from '../components/Surface'
import { Field } from '../components/Field'

const COPY = {
  fr: {
    title: 'Connexion au portail',
    intro:
      'Entre ton courriel - on t’envoie un lien de connexion à usage unique. Pas de mot de passe.',
    emailLabel: 'Ton courriel',
    emailPlaceholder: 'ton@courriel.com',
    submit: 'Envoyer le lien',
    sending: 'Envoi…',
    reasons: {
      'missing-token': 'Le lien était incomplet. Demande-en un nouveau.',
      'unknown-token': 'Ce lien n’existe pas. Demande-en un nouveau.',
      'token-used': 'Ce lien a déjà été utilisé. Demande-en un nouveau.',
      'token-expired': 'Ce lien a expiré. Demande-en un nouveau.',
    } as Record<string, string>,
    alreadyLoggedIn: 'Tu es déjà connecté en tant que',
    goToMe: 'Aller à mes sessions',
  },
  en: {
    title: 'Sign in',
    intro: "Enter your email — I'll send you a one-time sign-in link. No password.",
    emailLabel: 'Your email',
    emailPlaceholder: 'you@email.com',
    submit: 'Send the link',
    sending: 'Sending…',
    reasons: {
      'missing-token': 'The link was incomplete. Request a new one.',
      'unknown-token': "That link doesn't exist. Request a new one.",
      'token-used': 'That link was already used. Request a new one.',
      'token-expired': 'That link has expired. Request a new one.',
    } as Record<string, string>,
    alreadyLoggedIn: 'You are already signed in as',
    goToMe: 'Go to my sessions',
  },
} as const

export function Login({ lang }: { lang: Lang }) {
  const t = COPY[lang]
  const navigate = useNavigate()
  const [search] = useSearchParams()
  const reason = search.get('reason') ?? ''
  const { email: currentEmail, isAdmin, requestLink } = useAuth()
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    document.title = `${t.title} — Marc`
  }, [t])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || submitting) return
    setSubmitting(true)
    await requestLink(email.trim(), lang)
    // Always navigate to the sent page, even on a soft failure — the server
    // returns 200 to avoid email enumeration. Visitor reads "check your email".
    navigate(`${lang === 'en' ? '/en' : ''}/login/sent?email=${encodeURIComponent(email.trim())}`)
  }

  if (currentEmail) {
    return (
      <>
        <Header lang={lang} />
        <main className="page" data-feature={PAGE_FEATURE['page.login']}>
          <Surface as="section" className="page__panel">
            <h1>{t.title}</h1>
            <p>
              {t.alreadyLoggedIn} <strong>{currentEmail}</strong>.
            </p>
            <p>
              <a
                href={
                  isAdmin
                    ? `${lang === 'en' ? '/en' : ''}/admin/inbox`
                    : `${lang === 'en' ? '/en' : ''}/me`
                }
              >
                {t.goToMe}
              </a>
            </p>
          </Surface>
        </main>
        <Footer lang={lang} />
      </>
    )
  }

  return (
    <>
      <Header lang={lang} />
      <main className="page" data-feature={PAGE_FEATURE['page.login']}>
        <Surface as="section" className="page__panel">
          <h1>{t.title}</h1>
          <p>{t.intro}</p>
          {reason && t.reasons[reason] && (
            <p role="alert" className="form__error">
              {t.reasons[reason]}
            </p>
          )}
          <form onSubmit={onSubmit} className="form">
            <Field
              id="email"
              type="email"
              label={t.emailLabel}
              required
              autoComplete="email"
              value={email}
              onChange={setEmail}
              placeholder={t.emailPlaceholder}
            />
            <button type="submit" disabled={submitting} className="hero__cta">
              {submitting ? t.sending : t.submit}
            </button>
          </form>
        </Surface>
      </main>
      <Footer lang={lang} />
    </>
  )
}
