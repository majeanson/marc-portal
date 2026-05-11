import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import type { Lang } from '../i18n'
import { DICT } from '../i18n'
import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import { EngagementStatusBar } from '../components/engagement/EngagementStatusBar'
import { EngagementThread } from '../components/engagement/EngagementThread'
import { EngagementPreview } from '../components/engagement/EngagementPreview'
import { getEngagementBySlug } from '../lib/engagements'

/**
 * Engagement canvas (feat-2026-003 async-status-canvas). Read-only sample for the
 * public site — visitors see what their own engagement page would look like.
 * Real client engagements would be auth-gated; this fixture is an in-progress
 * sample (Tremblay landscaping, composite) that demonstrates the pattern.
 */
export function Engagement({ lang }: { lang: Lang }) {
  const t = DICT[lang]
  const { slug } = useParams<{ slug: string }>()
  const engagement = slug ? getEngagementBySlug(slug) : null

  useEffect(() => {
    document.documentElement.lang = t.langCode
    if (engagement) {
      const title = engagement.title[lang] ?? engagement.title.fr
      document.title = `${title} — Marc`
    } else {
      document.title = `${t.engagement.notFound.title} — Marc`
    }
  }, [engagement, lang, t])

  if (!engagement) {
    return (
      <div className="app">
        <Header lang={lang} />
        <main id="main-content" className="section">
          <div className="section__inner">
            <h1>{t.engagement.notFound.title}</h1>
            <p>{t.engagement.notFound.body}</p>
            <a className="hero__cta" href={lang === 'fr' ? '/' : '/en'}>
              {t.engagement.backHome}
            </a>
          </div>
        </main>
        <Footer lang={lang} />
      </div>
    )
  }

  const title = engagement.title[lang] ?? engagement.title.fr
  const problem = engagement.problem[lang] ?? engagement.problem.fr

  return (
    <div className="app">
      <Header lang={lang} />
      <main id="main-content">
        <article className="section showcase-page">
          <div className="section__inner">
            <a className="showcase-page__back" href={lang === 'fr' ? '/' : '/en'}>
              {t.engagement.backHome}
            </a>

            <div className="eng-meta mono">
              <span className="status status--active">{t.engagement.demoNotice}</span>
              <span>{engagement.tier}</span>
              <span>
                {t.engagement.startedOn} {engagement.startedDate}
              </span>
              <span>{engagement.client}</span>
            </div>

            <h1>{title}</h1>
            <p className="showcase-page__summary">{problem}</p>

            <EngagementStatusBar lang={lang} stages={engagement.stages} />

            <EngagementPreview
              lang={lang}
              livePreviewUrl={engagement.livePreviewUrl}
              livePreviewNote={engagement.livePreviewNote}
            />

            <section className="showcase-page__block">
              <h2>{t.engagement.thread.title}</h2>
              <p>{t.engagement.thread.body}</p>
              <EngagementThread lang={lang} messages={engagement.messages} />
            </section>
          </div>
        </article>
      </main>
      <Footer lang={lang} />
    </div>
  )
}
