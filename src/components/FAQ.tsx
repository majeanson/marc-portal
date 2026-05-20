import { useEffect, useRef, useState } from 'react'
import type { Lang } from '../i18n'
import { DICT } from '../i18n'
import { HOME_FOLIOS } from '../lib/folios'
import { FAQ_FEATURE, HOME_SECTION_FEATURE } from '../lib/features'
import { FeatureDot } from './FeatureDot'

/**
 * Native <details>/<summary> accordion — no JS state for open/close (browsers
 * + screen readers already know the disclosure pattern). React only owns the
 * "open every item" override and the URL-hash sync:
 *
 * - Each item gets a stable `id` ("faq-<slug>"). Slugs are shared FR/EN so a
 *   shared link like /#faq-price opens the right item in either language.
 * - On mount, location.hash is matched; if it points at an item, the item is
 *   pre-opened and scrolled into view.
 * - On toggle, the hash is updated via history.replaceState (no scroll jump).
 * - Expand-all / Collapse-all toggle flips every item at once.
 *
 * Also injects a FAQPage JSON-LD block (one per language render so the SEO
 * payload tracks the displayed copy).
 */
export function FAQ({ lang }: { lang: Lang }) {
  const t = DICT[lang].faq
  const listRef = useRef<HTMLDivElement>(null)
  const [allOpen, setAllOpen] = useState(false)

  // JSON-LD for SEO rich results. Re-runs on language switch to keep the
  // payload in sync with the displayed copy.
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
        acceptedAnswer: { '@type': 'Answer', text: item.a },
      })),
    })
    document.head.appendChild(script)
    return () => {
      script.remove()
    }
  }, [t])

  // Deep-link: open + scroll the item matching location.hash on mount.
  // Runs once per language render so the FR/EN switch doesn't lose the
  // currently-open hashed item.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const hash = window.location.hash.replace(/^#/, '')
    if (!hash || !hash.startsWith('faq-')) return
    const el = document.getElementById(hash)
    if (el && el.tagName === 'DETAILS') {
      ;(el as HTMLDetailsElement).open = true
      // Defer scroll one frame so layout settles after `open` flips.
      requestAnimationFrame(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    }
  }, [t])

  function onItemToggle(slug: string, isOpen: boolean) {
    if (typeof window === 'undefined') return
    const target = isOpen ? `#faq-${slug}` : '#faq'
    // replaceState — no scroll jump, just URL bookkeeping. Browsers handle
    // scroll-restoration on back/forward.
    window.history.replaceState(null, '', target)
  }

  function toggleAll() {
    const next = !allOpen
    setAllOpen(next)
    if (!listRef.current) return
    listRef.current.querySelectorAll<HTMLDetailsElement>('details.faq__item').forEach((d) => {
      d.open = next
    })
  }

  // HOME_SECTION_FEATURE['faq'] = undefined — FAQ aggregates Qs from
  // every cluster, so the section itself doesn't carry a single hue.
  // Each <details> below carries its own feature via FAQ_FEATURE.
  const sectionFeature = HOME_SECTION_FEATURE['faq']
  return (
    <section className="section section--editorial faq" id="faq" data-feature={sectionFeature}>
      <div className="section__inner">
        <header className="section__head">
          <div className="section__folio mono" aria-hidden="true">
            {HOME_FOLIOS.faq}
          </div>
          <div className="section__eyebrow">
            <FeatureDot feature={sectionFeature} lang={lang} size="sm" />
            {t.eyebrow}
          </div>
          <h2 className="section__display">{t.title}</h2>
        </header>
        <div className="faq__list" ref={listRef}>
          {t.items.map((item, i) => {
            const slug = t.slugs[i] ?? `q${i}`
            const id = `faq-${slug}`
            // Each Q gets its feature colour via the central FAQ_FEATURE
            // map — the same plum the visitor saw on the Pricing eyebrow
            // shows up on the "le prix annoncé" question, and the dot
            // lands them on /carte?feature=pricing.
            const feature = FAQ_FEATURE[slug]
            return (
              <details
                key={slug}
                id={id}
                data-feature={feature}
                className="faq__item"
                onToggle={(e) => onItemToggle(slug, (e.currentTarget as HTMLDetailsElement).open)}
              >
                <summary className="faq__q">
                  <FeatureDot
                    feature={feature}
                    lang={lang}
                    size="sm"
                    decorative
                    className="faq__q-dot"
                  />
                  <span className="faq__q-text">{item.q}</span>
                  <span className="faq__q-marker" aria-hidden="true">
                    +
                  </span>
                </summary>
                {/* Answers are trusted i18n strings — same pattern as Privacy.tsx,
                    lets us embed a couple of <a> tags without a richer schema. */}
                <p className="faq__a" dangerouslySetInnerHTML={{ __html: item.a }} />
              </details>
            )
          })}
        </div>
        <button
          type="button"
          className="faq__toggle-all mono"
          onClick={toggleAll}
          aria-expanded={allOpen}
        >
          {allOpen ? t.collapseAll : t.expandAll}
        </button>
      </div>
    </section>
  )
}
