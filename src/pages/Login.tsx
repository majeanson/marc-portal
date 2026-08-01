import { useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import type { Lang } from '../i18n'
import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import { useAuth } from '../lib/authContext'
import { PAGE_FEATURE } from '../lib/features'
import { Surface } from '../components/Surface'
import { Field } from '../components/Field'
import { usePageMeta } from '../lib/usePageMeta'

const COPY = {
  fr: {
    title: 'Connexion au portail',
    intro:
      'Entre ton courriel - on t’envoie un lien de connexion à usage unique. Pas de mot de passe.',
    emailLabel: 'Ton courriel',
    emailPlaceholder: 'ton@courriel.com',
    submit: 'Envoyer le lien',
    sending: 'Envoi…',
    transportError: 'Ça n’a pas pu s’envoyer. Vérifie ta connexion pis réessaie.',
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
    transportError: "That didn't send. Check your connection and try again.",
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
  // MagicLinkSent's "resend" link round-trips the address here via ?email=
  // so a visitor who mistyped doesn't have to retype it from memory. Validate
  // before seeding — URLSearchParams.get already url-decodes, so a junk or
  // absent param just leaves the field blank rather than pre-filling garbage.
  const emailParam = search.get('email') ?? ''
  const [email, setEmail] = useState(/\S+@\S+\.\S+/.test(emailParam) ? emailParam : '')
  const [submitting, setSubmitting] = useState(false)
  const [transportError, setTransportError] = useState(false)

  usePageMeta({ title: `${t.title} — Marc`, lang })

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || submitting) return
    setSubmitting(true)
    setTransportError(false)
    const result = await requestLink(email.trim(), lang)
    // requestLink().sent is false in exactly one case: the request itself
    // never reached the server (offline, DNS, server down) — a fetch that
    // threw. That's distinct from the anti-enumeration 200 the server always
    // sends once the request lands, which we can't and shouldn't distinguish
    // from "no such account" here. So: false → the visitor's email was never
    // submitted, stay on the form and say so; true → the server has it
    // (real or not), always advance to "check your email" without leaking
    // which.
    if (!result.sent) {
      setTransportError(true)
      setSubmitting(false)
      return
    }
    // `suppressed` rides along on the URL to /login/sent — it only ever
    // reflects deliverability for the exact address this visitor just
    // typed (see MagicLinkSent.tsx), so passing it through a query param
    // that only they see isn't a new enumeration surface.
    const suppressedSuffix = result.suppressed ? `&suppressed=${result.suppressed}` : ''
    navigate(
      `${lang === 'en' ? '/en' : ''}/login/sent?email=${encodeURIComponent(email.trim())}${suppressedSuffix}`,
    )
  }

  if (currentEmail) {
    return (
      <div className="app">
        <Header lang={lang} />
        <main id="main-content" className="page" data-feature={PAGE_FEATURE['page.login']}>
          <Surface as="section" className="page__panel">
            <h1>{t.title}</h1>
            <p>
              {t.alreadyLoggedIn} <strong>{currentEmail}</strong>.
            </p>
            <p>
              <Link
                to={
                  isAdmin
                    ? `${lang === 'en' ? '/en' : ''}/admin/inbox`
                    : `${lang === 'en' ? '/en' : ''}/me`
                }
              >
                {t.goToMe}
              </Link>
            </p>
          </Surface>
        </main>
        <Footer lang={lang} />
      </div>
    )
  }

  return (
    <div className="app">
      <Header lang={lang} />
      <main id="main-content" className="page" data-feature={PAGE_FEATURE['page.login']}>
        <Surface as="section" className="page__panel">
          <h1>{t.title}</h1>
          <p>{t.intro}</p>
          {reason && t.reasons[reason] && (
            <p role="alert" className="form__error">
              {t.reasons[reason]}
            </p>
          )}
          {transportError && (
            <p role="alert" className="form__error">
              {t.transportError}
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
    </div>
  )
}
