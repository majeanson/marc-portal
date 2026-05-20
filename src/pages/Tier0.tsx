import { useEffect } from 'react'
import type { Lang } from '../i18n'
import { DICT } from '../i18n'
import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import { FeatureContinue } from '../components/FeatureContinue'
import { PageMast } from '../components/PageMast'
import { SectionEyebrow } from '../components/SectionEyebrow'
import { listPatterns, localizedPattern } from '../lib/patterns'
import { PAGE_FOLIOS } from '../lib/folios'
import { PAGE_FEATURE } from '../lib/features'

/**
 * Tier 0 self-service redirect (feat-2026-008). Curated free patterns + no-code
 * templates for problems too small to commercially engage with. Replaces the
 * binary accept/reject triage outcome — Lucie's graceful off-ramp (Insight #27).
 */
export function Tier0({ lang }: { lang: Lang }) {
  const t = DICT[lang]
  const patterns = listPatterns()

  useEffect(() => {
    document.documentElement.lang = t.langCode
    document.title = `${t.tier0.pageTitle} — Marc`
    const meta = document.querySelector('meta[name="description"]')
    if (meta) meta.setAttribute('content', t.tier0.metaDescription)
  }, [t])

  return (
    <div className="app" data-feature={PAGE_FEATURE['page.tier0']}>
      <Header lang={lang} />
      <main id="main-content">
        <article className="section">
          <div className="section__inner">
            <PageMast
              folio={
                lang === 'fr'
                  ? `№ ${PAGE_FOLIOS.tier0} — libre-service`
                  : `№ ${PAGE_FOLIOS.tier0} — self-serve`
              }
              stampLabel={lang === 'fr' ? 'GRATUIT' : 'FREE'}
              stampSub={lang === 'fr' ? 'AUCUN COMPTE' : 'NO ACCOUNT'}
              back={{ href: lang === 'fr' ? '/' : '/en', label: t.tier0.backHome }}
              feature={PAGE_FEATURE['page.tier0']}
              lang={lang}
            >
              <SectionEyebrow lang={lang} feature={PAGE_FEATURE['page.tier0']}>
                {t.tier0.eyebrow}
              </SectionEyebrow>
              <h1>{t.tier0.title}</h1>
              <p>{t.tier0.intro}</p>
            </PageMast>

            <ul className="patterns">
              {patterns.map((p) => (
                <li key={p.id} className={`pattern pattern--${p.tone}`}>
                  <div className="pattern__head">
                    <span className={`pattern__tag pattern__tag--${p.tone} mono`}>
                      {localizedPattern(p.tag, lang)}
                    </span>
                    <h2 className="pattern__title">{localizedPattern(p.title, lang)}</h2>
                  </div>
                  <div className="pattern__block">
                    <div className="pattern__label mono">{t.tier0.problemLabel}</div>
                    <p className="pattern__body">{localizedPattern(p.problem, lang)}</p>
                  </div>
                  <div className="pattern__block">
                    <div className="pattern__label mono">{t.tier0.recipeLabel}</div>
                    <p className="pattern__body">{localizedPattern(p.recipe, lang)}</p>
                  </div>
                  {p.template && (
                    <div className="pattern__block">
                      <a
                        className="pattern__template mono"
                        href={p.template.href}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        → {localizedPattern(p.template.label, lang)}
                      </a>
                    </div>
                  )}
                </li>
              ))}
            </ul>

            <div className="tier0__outro">
              <p>{t.tier0.growBack}</p>
              <a className="hero__cta" href={lang === 'fr' ? '/intake' : '/en/intake'}>
                {t.tier0.intakeCta}
              </a>
            </div>
          </div>
        </article>
      </main>
      <FeatureContinue page="page.tier0" lang={lang} />
      <Footer lang={lang} />
    </div>
  )
}
