import { useEffect, useState } from 'react'
import type { Lang } from '../i18n'

interface RailItem {
  id: string
  label: string
}

const ITEMS: Record<Lang, RailItem[]> = {
  fr: [
    { id: 'featured', label: 'Projets' },
    { id: 'how', label: 'Comment ça marche' },
    { id: 'pricing', label: 'Prix' },
    { id: 'vibe', label: 'Je fais / Je fais pas' },
    { id: 'about', label: 'À propos' },
    { id: 'testimonials', label: 'Témoignages' },
    { id: 'cta', label: 'Décris ton problème' },
  ],
  en: [
    { id: 'featured', label: 'Projects' },
    { id: 'how', label: 'How it works' },
    { id: 'pricing', label: 'Pricing' },
    { id: 'vibe', label: 'What I do / don’t' },
    { id: 'about', label: 'About' },
    { id: 'testimonials', label: 'Vouches' },
    { id: 'cta', label: 'Describe your problem' },
  ],
}

/**
 * Fixed right-edge vertical index — magazine-style table-of-contents that
 * stays pinned through scroll. The active item is the section whose top
 * crosses the viewport's 35% line.
 *
 * Items whose target element isn't present on the page (e.g. Testimonials
 * self-hides when zero approved vouches exist) are dropped from the
 * rendered list, so a click never points at a missing anchor.
 */
export function SectionRail({ lang }: { lang: Lang }) {
  const allItems = ITEMS[lang]
  // Filter the rail to items whose section actually rendered. Start empty
  // so SSR/first paint don't flash links that would 404 on click; populate
  // after mount once the DOM is queryable.
  const [presentIds, setPresentIds] = useState<Set<string>>(new Set())
  const [activeId, setActiveId] = useState<string>(allItems[0]?.id ?? '')

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => (a.boundingClientRect.top ?? 0) - (b.boundingClientRect.top ?? 0))
        const first = visible[0]
        if (first?.target.id) setActiveId(first.target.id)
      },
      {
        rootMargin: '-35% 0px -55% 0px',
        threshold: 0,
      },
    )

    // Track which section ids are observed so we don't double-observe the
    // same element when sync() runs again. IntersectionObserver.observe is
    // idempotent for the same target, but tracking lets us cleanly
    // disconnect on unmount.
    const observed = new Set<string>()

    // Rescan the DOM, update the visible-rail items, and observe any
    // newly-mounted section. Some sections (Testimonials) self-mount
    // asynchronously after a network call, so we re-run on every body
    // mutation in addition to mount.
    const sync = () => {
      const present = new Set<string>()
      for (const it of allItems) {
        const el = document.getElementById(it.id)
        if (el) {
          present.add(it.id)
          if (!observed.has(it.id)) {
            observer.observe(el)
            observed.add(it.id)
          }
        }
      }
      // setState with the same shape is a re-render no-op in React only
      // when the reference matches — we always pass a fresh Set, but the
      // diff is cheap and the rail re-render is rare.
      setPresentIds(present)
    }

    sync()
    const mo = new MutationObserver(sync)
    mo.observe(document.body, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      mo.disconnect()
    }
  }, [allItems])

  const items = allItems.filter((it) => presentIds.has(it.id))

  return (
    <nav className="section-rail" aria-label={lang === 'fr' ? 'Index de la page' : 'Page index'}>
      <ol className="section-rail__list">
        {items.map((it, i) => {
          const isActive = it.id === activeId
          return (
            <li key={it.id} className="section-rail__item">
              <a
                href={`#${it.id}`}
                className={`section-rail__link${isActive ? ' is-active' : ''}`}
                aria-current={isActive ? 'true' : undefined}
              >
                <span className="section-rail__label">{it.label}</span>
                <span className="section-rail__tick" aria-hidden="true" />
                <span className="section-rail__num mono">{String(i + 1).padStart(2, '0')}</span>
              </a>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
