import { useEffect, useState } from 'react'
import type { Lang } from '../i18n'
import { getCapacity } from '../lib/capacity'
import { getCapacityLive } from '../lib/sessionsApi'

const CAPACITY_LABELS = {
  fr: {
    activeBuilds: (n: number) => `${n} projet${n === 1 ? '' : 's'} actif${n === 1 ? '' : 's'}`,
    inTriage: (n: number) => `${n} en triage`,
    waitlist: (n: number) => `liste d’attente : ${n}`,
    nextOpening: (when: string) => `prochain départ ${when}`,
  },
  en: {
    activeBuilds: (n: number) => `${n} active build${n === 1 ? '' : 's'}`,
    inTriage: (n: number) => `${n} in triage`,
    waitlist: (n: number) => `waitlist: ${n}`,
    nextOpening: (when: string) => `next opening ${when}`,
  },
} as const

/**
 * Live capacity hint. Reads /api/capacity (D1-backed) on mount with the static
 * public/data/capacity.json fallback as initial paint and offline degrade.
 * The 1-active + 1-in-triage cap is the load-bearing rule (Insight #39); see
 * feat-2026-005 (triage-queue primitive) and feat-2026-015 (runtime).
 */
export function CapacityCounter({ lang }: { lang: Lang }) {
  const fallback = getCapacity()
  const [active, setActive] = useState<number>(fallback.activeBuilds)
  const [triage, setTriage] = useState<number>(fallback.inTriage)
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
        // keep static fallback values
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="capacity" role="status" aria-live="polite">
      <span className="capacity__pill capacity__pill--active">{labels.activeBuilds(active)}</span>
      <span className="capacity__pill">{labels.inTriage(triage)}</span>
      <span className="capacity__pill">{labels.waitlist(fallback.waitlist)}</span>
      <span className="capacity__pill">{labels.nextOpening(fallback.nextOpening[lang])}</span>
    </div>
  )
}
