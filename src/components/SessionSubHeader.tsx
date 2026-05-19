import { useEffect, useState } from 'react'
import type { Lang } from '../i18n'

/**
 * Sticky sub-header rendered below the slim session Header on /session/:id.
 * Six tabs scroll-to-section through the major surfaces inside a single
 * session: Statut (status pills + tier + what's-next), Conversation (the
 * thread), Builds (advancements timeline), Paiement (Stripe actions),
 * Livraison (custodian / Tout à toi), Intake (original submission +
 * napkin sketch).
 *
 * Active tab is computed via IntersectionObserver — same pattern as the
 * home SectionRail — so scrolling the page lights up the relevant tab
 * even when the visitor scrolls past sections directly. Tabs whose target
 * section isn't on the page (e.g. Livraison renders only for shipped
 * sessions, Builds only when advancements exist) are dropped from the
 * rendered list so a click never points at a missing anchor.
 */

interface SubHeaderTab {
  id: string
  label: { fr: string; en: string }
}

const TABS: SubHeaderTab[] = [
  { id: 'session-statut', label: { fr: 'Statut', en: 'Status' } },
  { id: 'session-conversation', label: { fr: 'Conversation', en: 'Conversation' } },
  { id: 'session-builds', label: { fr: 'Builds', en: 'Builds' } },
  { id: 'session-paiement', label: { fr: 'Paiement', en: 'Payment' } },
  { id: 'session-livraison', label: { fr: 'Livraison', en: 'Handoff' } },
  { id: 'session-intake', label: { fr: 'Intake', en: 'Intake' } },
]

function sameIds(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false
  for (const v of a) if (!b.has(v)) return false
  return true
}

export function SessionSubHeader({ lang }: { lang: Lang }) {
  const [presentIds, setPresentIds] = useState<Set<string>>(new Set())
  const [activeId, setActiveId] = useState<string>('')

  useEffect(() => {
    // Recompute which target sections actually mounted. Same approach as
    // SectionRail — start empty, populate post-mount once the DOM is queryable.
    const recompute = () => {
      const next = new Set<string>()
      for (const t of TABS) {
        if (document.getElementById(t.id)) next.add(t.id)
      }
      setPresentIds((prev) => (sameIds(prev, next) ? prev : next))
      // Default active to the first present tab so the bar never shows empty.
      if (activeId === '' && next.size > 0) {
        const firstPresent = TABS.find((t) => next.has(t.id))
        if (firstPresent) setActiveId(firstPresent.id)
      }
    }
    recompute()
    // Recompute when the document mutates significantly (PaymentActions /
    // SessionAdvancements mount their wrapper after their async data lands).
    const obs = new MutationObserver(recompute)
    obs.observe(document.body, { childList: true, subtree: true })
    return () => obs.disconnect()
    // activeId intentionally excluded — we only seed it on first detection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (presentIds.size === 0) return
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => (a.boundingClientRect.top ?? 0) - (b.boundingClientRect.top ?? 0))
        if (visible[0]) {
          setActiveId(visible[0].target.id)
        }
      },
      {
        // Sticky header (~56px) + this sub-header (~44px) ≈ 100px;
        // bottom margin keeps "the section that's currently in the
        // viewport's upper third" as the highlighted one.
        rootMargin: '-104px 0px -55% 0px',
        threshold: 0,
      },
    )
    const targets: HTMLElement[] = []
    for (const t of TABS) {
      if (!presentIds.has(t.id)) continue
      const el = document.getElementById(t.id)
      if (el) {
        observer.observe(el)
        targets.push(el)
      }
    }
    return () => observer.disconnect()
  }, [presentIds])

  const tabs = TABS.filter((t) => presentIds.has(t.id))
  if (tabs.length === 0) return null

  return (
    <nav className="session-subheader" aria-label="Session sections">
      <div className="session-subheader__inner">
        {tabs.map((tab) => {
          const isActive = tab.id === activeId
          return (
            <a
              key={tab.id}
              href={`#${tab.id}`}
              className={`session-subheader__tab mono${isActive ? ' session-subheader__tab--active' : ''}`}
              aria-current={isActive ? 'true' : undefined}
              onClick={(e) => {
                e.preventDefault()
                const el = document.getElementById(tab.id)
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  // Push the hash without triggering a re-scroll (history
                  // API only — no navigation).
                  history.replaceState(null, '', `#${tab.id}`)
                }
              }}
            >
              {tab.label[lang]}
            </a>
          )
        })}
      </div>
    </nav>
  )
}
