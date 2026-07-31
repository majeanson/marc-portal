import { Link, useSearchParams } from 'react-router-dom'
import type { Lang } from '../i18n'
import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import { PAGE_FEATURE } from '../lib/features'
import { Surface } from '../components/Surface'
import { usePageMeta } from '../lib/usePageMeta'
import type { MagicLinkSuppressionReason } from '../lib/authContext'

const SUPPRESSION_REASONS: readonly MagicLinkSuppressionReason[] = [
  'complaint',
  'unsubscribed',
  'hard-bounce',
]
function isSuppressionReason(v: string | null): v is MagicLinkSuppressionReason {
  return v !== null && (SUPPRESSION_REASONS as readonly string[]).includes(v)
}

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
    // Reason-specific: telling someone to "check your spam" is actively
    // wrong when the server already knows the address won't receive mail.
    // These replace `fallback` (not add to it) when `suppressed` is set.
    // Deliverability info only — this never confirms or denies an account
    // exists, and it only ever reaches whoever typed this exact address.
    suppressedReasons: {
      'hard-bounce':
        'Cette adresse a déjà rejeté nos courriels (échec permanent d’acheminement). Vérifie que tu l’as bien écrite, essaie une autre adresse, ou écris-moi directement à marc@marcportal.com.',
      unsubscribed:
        'Tu t’es désabonné de nos courriels sur cette adresse. Utilise une autre adresse, ou écris-moi directement si tu veux qu’on remette l’envoi en marche.',
      complaint:
        'Cette adresse a signalé nos courriels comme indésirables, on a arrêté d’y écrire par précaution. Utilise une autre adresse, ou écris-moi directement à marc@marcportal.com.',
    } as Record<MagicLinkSuppressionReason, string>,
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
    suppressedReasons: {
      'hard-bounce':
        'This address has bounced our mail before (permanent delivery failure). Double-check the spelling, try a different address, or email me directly at marc@marcportal.com.',
      unsubscribed:
        "You unsubscribed from our emails on this address. Use a different one, or email me directly if you'd like sending turned back on.",
      complaint:
        'This address flagged our emails as spam before, so we stopped sending to it as a precaution. Use a different address, or email me directly at marc@marcportal.com.',
    } as Record<MagicLinkSuppressionReason, string>,
  },
} as const

export function MagicLinkSent({ lang }: { lang: Lang }) {
  const t = COPY[lang]
  const [search] = useSearchParams()
  const email = search.get('email') ?? ''
  const suppressedParam = search.get('suppressed')
  const suppressed = isSuppressionReason(suppressedParam) ? suppressedParam : null

  usePageMeta({ title: `${t.title} — Marc`, lang })

  return (
    <div className="app">
      <Header lang={lang} />
      <main id="main-content" className="page" data-feature={PAGE_FEATURE['page.magic-link-sent']}>
        <Surface as="section" className="page__panel magic-link">
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
          {suppressed ? (
            <p className="magic-link__fallback" role="alert">
              {t.suppressedReasons[suppressed]}
            </p>
          ) : (
            <p className="magic-link__fallback">{t.fallback}</p>
          )}
          <p>
            {/* Carry the email forward so a visitor who mistyped doesn't have
                to retype an address they already gave us two screens ago. */}
            <Link
              to={`${lang === 'en' ? '/en/login' : '/login'}${email ? `?email=${encodeURIComponent(email)}` : ''}`}
            >
              {t.again}
            </Link>
          </p>
        </Surface>
      </main>
      <Footer lang={lang} />
    </div>
  )
}
