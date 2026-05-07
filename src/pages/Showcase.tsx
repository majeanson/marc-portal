import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import type { Lang } from '../i18n'
import { DICT } from '../i18n'
import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import {
  getChildFeatures,
  getCreatedDate,
  getLastRevisionDate,
  getShowcaseBySlug,
} from '../lib/showcases'
import type { EngagementStage } from '../lib/showcases'
import { StatusHistoryStrip } from '../components/StatusHistoryStrip'
import { RevisionLog } from '../components/RevisionLog'

const STAGE_ORDER: EngagementStage[] = ['intake', 'triage', 'plan', 'build', 'review', 'shipped']

export function Showcase({ lang }: { lang: Lang }) {
  const t = DICT[lang]
  const { slug } = useParams<{ slug: string }>()
  const entry = slug ? getShowcaseBySlug(slug) : null

  useEffect(() => {
    document.documentElement.lang = t.langCode

    if (!entry) {
      document.title = `${t.showcase.notFoundTitle} — Marc`
      return
    }

    const title = entry.showcase.title[lang] ?? entry.showcase.title[entry.showcase.primaryLang]
    const summary =
      entry.showcase.summary[lang] ?? entry.showcase.summary[entry.showcase.primaryLang]
    document.title = `${title} — Marc`

    // Per-page meta tags. We update existing, create those that don't exist, and
    // track created ones so we remove only ours on unmount (don't strip the
    // homepage's static og: tags).
    const head = document.head
    const created: HTMLElement[] = []
    const upsert = (selector: string, attr: 'name' | 'property', key: string, content: string) => {
      let el = head.querySelector<HTMLMetaElement>(selector)
      if (!el) {
        el = document.createElement('meta')
        el.setAttribute(attr, key)
        head.appendChild(el)
        created.push(el)
      }
      el.setAttribute('content', content)
    }

    upsert('meta[name="description"]', 'name', 'description', summary)
    upsert('meta[property="og:title"]', 'property', 'og:title', title)
    upsert('meta[property="og:description"]', 'property', 'og:description', summary)
    upsert('meta[property="og:type"]', 'property', 'og:type', 'article')
    upsert('meta[name="twitter:title"]', 'name', 'twitter:title', title)
    upsert('meta[name="twitter:description"]', 'name', 'twitter:description', summary)

    // JSON-LD CreativeWork structured data
    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'CreativeWork',
      name: title,
      description: summary,
      inLanguage: lang === 'fr' ? 'fr-CA' : 'en-CA',
      author: { '@type': 'Person', name: 'Marc' },
      dateCreated: getCreatedDate(entry.feature) ?? undefined,
      dateModified: getLastRevisionDate(entry.feature) ?? undefined,
      keywords: entry.feature.tags?.join(', '),
    }
    const ldScript = document.createElement('script')
    ldScript.type = 'application/ld+json'
    ldScript.id = 'showcase-jsonld'
    ldScript.textContent = JSON.stringify(jsonLd)
    document.getElementById('showcase-jsonld')?.remove()
    head.appendChild(ldScript)
    created.push(ldScript)

    return () => {
      created.forEach((el) => el.remove())
    }
  }, [entry, lang, t])

  if (!entry) {
    return (
      <div className="app">
        <Header lang={lang} />
        <main className="section">
          <div className="section__inner">
            <h1>{t.showcase.notFoundTitle}</h1>
            <p>{t.showcase.notFoundBody}</p>
            <a className="hero__cta" href={lang === 'fr' ? '/' : '/en'}>
              {t.showcase.backToWall}
            </a>
          </div>
        </main>
        <Footer lang={lang} />
      </div>
    )
  }

  const { feature, showcase } = entry
  const title = showcase.title[lang] ?? showcase.title[showcase.primaryLang]
  const summary = showcase.summary[lang] ?? showcase.summary[showcase.primaryLang]
  const disclosure =
    showcase.compositeDisclosure?.[lang] ?? showcase.compositeDisclosure?.[showcase.primaryLang]
  const iterations = getChildFeatures(feature.featureKey)
  const wallHref = lang === 'fr' ? '/#showcases' : '/en#showcases'

  const statusLabel =
    feature.status === 'draft'
      ? t.showcase.statusDraft
      : feature.status === 'active'
        ? t.showcase.statusActive
        : feature.status === 'frozen'
          ? t.showcase.statusFrozen
          : t.showcase.statusDeprecated

  return (
    <div className="app">
      <Header lang={lang} />
      <main id="main-content">
        <article className="section showcase-page">
          <div className="section__inner">
            <a className="showcase-page__back" href={wallHref}>
              {t.showcase.backToWall}
            </a>

            <div className="showcase-page__meta mono">
              <span className={`status status--${feature.status}`}>{statusLabel}</span>
              <span>{showcase.tier}</span>
              <span>{showcase.price}</span>
              <span>{showcase.hours}</span>
              <span>
                {showcase.shippedDate
                  ? `${t.showcase.shippedOn} ${showcase.shippedDate}`
                  : showcase.targetShipDate
                    ? `${t.showcase.targetShip} ${showcase.targetShipDate}`
                    : ''}
              </span>
            </div>

            <h1>{title}</h1>
            <p className="showcase-page__summary">{summary}</p>

            <StatusHistoryStrip
              feature={feature}
              lang={lang}
              targetShipDate={showcase.targetShipDate}
            />

            {disclosure && (
              <div className="showcase-page__disclosure">
                <span className="mono">{t.showcase.composite} —</span> {disclosure}
              </div>
            )}

            <section className="showcase-page__block">
              <h2>{t.showcase.livePreviewTitle}</h2>
              {showcase.liveUrl ? (
                <iframe
                  className="showcase-page__iframe"
                  src={showcase.liveUrl}
                  title={t.showcase.livePreviewIframeTitle}
                  loading="lazy"
                  sandbox="allow-scripts allow-same-origin allow-forms"
                />
              ) : (
                <div className="showcase-page__placeholder">
                  {t.showcase.livePreviewPending.replace('{date}', showcase.targetShipDate ?? '—')}
                </div>
              )}
            </section>

            <section className="showcase-page__block">
              <h2>{t.showcase.timelineTitle}</h2>
              <ol className="timeline">
                {STAGE_ORDER.map((stage) => {
                  const event = showcase.engagement.find((e) => e.stage === stage)
                  const completed = event?.completed ?? false
                  const label =
                    event?.label[lang] ??
                    event?.label[showcase.primaryLang] ??
                    t.showcase.timelinePending
                  return (
                    <li
                      key={stage}
                      className={`timeline__item${completed ? ' timeline__item--done' : ''}`}
                    >
                      <span className="timeline__stage mono">{t.showcase.stageLabels[stage]}</span>
                      <span className="timeline__label">{label}</span>
                      {event?.date && <span className="timeline__date mono">{event.date}</span>}
                    </li>
                  )
                })}
              </ol>
            </section>

            {showcase.decisions && showcase.decisions.length > 0 && (
              <section className="showcase-page__block">
                <h2>{t.showcase.decisionsTitle}</h2>
                <ul className="decisions">
                  {showcase.decisions.map((d) => {
                    const dec = d.decision[lang] ?? d.decision[showcase.primaryLang]
                    const rat = d.rationale[lang] ?? d.rationale[showcase.primaryLang]
                    return (
                      <li key={dec} className="decision">
                        <h3>{dec}</h3>
                        <p>{rat}</p>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )}

            {iterations.length > 0 && (
              <section className="showcase-page__block">
                <h2>{t.showcase.nextIterTitle}</h2>
                <ul className="iterations">
                  {iterations.map((iter) => (
                    <li key={iter.featureKey} className="iteration">
                      <div className="iteration__header">
                        <span className={`status status--${iter.status}`}>{iter.status}</span>
                        <span className="iteration__key mono">{iter.featureKey}</span>
                      </div>
                      <h3>{iter.title}</h3>
                      <p>{iter.problem}</p>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="showcase-page__block">
              <h2>{t.showcase.sourceTitle}</h2>
              {showcase.sourceUrl ? (
                <a href={showcase.sourceUrl} className="mono">
                  {showcase.sourceUrl}
                </a>
              ) : (
                <div className="showcase-page__placeholder mono">{t.showcase.sourcePending}</div>
              )}
            </section>

            <section className="showcase-page__block">
              <h2>{t.showcase.revisionLog.title}</h2>
              <RevisionLog
                feature={feature}
                lang={lang}
                iframePath={showcase.liveUrl ?? undefined}
                repoUrl="https://github.com/majeanson/marc-portal"
              />
            </section>
          </div>
        </article>
      </main>
      <Footer lang={lang} />
    </div>
  )
}
