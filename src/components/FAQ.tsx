import { useEffect } from 'react'
import type { Lang } from '../i18n'
import { DICT } from '../i18n'

/**
 * Native <details>/<summary> accordion — no JS state, browsers handle the
 * open/close, screen readers already know about the disclosure pattern.
 * Items mounted from i18n.faq.items, in order.
 *
 * Also injects a FAQPage JSON-LD block (one per language render so the SEO
 * payload tracks the displayed copy) — search engines surface FAQ rich
 * results from this format. The script tag is removed on unmount and on
 * language switch to keep it in sync.
 */
export function FAQ({ lang }: { lang: Lang }) {
  const t = DICT[lang].faq

  useEffect(() => {
    const id = 'faq-jsonld'
    document.getElementById(id)?.remove()
    const script = document.createElement('script')
    script.id = id
    script.type = 'application/ld+json'
    script.text = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: t.items.map((item) => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.a,
        },
      })),
    })
    document.head.appendChild(script)
    return () => {
      script.remove()
    }
  }, [t])

  return (
    <section className="section section--editorial faq" id="faq">
      <div className="section__inner">
        <header className="section__head">
          <div className="section__folio mono" aria-hidden="true">
            VII
          </div>
          <div className="section__eyebrow">{t.eyebrow}</div>
          <h2 className="section__display">{t.title}</h2>
        </header>
        <div className="faq__list">
          {t.items.map((item, i) => (
            <details key={i} className="faq__item">
              <summary className="faq__q">
                <span className="faq__q-text">{item.q}</span>
                <span className="faq__q-marker" aria-hidden="true">
                  +
                </span>
              </summary>
              <p className="faq__a">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
