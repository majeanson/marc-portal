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
    { id: 'cta', label: 'Décris ton problème' },
  ],
  en: [
    { id: 'featured', label: 'Projects' },
    { id: 'how', label: 'How it works' },
    { id: 'pricing', label: 'Pricing' },
    { id: 'vibe', label: 'What I do / don’t' },
    { id: 'about', label: 'About' },
    { id: 'cta', label: 'Describe your problem' },
  ],
}

/**
 * Fixed right-edge vertical index — magazine-style table-of-contents that
 * stays pinned through scroll. The active item is the section whose top
 * crosses the viewport's 35% line.
 */
export function SectionRail({ lang }: { lang: Lang }) {
  const items = ITEMS[lang]
  const [activeId, setActiveId] = useState<string>(items[0]?.id ?? '')

  useEffect(() => {
    const targets = items
      .map((it) => document.getElementById(it.id))
      .filter((el): el is HTMLElement => el !== null)
    if (targets.length === 0) return

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
    targets.forEach((t) => observer.observe(t))
    return () => observer.disconnect()
  }, [items])

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
