import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import { TimeTravelScrubber } from '../components/TimeTravelScrubber'
import { DICT, type Lang } from '../i18n'
import { formatDate } from '../lib/format'
import { listPublicAdvancements, type PublicAdvancementRow } from '../lib/advancementsApi'

/**
 * Unauthenticated share view. Renders only the advancements an admin has
 * flagged `allowedForPublic` for the given session. Anyone with the URL can
 * see this — session IDs are 72-bit base64url tokens, so the URL is the
 * capability. Nothing else about the session is exposed.
 */
export function PublicAdvancements({ lang }: { lang: Lang }) {
  const t = DICT[lang].sessionAdvancements
  const { id } = useParams<{ id: string }>()
  const [items, setItems] = useState<PublicAdvancementRow[] | null>(null)
  const [error, setError] = useState<boolean>(false)
  const [openBuild, setOpenBuild] = useState<string | null>(null)

  useEffect(() => {
    document.title = `${t.heading} — Marc`
  }, [t])

  useEffect(() => {
    if (!id) return
    let cancelled = false
    listPublicAdvancements(id)
      .then((r) => {
        if (cancelled) return
        setItems(r.advancements)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  return (
    <div className="app">
      <Header lang={lang} />
      <main id="main-content">
        <article
          className="section intake session-frame"
          style={{ viewTransitionName: 'project-detail' }}
        >
          <div className="section__inner">
            <div className="section__eyebrow">{t.heading}</div>
            <h1 className="session-frame__title">{t.heading}</h1>
            <p className="field__hint">{t.subtitle}</p>

            {error && (
              <p className="thread__empty mono" role="alert">
                {t.formError}
              </p>
            )}

            {items === null && !error ? (
              <p className="mono">{t.loading}</p>
            ) : items && items.length === 0 ? (
              <p className="thread__empty">{t.empty}</p>
            ) : (
              <ol className="session-advancements__list">
                {(items ?? []).map((row) => {
                  const linkHref =
                    row.build_url && row.build_url.length > 0
                      ? `${row.build_url}${row.iframe_path ?? ''}`
                      : null
                  const isOpen = openBuild === row.id
                  return (
                    <li key={row.id} className="session-advancements__entry">
                      <div className="session-advancements__head">
                        <span className="session-advancements__date mono">
                          {formatDate(row.date, lang)}
                        </span>
                        <span className="session-advancements__label">{row.label}</span>
                        {!linkHref && (
                          <span className="session-advancements__flag-pill session-advancements__flag-pill--pending mono">
                            {t.pillPendingStamp}
                          </span>
                        )}
                      </div>
                      {row.body && <p className="session-advancements__body">{row.body}</p>}
                      {linkHref && (
                        <div className="session-advancements__build-row">
                          <button
                            type="button"
                            className="rev-log__build-toggle mono"
                            onClick={() =>
                              setOpenBuild((prev) => (prev === row.id ? null : row.id))
                            }
                            aria-expanded={isOpen}
                          >
                            {isOpen ? t.hideBuild : t.viewBuild}
                          </button>
                          <a
                            className="rev-log__open-tab mono"
                            href={linkHref}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {t.openInNewTab}
                          </a>
                        </div>
                      )}
                      {isOpen && linkHref && (
                        <div className="rev-log__build-frame session-advancements__frame">
                          <p className="rev-log__build-hint mono">{t.buildHint}</p>
                          <iframe
                            src={linkHref}
                            title={`${t.iframeTitle}: ${row.label}`}
                            loading="lazy"
                            sandbox="allow-scripts allow-same-origin allow-forms"
                          />
                        </div>
                      )}
                    </li>
                  )
                })}
              </ol>
            )}
            {items && items.length > 0 && <TimeTravelScrubber advancements={items} lang={lang} />}
          </div>
        </article>
      </main>
      <Footer lang={lang} />
    </div>
  )
}
