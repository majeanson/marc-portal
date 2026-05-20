import { useEffect, useRef, useState } from 'react'
import type { Lang } from '../i18n'
import { HOME_FOLIOS } from '../lib/folios'
import { FeatureDot } from './FeatureDot'
import { HOME_SECTION_FEATURE } from '../lib/features'

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

/** Folio glyph for a given rail item id. The rail is the magazine's
 *  table-of-contents, so it lists EVERY folio'd home section (II–IX) and
 *  mirrors the masthead's Roman numeral, so a glance at the rail shows the
 *  same issue mark the section header carries. The final CTA doesn't have
 *  a section folio — it gets a destination arrow instead. */
const RAIL_FOLIO: Record<string, string> = {
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

/** Rail items in render order — every folio'd section (II–IX) plus the
 *  final CTA. Order MUST stay a prefix-then-CTA of HOME_SECTION_ORDER;
 *  guarded in features.test.ts. */
const ITEMS: Record<Lang, RailItem[]> = {
  fr: [
    { id: 'featured', label: 'Projets' },
    { id: 'how', label: 'Comment ça marche' },
    { id: 'vibe', label: 'Je fais / Je fais pas' },
    { id: 'bring-anything', label: 'Apporte n’importe quoi' },
    { id: 'pricing', label: 'Prix' },
    { id: 'about', label: 'À propos' },
    { id: 'testimonials', label: 'Témoignages' },
    { id: 'faq', label: 'FAQ' },
    { id: 'cta', label: 'Décris ton problème' },
  ],
  en: [
    { id: 'featured', label: 'Projects' },
    { id: 'how', label: 'How it works' },
    { id: 'vibe', label: 'What I do / don’t' },
    { id: 'bring-anything', label: 'Bring anything' },
    { id: 'pricing', label: 'Pricing' },
    { id: 'about', label: 'About' },
    { id: 'testimonials', label: 'Vouches' },
    { id: 'faq', label: 'FAQ' },
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
 *
 * Per-item progress is tracked alongside active state: each link gets a
 * `--rail-progress` custom property (0–1) reflecting how much of that
 * section has scrolled past the viewport's anchor line. The CSS uses it
 * to grow the tick width, so already-read sections carry a longer ruler
 * mark than not-yet-reached ones. A handmade reading meter, basically.
 *
 * Each rail item also surfaces a small FeatureDot (clickable shortcut to
 * /carte?feature=X) so the right-edge index doubles as a colour legend
 * for the home page's section→feature mapping.
 */
export function SectionRail({ lang }: { lang: Lang }) {
  const allItems = ITEMS[lang]
  const [presentIds, setPresentIds] = useState<Set<string>>(new Set())
  const [activeId, setActiveId] = useState<string>(allItems[0]?.id ?? '')
  const [progress, setProgress] = useState<Record<string, number>>({})
  // Last-emitted progress map, kept outside state so the rAF loop can
  // short-circuit when nothing changed by more than 1% (avoids re-renders
  // on every scroll event during a long page).
  const lastProgress = useRef<Record<string, number>>({})

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
    let lastPresent: Set<string> = new Set()

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

  // Per-section scroll progress. Same rAF-throttle pattern as the rest of
  // the page's scroll listeners. Runs alongside the IO above — IO is great
  // for "what's active right now", scroll is the right tool for continuous
  // 0→1 progress within a single section.
  useEffect(() => {
    let ticking = false
    const compute = () => {
      ticking = false
      const anchorY = window.innerHeight * 0.35
      const next: Record<string, number> = {}
      let anyChanged = false
      for (const it of allItems) {
        const el = document.getElementById(it.id)
        if (!el) continue
        const rect = el.getBoundingClientRect()
        const p = Math.min(1, Math.max(0, (anchorY - rect.top) / Math.max(1, rect.height)))
        next[it.id] = p
        // Coalesce to 1% steps — any finer just burns React reconciliation
        // for changes that aren't visible.
        const prev = lastProgress.current[it.id] ?? -1
        if (Math.abs(p - prev) > 0.01) anyChanged = true
      }
      if (anyChanged) {
        lastProgress.current = next
        setProgress(next)
      }
    }
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(compute)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    compute()
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [allItems])

  const items = allItems.filter((it) => presentIds.has(it.id))

  return (
    <nav className="section-rail" aria-label={lang === 'fr' ? 'Index de la page' : 'Page index'}>
      <ol className="section-rail__list">
        {items.map((it) => {
          const isActive = it.id === activeId
          const p = progress[it.id] ?? 0
          const folio = RAIL_FOLIO[it.id] ?? ''
          const feature = HOME_SECTION_FEATURE[it.id]
          return (
            <li key={it.id} className="section-rail__item" data-feature={feature}>
              <a
                href={`#${it.id}`}
                className={`section-rail__link${isActive ? ' is-active' : ''}`}
                aria-current={isActive ? 'true' : undefined}
                style={{ ['--rail-progress' as string]: p.toFixed(2) }}
              >
                <span className="section-rail__label">{it.label}</span>
                <span className="section-rail__tick" aria-hidden="true" />
                <span className="section-rail__num mono">{folio}</span>
              </a>
              {/* Dot lives next to the rail link (not inside it) so a
                  visitor can either jump to the anchor (the link) OR
                  jump to the /carte cluster (the dot). Two destinations,
                  two targets — no accidental click-stealing. */}
              <FeatureDot feature={feature} lang={lang} size="sm" className="section-rail__dot" />
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
