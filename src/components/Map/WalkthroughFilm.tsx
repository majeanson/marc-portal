import { useState } from 'react'
import type { Lang } from '../../i18n'

/**
 * The guided-tour film embedded on /carte. It iframes the self-shooting
 * walkthrough player (public/walkthrough/player.html), which animates a camera
 * over real, freshly-captured screenshots of the live app — so the tour can't
 * drift from the product. Chapters mirror the site's actual journey
 * (home → intake → login → magic link → /me → session).
 *
 * Why an iframe and not a <video>: the player renders captions live from
 * timeline.js, so it reads the visitor's language (?lang) instead of baking one
 * cut. The player is CSP-clean (external player.js, self-hosted fonts) so it
 * loads fine under the production _headers CSP and respects Loi 25.
 *
 * Click-to-play on purpose: the iframe (and its looping camera motion) only
 * mounts after an explicit click. That defers the load, and it means nothing
 * animates for a `prefers-reduced-motion` visitor until they ask for it. The
 * poster is a committed capture frame; if it 404s the panel still works.
 */

type SceneKey = '' | 'home' | 'intake' | 'login' | 'magic' | 'me' | 'session'

interface Chapter {
  /** '' plays the full cut; a key plays that scene as a short (?scene=). */
  key: SceneKey
  /** Capture frame used as the still poster (public/walkthrough/frames/<f>.png). */
  poster: string
  label: { fr: string; en: string }
}

const CHAPTERS: Chapter[] = [
  { key: '', poster: 'home__default', label: { fr: 'Visite complète', en: 'Full tour' } },
  { key: 'home', poster: 'home__default', label: { fr: 'Accueil', en: 'Home' } },
  { key: 'intake', poster: 'intake__empty', label: { fr: 'La demande', en: 'The intake' } },
  { key: 'login', poster: 'login__empty', label: { fr: 'Connexion', en: 'Sign in' } },
  { key: 'magic', poster: 'magic__default', label: { fr: 'Le lien', en: 'The link' } },
  { key: 'me', poster: 'me__default', label: { fr: 'Ton espace', en: 'Your space' } },
  { key: 'session', poster: 'session__reply', label: { fr: 'La session', en: 'The session' } },
]

const COPY = {
  fr: {
    eyebrow: 'VISITE GUIDÉE',
    title: 'Le parcours, en mouvement',
    sub: 'La même structure que la carte, mais jouée : de la page d’accueil à une vraie session. Choisis un chapitre ou regarde au complet.',
    play: 'Jouer la visite',
    back: '← Revenir à l’aperçu',
    iframeTitle: 'Visite guidée de marc.portal',
    posterAlt: 'Aperçu de la visite guidée',
    chaptersLabel: 'Chapitres de la visite',
  },
  en: {
    eyebrow: 'GUIDED TOUR',
    title: 'The journey, in motion',
    sub: 'The same structure as the map, but played out: from the home page to a real session. Pick a chapter or watch the whole thing.',
    play: 'Play the tour',
    back: '← Back to preview',
    iframeTitle: 'Guided tour of marc.portal',
    posterAlt: 'Guided tour preview',
    chaptersLabel: 'Tour chapters',
  },
} as const

export function WalkthroughFilm({ lang }: { lang: Lang }) {
  const t = COPY[lang]
  // null = showing the poster; a SceneKey = the iframe is mounted on that scene.
  const [playing, setPlaying] = useState<SceneKey | null>(null)
  // Which chapter the poster previews (and which chip reads active) before play.
  const [selected, setSelected] = useState<Chapter>(CHAPTERS[0])
  const [posterFailed, setPosterFailed] = useState(false)

  const play = (ch: Chapter) => {
    setSelected(ch)
    setPlaying(ch.key)
  }

  const src = `/walkthrough/player.html?lang=${lang}${playing ? `&scene=${playing}` : ''}`

  return (
    <section className="walkfilm" aria-labelledby="walkfilm-title">
      <header className="walkfilm__head">
        <div className="section__eyebrow">{t.eyebrow}</div>
        <h2 className="walkfilm__title" id="walkfilm-title">
          {t.title}
        </h2>
        <p className="walkfilm__sub">{t.sub}</p>
      </header>

      <div className="walkfilm__stage">
        {playing !== null ? (
          <iframe
            // Re-key on scene so switching chapters reloads the player cleanly.
            key={playing}
            className="walkfilm__frame"
            src={src}
            title={t.iframeTitle}
            loading="lazy"
          />
        ) : (
          <button
            type="button"
            className="walkfilm__poster-btn"
            aria-label={t.play}
            onClick={() => play(selected)}
          >
            {!posterFailed && (
              <img
                className="walkfilm__poster"
                src={`/walkthrough/frames/${selected.poster}.png`}
                alt={t.posterAlt}
                onError={() => setPosterFailed(true)}
              />
            )}
            <span className="walkfilm__play mono" aria-hidden="true">
              ▶ {t.play}
            </span>
          </button>
        )}
      </div>

      <div className="walkfilm__chapters" role="group" aria-label={t.chaptersLabel}>
        {CHAPTERS.map((ch) => {
          const active = playing !== null ? playing === ch.key : selected.key === ch.key
          return (
            <button
              key={ch.key || 'full'}
              type="button"
              className={`walkfilm__chip mono${active ? ' walkfilm__chip--active' : ''}`}
              aria-pressed={active}
              onClick={() => play(ch)}
            >
              {ch.label[lang]}
            </button>
          )
        })}
        {playing !== null && (
          <button type="button" className="walkfilm__back mono" onClick={() => setPlaying(null)}>
            {t.back}
          </button>
        )}
      </div>
    </section>
  )
}
