/**
 * /me/dossier + /en/me/dossier — "le carnet" data-shame ledger.
 *
 * Auth-gated. Renders a horizontal contrast: what this portal actually
 * keeps about you (left, "minimal") vs. what a comparable mainstream
 * social product — Meta/Facebook — collects about its users (right,
 * "uncomfortable"). The slider pointer always sits at the leftmost notch.
 * The point isn't that Marc is virtuous; the point is the gap.
 *
 * Comparator data is sourced from Meta's own public-facing documents:
 *   - https://www.facebook.com/privacy/policy/  (data policy)
 *   - https://transparency.meta.com/en-gb/reports/  (transparency reports)
 *   - https://www.facebook.com/help/325807937506242  (information collected)
 *
 * Each comparator row carries a `source` URL — readers can verify, and the
 * ledger stops reading as a vague rant. Keeping the comparator current is
 * a maintenance cost (~quarterly grep), worth it for the punch.
 *
 * Why a separate route from /me/data:
 *   - /me/data answers "what do you have on me?" — itemised, per-row, the
 *     Loi 25 right-of-access surface
 *   - /me/dossier answers "and how does that compare to elsewhere?" —
 *     the contrast IS the page, not a footnote
 * Both are linkable from each other.
 */

import { useEffect } from 'react'
import type { Lang } from '../i18n'
import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import { PageMast } from '../components/PageMast'
import { SectionEyebrow } from '../components/SectionEyebrow'
import { useAuth } from '../lib/authContext'
import { PAGE_FEATURE } from '../lib/features'
import { PAGE_FOLIOS } from '../lib/folios'

/**
 * Ledger row. `mine` = what the portal keeps; `theirs` = the comparator
 * datapoint at Meta. `source` is the URL the comparator was lifted from.
 * Sources are kept short — they appear inline.
 */
interface LedgerRow {
  category: { fr: string; en: string }
  mine: { fr: string; en: string }
  theirs: { fr: string; en: string }
  /** Single URL, displayed as "[source]". Keep the URL stable and public. */
  source: { url: string; label: { fr: string; en: string } }
}

const META_DATA_POLICY = 'https://www.facebook.com/privacy/policy/'
const META_HELP_INFO = 'https://www.facebook.com/help/325807937506242'
const META_OFF_FB = 'https://www.facebook.com/help/2207256696182627'
const META_PIXEL = 'https://www.facebook.com/business/help/742478679120153'

const ROWS: LedgerRow[] = [
  {
    category: { fr: 'Identifiant principal', en: 'Primary identifier' },
    mine: {
      fr: 'Ton courriel. Pour te reconnaître au retour. Rien de plus.',
      en: 'Your email. To recognise you on return. Nothing more.',
    },
    theirs: {
      fr: 'Nom légal, courriel, téléphone, date de naissance, genre, photo de profil, langues parlées, statut relationnel, ville actuelle et ville d’origine, écoles, employeurs.',
      en: 'Legal name, email, phone, birthdate, gender, profile photo, languages, relationship status, current + hometown city, schools, employers.',
    },
    source: { url: META_DATA_POLICY, label: { fr: 'politique Meta', en: 'Meta policy' } },
  },
  {
    category: { fr: 'Réseau social', en: 'Social graph' },
    mine: {
      fr: 'Aucun. Tu n’es relié à personne ici, sauf à moi.',
      en: 'None. You are linked to no one here, except me.',
    },
    theirs: {
      fr: 'Liste d’amis, demandes envoyées et reçues, contacts importés du téléphone, suggestions d’amis basées sur ton réseau étendu, "amis d’amis".',
      en: 'Friend list, requests sent and received, phone contacts imported, friend suggestions from extended network, "friends of friends".',
    },
    source: { url: META_HELP_INFO, label: { fr: 'aide Meta', en: 'Meta help centre' } },
  },
  {
    category: { fr: 'Contenu créé', en: 'Content created' },
    mine: {
      fr: 'Les sessions que tu m’ouvres et nos échanges dans le fil. Tu peux tout effacer d’un coup depuis /me.',
      en: 'The sessions you open with me, and our exchanges in the thread. You can erase it all at once from /me.',
    },
    theirs: {
      fr: 'Publications, photos, vidéos, stories, événements, groupes rejoints, pages aimées, réactions, commentaires sur le contenu d’autrui, brouillons jamais publiés, messages privés Messenger et Instagram.',
      en: 'Posts, photos, videos, stories, events, groups joined, pages liked, reactions, comments on others’ content, drafts never published, Messenger and Instagram private messages.',
    },
    source: { url: META_DATA_POLICY, label: { fr: 'politique Meta', en: 'Meta policy' } },
  },
  {
    category: { fr: 'Localisation', en: 'Location' },
    mine: {
      fr: 'Aucune. Ton IP n’est ni journalisée par Cloudflare Pages dans nos journaux, ni conservée par moi.',
      en: 'None. Your IP isn’t logged in our Cloudflare Pages output, nor kept by me.',
    },
    theirs: {
      fr: 'GPS précis (avec autorisation), Bluetooth, WiFi à proximité, antennes cellulaires, IP géolocalisée, métadonnées EXIF des photos téléversées. Compilé pour reconstituer tes déplacements.',
      en: 'Precise GPS (with permission), Bluetooth, nearby WiFi, cell towers, geo-IP, EXIF metadata on uploaded photos. Compiled into a map of your movements.',
    },
    source: { url: META_HELP_INFO, label: { fr: 'aide Meta', en: 'Meta help centre' } },
  },
  {
    category: { fr: 'Appareil', en: 'Device' },
    mine: {
      fr: 'Aucun fingerprint. Pas de modèle d’appareil, de version d’OS, de résolution d’écran, d’identifiant publicitaire.',
      en: 'No fingerprinting. No device model, no OS version, no screen resolution, no advertising ID.',
    },
    theirs: {
      fr: "Modèle, OS, navigateur, version, identifiants publicitaires (IDFA / GAID), niveau de batterie, opérateur mobile, force du signal, autres applications installées sur l'appareil.",
      en: 'Model, OS, browser, version, advertising identifiers (IDFA / GAID), battery level, mobile carrier, signal strength, other apps installed on the device.',
    },
    source: { url: META_DATA_POLICY, label: { fr: 'politique Meta', en: 'Meta policy' } },
  },
  {
    category: { fr: 'Suivi hors-site', en: 'Off-site tracking' },
    mine: {
      fr: 'Aucun. Pas de pixel, pas de Google Analytics, pas de Meta Pixel, pas de polices Google. Les polices sont auto-hébergées (Loi 25).',
      en: 'None. No pixel, no Google Analytics, no Meta Pixel, no Google Fonts. Fonts are self-hosted (Bill 25).',
    },
    theirs: {
      fr: 'Le pixel Meta s’exécute sur des millions de sites tiers et envoie tes visites à Meta — même si tu n’as pas de compte. Activité hors Facebook agrégée par site.',
      en: 'The Meta Pixel runs on millions of third-party sites and reports your visits back to Meta — even if you have no account. Off-Facebook activity is aggregated per site.',
    },
    source: { url: META_OFF_FB, label: { fr: 'hors-Facebook', en: 'off-Facebook' } },
  },
  {
    category: { fr: 'Attributs inférés', en: 'Inferred attributes' },
    mine: {
      fr: 'Aucun. Je ne déduis rien sur toi — l’intelligence de mise n’est pas une fonctionnalité ici.',
      en: 'None. I infer nothing about you — model-driven sorting isn’t a feature here.',
    },
    theirs: {
      fr: 'Centres d’intérêt déduits (politique, religion, orientation, revenu approximatif, statut parental, intentions d’achat) à partir de l’ensemble de tes interactions.',
      en: 'Inferred interests (politics, religion, orientation, approximate income, parenting status, purchase intent) derived from the totality of your interactions.',
    },
    source: { url: META_PIXEL, label: { fr: 'pixel Meta', en: 'Meta Pixel' } },
  },
  {
    category: { fr: 'Cookies', en: 'Cookies' },
    mine: {
      fr: 'Trois : mp_session (signé, 7 jours), mp_csrf (anti-falsification, par session), mp_lang (ta langue, 30 jours). Aucun cookie tiers.',
      en: 'Three: mp_session (signed, 7 days), mp_csrf (forgery guard, per session), mp_lang (your language, 30 days). No third-party cookies.',
    },
    theirs: {
      fr: 'Plusieurs dizaines de cookies first-party, plus des cookies tiers déposés par les pixels Meta sur les sites partenaires.',
      en: 'Several dozen first-party cookies, plus third-party cookies dropped by Meta Pixels across partner sites.',
    },
    source: { url: META_DATA_POLICY, label: { fr: 'politique Meta', en: 'Meta policy' } },
  },
  {
    category: { fr: 'Suppression', en: 'Erasure' },
    mine: {
      fr: 'Un clic depuis /me. Effacement immédiat, sans question, sans rétention de 30 jours.',
      en: 'One click from /me. Immediate erasure, no questions, no 30-day retention.',
    },
    theirs: {
      fr: 'Délai de 30 jours pendant lequel le compte est récupérable. Certaines données restent dans les sauvegardes Meta jusqu’à 90 jours.',
      en: 'A 30-day delay during which the account is recoverable. Some data remains in Meta backups for up to 90 days.',
    },
    source: { url: META_DATA_POLICY, label: { fr: 'politique Meta', en: 'Meta policy' } },
  },
]

const COPY = {
  fr: {
    pageTitle: 'Le carnet — Marc',
    metaDescription:
      'Ce que je détiens vraiment sur toi, comparé à ce que Meta (Facebook) collecte. Le contraste est le but.',
    eyebrow: 'loi 25 · le carnet, en comparaison',
    title: 'Le carnet',
    folio: `№ ${PAGE_FOLIOS.dossier} — le carnet`,
    stampLabel: 'MINIMAL',
    stampSub: 'PAR DESIGN',
    lead: 'Voici, côte à côte, ce que ce portail garde sur toi et ce qu’un service grand public — Meta / Facebook — collecte sur ses utilisateurs. La page ne fait pas la morale ; elle montre le contraste. Chaque ligne a sa source publique, pour que tu puisses vérifier toi-même.',
    notLoggedIn: 'Connecte-toi pour voir ton carnet — il faut un compte pour pointer "minimal".',
    signIn: 'Se connecter',
    axisLabel: 'Échelle de collecte',
    axisLeft: 'minimal',
    axisRight: 'inconfortable',
    youAreHere: 'tu es ici',
    colMine: 'Ce que je détiens',
    colTheirs: 'Ce que Meta collecte',
    sourcePrefix: 'source : ',
    backToMe: '← Retour à mon espace',
    relatedHeading: 'Pour aller plus loin',
    relatedData: 'Voir mes données en détail (Loi 25 — droit d’accès) →',
    relatedPassage: 'Imprimer ton passage du moment (le reçu) →',
    relatedPrivacy: 'La politique de confidentialité (le texte légal) ↗',
    asOfPrefix: 'Comparateur révisé : ',
    asOf: '2026-05-23',
  },
  en: {
    pageTitle: 'The ledger — Marc',
    metaDescription:
      'What I actually hold about you, compared to what Meta (Facebook) collects. The contrast is the point.',
    eyebrow: 'bill 25 · the ledger, in contrast',
    title: 'The ledger',
    folio: `№ ${PAGE_FOLIOS.dossier} — the ledger`,
    stampLabel: 'MINIMAL',
    stampSub: 'BY DESIGN',
    lead: 'Side by side: what this portal keeps about you, and what a mainstream service — Meta / Facebook — collects about its users. The page doesn’t moralise; it shows the gap. Every row carries a public source so you can check.',
    notLoggedIn: 'Sign in to see your ledger — landing at "minimal" requires an account.',
    signIn: 'Sign in',
    axisLabel: 'Collection axis',
    axisLeft: 'minimal',
    axisRight: 'uncomfortable',
    youAreHere: 'you are here',
    colMine: 'What I hold',
    colTheirs: 'What Meta collects',
    sourcePrefix: 'source: ',
    backToMe: '← Back to my space',
    relatedHeading: 'Keep reading',
    relatedData: 'See my data in detail (Bill 25 — right of access) →',
    relatedPassage: 'Print your current visit (the receipt) →',
    relatedPrivacy: 'The privacy policy (the legal text) ↗',
    asOfPrefix: 'Comparator reviewed: ',
    asOf: '2026-05-23',
  },
} as const

export function Dossier({ lang }: { lang: Lang }) {
  const t = COPY[lang]
  const { email, loading } = useAuth()
  const langPrefix = lang === 'en' ? '/en' : ''
  const homeHref = lang === 'fr' ? '/' : '/en'
  const meHref = `${langPrefix}/me`
  const dataHref = `${langPrefix}/me/data`
  const passageHref = `${langPrefix}/passage`
  const privacyHref = lang === 'fr' ? '/confidentialite' : '/en/privacy'

  useEffect(() => {
    document.title = t.pageTitle
    const meta = document.querySelector('meta[name="description"]')
    if (meta) meta.setAttribute('content', t.metaDescription)
  }, [t])

  if (loading) {
    return (
      <div className="app" data-feature={PAGE_FEATURE['page.dossier']}>
        <Header lang={lang} variant="session" />
        <main id="main-content" className="dossier dossier--loading" aria-busy="true" />
        <Footer lang={lang} />
      </div>
    )
  }

  if (!email) {
    return (
      <div className="app" data-feature={PAGE_FEATURE['page.dossier']}>
        <Header lang={lang} />
        <main className="page">
          <section className="page__panel">
            <SectionEyebrow lang={lang} feature={PAGE_FEATURE['page.dossier']}>
              {t.eyebrow}
            </SectionEyebrow>
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
      </div>
    )
  }

  return (
    <div className="app" data-feature={PAGE_FEATURE['page.dossier']}>
      <Header lang={lang} variant="session" />
      <main id="main-content">
        <article className="section">
          <div className="section__inner dossier">
            <PageMast
              folio={t.folio}
              stampLabel={t.stampLabel}
              stampSub={t.stampSub}
              back={{ href: meHref, label: t.backToMe }}
              feature={PAGE_FEATURE['page.dossier']}
              lang={lang}
            >
              <SectionEyebrow lang={lang} feature={PAGE_FEATURE['page.dossier']}>
                {t.eyebrow}
              </SectionEyebrow>
              <h1>{t.title}</h1>
              <p className="dossier__lead">{t.lead}</p>
            </PageMast>

            {/* Axis: a hand-drawn scale from "minimal" to "uncomfortable",
                with a pointer pinned at the leftmost notch. The pointer
                never moves — it's not a slider, it's a state. */}
            <figure
              className="dossier-axis"
              role="img"
              aria-label={`${t.axisLabel}: ${t.axisLeft} → ${t.axisRight}`}
            >
              <div className="dossier-axis__track" />
              <span className="dossier-axis__notch dossier-axis__notch--left" />
              <span className="dossier-axis__notch dossier-axis__notch--mid" />
              <span className="dossier-axis__notch dossier-axis__notch--right" />
              <span className="dossier-axis__pointer">
                <span className="dossier-axis__pointer-label mono">{t.youAreHere}</span>
                <svg
                  className="dossier-axis__pointer-arrow"
                  viewBox="0 0 12 18"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path
                    d="M 6 0 Q 5 5 6 10 L 1 15 M 6 10 L 11 15"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <figcaption className="dossier-axis__labels mono">
                <span className="dossier-axis__label dossier-axis__label--left">{t.axisLeft}</span>
                <span className="dossier-axis__label dossier-axis__label--right">
                  {t.axisRight}
                </span>
              </figcaption>
            </figure>

            <section className="dossier-grid" aria-label={t.title}>
              <header className="dossier-grid__head mono">
                <span aria-hidden="true" />
                <span>{t.colMine}</span>
                <span>{t.colTheirs}</span>
              </header>
              {ROWS.map((row) => (
                <article key={row.category.fr} className="dossier-row">
                  <h2 className="dossier-row__category mono">{row.category[lang]}</h2>
                  <p className="dossier-row__mine">{row.mine[lang]}</p>
                  <p className="dossier-row__theirs">
                    {row.theirs[lang]}{' '}
                    <a
                      className="dossier-row__source mono"
                      href={row.source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      [{t.sourcePrefix}
                      {row.source.label[lang]}]
                    </a>
                  </p>
                </article>
              ))}
            </section>

            <p className="dossier__asof mono">
              {t.asOfPrefix}
              {t.asOf}
            </p>

            <aside className="dossier__related">
              <h2 className="dossier__related-heading">{t.relatedHeading}</h2>
              <ul className="dossier__related-list">
                <li>
                  <a href={dataHref}>{t.relatedData}</a>
                </li>
                <li>
                  <a href={passageHref}>{t.relatedPassage}</a>
                </li>
                <li>
                  <a href={privacyHref}>{t.relatedPrivacy}</a>
                </li>
              </ul>
            </aside>

            {/* Below the related links, an anchor home so the bottom of the
                page isn't a dead end. */}
            <p className="dossier__home-out">
              <a href={homeHref}>← {lang === 'fr' ? "Retour à l'accueil" : 'Back to home'}</a>
            </p>
          </div>
        </article>
      </main>
      <Footer lang={lang} />
    </div>
  )
}
