import type { Lang } from '../i18n'
import { getCapacity } from '../lib/capacity'

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
 * Live capacity hint. Build-time import from public/data/capacity.json — push to
 * GitHub to update. The 1-active + 1-in-triage cap is the load-bearing rule
 * (Insight #39); see feat-2026-005 (triage-queue primitive).
 */
export function CapacityCounter({ lang }: { lang: Lang }) {
  const cap = getCapacity()
  const labels = CAPACITY_LABELS[lang]
  return (
    <div className="capacity" role="status" aria-live="polite">
      <span className="capacity__pill capacity__pill--active">
        {labels.activeBuilds(cap.activeBuilds)}
      </span>
      <span className="capacity__pill">{labels.inTriage(cap.inTriage)}</span>
      <span className="capacity__pill">{labels.waitlist(cap.waitlist)}</span>
      <span className="capacity__pill">{labels.nextOpening(cap.nextOpening[lang])}</span>
    </div>
  )
}
