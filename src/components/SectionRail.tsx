import { useEffect, useMemo, useState } from 'react'
import type { Lang } from '../i18n'
import { HOME_FOLIOS } from '../lib/folios'

interface RailItem {
  id: string
  label: string
}

/** Folio glyph for a given rail item id. The hero gets "I" (it carries the
 *  "№ 01" cover folio, not a HOME_FOLIOS entry); the final CTA has no
 *  section folio — it gets a destination arrow instead. */
const RAIL_FOLIO: Record<string, string> = {
  hero: 'I',
  featured: HOME_FOLIOS.featured,
  how: HOME_FOLIOS.how,
  vibe: HOME_FOLIOS.vibe,
  'bring-anything': HOME_FOLIOS.bringAnything,
  pricing: HOME_FOLIOS.pricing,
  about: HOME_FOLIOS.about,
  testimonials: HOME_FOLIOS.testimonials,
  faq: HOME_FOLIOS.faq,
  cta: '→',
}

/** 1–9 Roman numerals. Capped at IX because the rail can never carry more
 *  than 9 numbered items (hero + 8 HOME_FOLIOS entries). */
const ROMAN: Record<number, string> = {
  1: 'I',
  2: 'II',
  3: 'III',
  4: 'IV',
  5: 'V',
  6: 'VI',
  7: 'VII',
  8: 'VIII',
  9: 'IX',
}

/** Rail items in render order. Order MUST stay hero-then-HOME_SECTION_ORDER
 *  -then-CTA; guarded in features.test.ts. */
const ITEMS: Record<Lang, RailItem[]> = {
  fr: [
    { id: 'hero', label: 'Accueil' },
    { id: 'featured', label: 'Projets' },
    { id: 'how', label: 'Comment ça marche' },
    { id: 'about', label: 'À propos' },
    { id: 'vibe', label: 'Je fais / Je fais pas' },
    { id: 'bring-anything', label: 'Apporte n’importe quoi' },
    { id: 'pricing', label: 'Prix' },
    { id: 'testimonials', label: 'Témoignages' },
    { id: 'faq', label: 'FAQ' },
    { id: 'cta', label: 'Décris ton problème' },
  ],
  en: [
    { id: 'hero', label: 'Home' },
    { id: 'featured', label: 'Projects' },
    { id: 'how', label: 'How it works' },
    { id: 'about', label: 'About' },
    { id: 'vibe', label: 'What I do / don’t' },
    { id: 'bring-anything', label: 'Bring anything' },
    { id: 'pricing', label: 'Pricing' },
    { id: 'testimonials', label: 'Vouches' },
    { id: 'faq', label: 'FAQ' },
    { id: 'cta', label: 'Describe your problem' },
  ],
}

/**
 * Compact scroll indicator pinned top-right. Replaces the magazine-style
 * vertical ladder with a single mono `IV / IX` tag that updates as the
 * visitor scrolls. Earlier ladder version pattern-matched as a decorative
 * column on every viewport and competed with the content column for the
 * eye — R3 design pass (2026-05-27).
 *
 * Items whose target element isn't present on the page (e.g. Testimonials
 * self-hides when zero approved vouches exist) drop out of the count, so
 * the total tracks what's actually navigable.
 */
export function SectionRail({ lang }: { lang: Lang }) {
  const allItems = ITEMS[lang]
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

    const observed = new Set<string>()

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
      setPresentIds((prev) => {
        if (prev.size === present.size && [...prev].every((v) => present.has(v))) return prev
        return present
      })
    }

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

  // Total = numbered items that are actually on the page. CTA's "→" is
  // never counted — it's the destination arrow, not a numbered section.
  const total = useMemo(() => {
    let n = 0
    for (const it of allItems) {
      if (it.id === 'cta') continue
      if (presentIds.has(it.id)) n += 1
    }
    return n
  }, [allItems, presentIds])

  const activeFolio = RAIL_FOLIO[activeId] ?? ''
  const totalRoman = ROMAN[total] ?? ''
  const activeLabel = allItems.find((it) => it.id === activeId)?.label ?? ''

  // Bail before any section has registered — avoids painting "I / 0" on
  // the first frame before IO settles.
  if (total === 0) return null

  return (
    <nav
      className="section-rail"
      aria-label={lang === 'fr' ? 'Index de la page' : 'Page index'}
    >
      <span className="section-rail__indicator mono" aria-live="polite">
        <span className="section-rail__indicator-active">{activeFolio}</span>
        <span className="section-rail__indicator-sep" aria-hidden="true">
          {' / '}
        </span>
        <span className="section-rail__indicator-total">{totalRoman}</span>
        <span className="section-rail__indicator-sr">
          {lang === 'fr' ? ` ${activeLabel}` : ` ${activeLabel}`}
        </span>
      </span>
    </nav>
  )
}
