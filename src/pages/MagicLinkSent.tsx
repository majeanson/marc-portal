import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { Lang } from '../i18n'
import { Header } from '../components/Header'
import { Footer } from '../components/Footer'

const COPY = {
  fr: {
    title: 'Vérifie ton courriel',
    intro: (e: string) =>
      `On a envoyé un lien à ${e}. Ouvre-le pour te connecter — il expire dans 30 minutes.`,
    fallback: 'Pas reçu ? Vérifie tes pourriels, ou recommence avec un autre courriel.',
    again: 'Renvoyer un lien',
  },
  en: {
    title: 'Check your email',
    intro: (e: string) =>
      `A sign-in link was sent to ${e}. Open it to sign in — it expires in 30 minutes.`,
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
      <main className="page">
        <section className="page__panel">
          <h1>{t.title}</h1>
          <p>{t.intro(email)}</p>
          <p style={{ color: 'var(--text-soft, #888)' }}>{t.fallback}</p>
          <p>
            <a href={lang === 'en' ? '/en/login' : '/login'}>{t.again}</a>
          </p>
        </section>
      </main>
      <Footer lang={lang} />
    </>
  )
}
