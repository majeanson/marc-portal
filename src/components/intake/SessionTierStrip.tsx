import type { Lang } from '../../i18n'
import type { SessionTier } from '../../lib/sessionsApi'
import { formatCadCents } from '../../lib/format'
import { TIER_TOTAL_CENTS } from '../../lib/pricing'

const COPY = {
  fr: { label: 'Tier de la session', free: 'gratuit', quoted: 'sur devis', clear: 'Aucun' },
  en: { label: 'Session tier', free: 'free', quoted: 'quoted', clear: 'None' },
} as const

/** "T2 · 1 800 $" — the tier price comes from the canonical ladder
 *  (lib/pricing) through the shared formatter, so the strip can't drift from
 *  the public pricing or its number formatting. T0 is free, T4 is quoted. */
function tierLabel(n: SessionTier, lang: Lang, t: (typeof COPY)[Lang]): string {
  if (n === 1 || n === 2 || n === 3) return `T${n} · ${formatCadCents(TIER_TOTAL_CENTS[n], lang)}`
  if (n === 4) return `T4 · ${t.quoted}`
  return `T0 · ${t.free}`
}

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
        const label = tierLabel(n, lang, t)
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
