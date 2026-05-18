import { useEffect, useState } from 'react'
import type { Lang } from '../i18n'

interface RailItem {
  id: string
  label: string
}

/** Cheap order-insensitive set equality check — we only ever store a few
 *  short string ids in here, so size + every-membership is plenty. */
function sameIds(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false
  for (const v of a) if (!b.has(v)) return false
  return true
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
    // Last computed set, kept outside React state so the MutationObserver
    // can short-circuit when the answer hasn't changed (typing in any
    // input on the page triggers a body mutation, so this is hot).
    let lastPresent: Set<string> = new Set()

    // Rescan the DOM, observe any newly-mounted section, and update
    // presentIds — but only when the set of present ids actually changed.
    // Section presence is rare-event (Testimonials toggles once when its
    // network call resolves); cheap getElementById lookups are fine, but
    // a setState on every body mutation would force a re-render of the
    // rail on every keystroke.
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
      if (!sameIds(present, lastPresent)) {
        lastPresent = present
        setPresentIds(present)
      }
    }

    // Coalesce bursts of mutations into a single rAF-aligned sync. A long
    // input session emits dozens of childList mutations per second; we
    // only need one check per frame at most.
    let scheduled = false
    const scheduleSync = () => {
      if (scheduled) return
      scheduled = true
      requestAnimationFrame(() => {
        scheduled = false
        sync()
      })
    }

    sync()
    const mo = new MutationObserver(scheduleSync)
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
