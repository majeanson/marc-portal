import { useEffect, useState } from 'react'
import type { Lang } from '../i18n'
import { nextOpeningText } from '../lib/capacity'
import { getCapacityLive } from '../lib/sessionsApi'

const CAPACITY_LABELS = {
  fr: {
    activeBuilds: (n: number) => `${n} projet${n === 1 ? '' : 's'} actif${n === 1 ? '' : 's'}`,
    inTriage: (n: number) => `${n} en triage`,
    nextOpening: (when: string) => `prochain départ ${when}`,
  },
  en: {
    activeBuilds: (n: number) => `${n} active build${n === 1 ? '' : 's'}`,
    inTriage: (n: number) => `${n} in triage`,
    nextOpening: (when: string) => `next opening ${when}`,
  },
} as const

/**
 * Live capacity hint. Reads /api/capacity (D1-backed) on mount. The 1-active +
 * 1-in-triage cap is the load-bearing rule (Insight #39); see feat-2026-005
 * (triage-queue primitive) and feat-2026-015 (runtime). The static
 * public/data/capacity.json fixture was removed — D1 is the only source.
 */
export function CapacityCounter({ lang }: { lang: Lang }) {
  const [active, setActive] = useState<number | null>(null)
  const [triage, setTriage] = useState<number | null>(null)
  const labels = CAPACITY_LABELS[lang]

  useEffect(() => {
    let cancelled = false
    getCapacityLive()
      .then((c) => {
        if (cancelled) return
        setActive(c.active)
        setTriage(c.triage)
      })
      .catch(() => {
        // Network/API failure → render nothing rather than a wrong number.
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (active === null || triage === null) {
    // First paint: render a slot with empty pills so the layout doesn't jump
    // when the live numbers arrive. aria-hidden until populated.
    return <div className="capacity" aria-hidden="true" />
  }

  return (
    <div className="capacity" role="status" aria-live="polite">
      <span className="capacity__pill capacity__pill--active">{labels.activeBuilds(active)}</span>
      <span className="capacity__pill">{labels.inTriage(triage)}</span>
      <span className="capacity__pill">{labels.nextOpening(nextOpeningText(lang))}</span>
    </div>
  )
}
