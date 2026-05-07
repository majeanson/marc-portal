import { useEffect } from 'react'
import type { Lang } from '../i18n'
import { DICT } from '../i18n'
import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import { listPatterns, localizedPattern } from '../lib/patterns'

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
    <div className="app">
      <Header lang={lang} />
      <main id="main-content">
        <article className="section">
          <div className="section__inner">
            <a className="showcase-page__back" href={lang === 'fr' ? '/' : '/en'}>
              {t.tier0.backHome}
            </a>
            <div className="section__eyebrow">{t.tier0.eyebrow}</div>
            <h1>{t.tier0.title}</h1>
            <p>{t.tier0.intro}</p>
            <p>{t.tier0.principle}</p>

            <ul className="patterns">
              {patterns.map((p) => (
                <li key={p.id} className="pattern">
                  <h2 className="pattern__title">{localizedPattern(p.title, lang)}</h2>
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
      <Footer lang={lang} />
    </div>
  )
}
