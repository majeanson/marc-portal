import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { Lang } from '../i18n'
import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import { PAGE_FEATURE } from '../lib/features'

const COPY = {
  fr: {
    title: 'Vérifie ton courriel',
    // Guard the empty case: a direct hit or reload of /login/sent loses the
    // ?email param, and "On a envoyé un lien à ." reads as broken. Fall back
    // to a generic phrasing that still makes sense.
    intro: (e: string) =>
      e
        ? `On a envoyé un lien à ${e}. Ouvre-le pour te connecter — il expire dans 30 minutes.`
        : 'On a envoyé ton lien de connexion par courriel. Ouvre-le pour te connecter — il expire dans 30 minutes.',
    reassure: 'Tu peux en redemander un à tout moment, c’est gratuit et instantané.',
    fallback: 'Pas reçu ? Vérifie tes pourriels, ou recommence avec un autre courriel.',
    again: 'Renvoyer un lien',
  },
  en: {
    title: 'Check your email',
    intro: (e: string) =>
      e
        ? `A sign-in link was sent to ${e}. Open it to sign in — it expires in 30 minutes.`
        : 'Your sign-in link is on its way by email. Open it to sign in — it expires in 30 minutes.',
    reassure: 'You can request a new one anytime, free and instant.',
    fallback: "Didn't get it? Check your spam folder, or try again with a different email.",
    again: 'Send another link',
  },
} as const

export function MagicLinkSent({ lang }: { lang: Lang }) {
  const t = COPY[lang]
  const [search] = useSearchParams()
  const email = search.get('email') ?? ''

  useEffect(() => {
    document.title = `${t.title} — Marc`
  }, [t])

  return (
    <>
      <Header lang={lang} />
      <main className="page" data-feature={PAGE_FEATURE['page.magic-link-sent']}>
        <section className="page__panel magic-link">
          {/* Hand-drawn envelope mark that "lands" once on mount — celebrates
              the moment the link is in flight without being corny. Decorative,
              aria-hidden. Pairs with a 6-particle confetti burst keyframe. */}
          <div className="magic-link__mark" aria-hidden="true">
            <svg viewBox="0 0 80 64" className="magic-link__envelope" focusable="false">
              <rect
                x="6"
                y="12"
                width="68"
                height="44"
                rx="4"
                fill="var(--bg-card)"
                stroke="currentColor"
                strokeWidth="2.5"
              />
              <path
                d="M6 14 L40 38 L74 14"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinejoin="round"
              />
              <path
                d="M6 56 L30 34 M74 56 L50 34"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
            <span className="magic-link__spark magic-link__spark--1" />
            <span className="magic-link__spark magic-link__spark--2" />
            <span className="magic-link__spark magic-link__spark--3" />
            <span className="magic-link__spark magic-link__spark--4" />
            <span className="magic-link__spark magic-link__spark--5" />
            <span className="magic-link__spark magic-link__spark--6" />
          </div>
          <h1>{t.title}</h1>
          <p>{t.intro(email)}</p>
          <p className="magic-link__reassure">{t.reassure}</p>
          <p className="magic-link__fallback">{t.fallback}</p>
          <p>
            <a href={lang === 'en' ? '/en/login' : '/login'}>{t.again}</a>
          </p>
        </section>
      </main>
      <Footer lang={lang} />
    </>
  )
}
