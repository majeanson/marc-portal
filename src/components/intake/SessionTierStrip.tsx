import type { Lang } from '../../i18n'
import type { SessionTier } from '../../lib/sessionsApi'

const COPY = {
  fr: {
    label: 'Tier de la session',
    t0: 'T0 · gratuit',
    t1: 'T1 · 750 $',
    t2: 'T2 · 1800 $',
    t3: 'T3 · 3600 $',
    t4: 'T4 · sur devis',
    clear: 'Aucun',
  },
  en: {
    label: 'Session tier',
    t0: 'T0 · free',
    t1: 'T1 · $750',
    t2: 'T2 · $1800',
    t3: 'T3 · $3600',
    t4: 'T4 · quoted',
    clear: 'None',
  },
} as const

const TIERS: SessionTier[] = [0, 1, 2, 3, 4]

/**
 * Admin-only tier picker. Renders five pills (T0-T4) + a "clear" pill.
 * Click sets the session's tier. Disabled on the current tier.
 *
 * Tier is the signal that pricing is locked: /me only surfaces a Pay button
 * once the admin sets tier 1-4 (tier 0 = free / discovery, no button). See
 * PaymentActions for the consumer logic.
 */
export function SessionTierStrip({
  lang,
  tier,
  onPick,
}: {
  lang: Lang
  tier: SessionTier | null
  /** Admin only — required (component is hidden entirely for visitors). */
  onPick: (next: SessionTier | null) => void
}) {
  const t = COPY[lang]
  return (
    <ol className="intake__progress session-strip" aria-label={t.label} role="group">
      {TIERS.map((n) => {
        const isCurrent = tier === n
        const stepClass = `intake__progress-step${isCurrent ? ' intake__progress-step--done intake__progress-step--current' : ''}`
        const label = t[`t${n}` as 't0' | 't1' | 't2' | 't3' | 't4']
        return (
          <li key={n} className="intake__progress-item">
            <button
              type="button"
              className={`${stepClass} mono`}
              onClick={() => onPick(n)}
              disabled={isCurrent}
              aria-current={isCurrent ? 'step' : undefined}
            >
              {label}
            </button>
          </li>
        )
      })}
      <li className="intake__progress-item session-strip__off-rail">
        <button
          type="button"
          className={`intake__progress-step session-strip__rejected mono${tier === null ? ' session-strip__rejected--on' : ''}`}
          onClick={() => onPick(null)}
          disabled={tier === null}
          aria-current={tier === null ? 'step' : undefined}
        >
          ✕ {t.clear}
        </button>
      </li>
    </ol>
  )
}
