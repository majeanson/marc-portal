import { useEffect, useState } from 'react'
import type { Lang } from '../i18n'
import { nextDepartureText } from '../lib/capacity'
import { formatRelativeWindow } from '../lib/format'
import { getCapacityLive, listPublicProjects, type PublicProject } from '../lib/sessionsApi'

const CAPACITY_LABELS = {
  fr: {
    activeBuilds: (n: number) => `${n} projet${n === 1 ? '' : 's'} actif${n === 1 ? '' : 's'}`,
    inTriage: (n: number) => `${n} en triage`,
    nextDeparture: (when: string) => `prochain départ — ${when}`,
    latestShipment: (label: string, ago: string) => `dernière livraison · ${label} — ${ago}`,
  },
  en: {
    activeBuilds: (n: number) => `${n} active build${n === 1 ? '' : 's'}`,
    inTriage: (n: number) => `${n} in triage`,
    nextDeparture: (when: string) => `next opening — ${when}`,
    latestShipment: (label: string, ago: string) => `last shipped · ${label} — ${ago}`,
  },
} as const

interface LatestShipment {
  label: string
  agoText: string
}

/**
 * Pick the freshest currentBuild across all showcased projects and pre-format
 * its relative time. Returns null when no showcased session has a pinned
 * showAsCurrentBuild advancement yet. The relative time is computed here (not
 * during render) so the component stays pure per react-hooks/purity.
 */
function pickLatestShipment(projects: PublicProject[], lang: Lang): LatestShipment | null {
  let best: { label: string; date: number } | null = null
  for (const p of projects) {
    if (!p.currentBuild) continue
    if (best === null || p.currentBuild.date > best.date) {
      best = { label: p.currentBuild.label, date: p.currentBuild.date }
    }
  }
  if (!best) return null
  return {
    label: best.label,
    agoText: formatRelativeWindow(best.date * 1000 - Date.now(), lang),
  }
}

/**
 * Live capacity hint. Reads /api/capacity (D1-backed) on mount, plus
 * /api/public/projects to surface the latest shipment label across showcased
 * sessions. The 1-active + 1-triage cap is the load-bearing rule (Insight #39);
 * see feat-2026-005 (triage-queue primitive) and feat-2026-015 (runtime).
 */
export function CapacityCounter({ lang }: { lang: Lang }) {
  const [active, setActive] = useState<number | null>(null)
  const [triage, setTriage] = useState<number | null>(null)
  const [shipment, setShipment] = useState<LatestShipment | null>(null)
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
    listPublicProjects()
      .then((r) => {
        if (cancelled) return
        setShipment(pickLatestShipment(r.projects, lang))
      })
      .catch(() => {
        // Silent — the capacity row still renders without the shipment line.
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
      <div className="capacity__row">
        <span className="capacity__pill capacity__pill--active">{labels.activeBuilds(active)}</span>
        <span className="capacity__pill">{labels.inTriage(triage)}</span>
      </div>
      <div className="capacity__line">{labels.nextDeparture(nextDepartureText(active, lang))}</div>
      {shipment && (
        <div className="capacity__line">
          {labels.latestShipment(shipment.label, shipment.agoText)}
        </div>
      )}
    </div>
  )
}
