import { useEffect, useState } from 'react'
import type { Lang } from '../i18n'
import type { SessionRow } from '../lib/sessionsApi'
import {
  getPaymentSummary,
  openCustomerPortal,
  startCheckout,
  type PaymentKind,
  type PaymentSummary,
} from '../lib/paymentsApi'

const COPY = {
  fr: {
    payTier1: 'Payer Tier 1 (≈ 300 $) →',
    payTier2Deposit: 'Payer le dépôt (≈ 750 $) →',
    payTier2Final: 'Payer le solde (≈ 750 $) →',
    payTier3: 'Payer (sur devis) →',
    paid: 'Payé ✓',
    paidAmount: (amount: string) => `Payé · ${amount}`,
    paySubscribe: 'Devenir dépositaire (200 $/an) →',
    manageSub: 'Gérer l’abonnement ↗',
    custodianPastDue: 'Renouvellement échoué — voir l’abonnement',
    custodianSwitched: 'Mode Tout à toi (abonnement terminé)',
    checkoutPending: 'Ouverture du paiement…',
    testMode: 'MODE TEST',
    testModeHint: 'Aucun vrai débit. Carte de test : 4242 4242 4242 4242.',
  },
  en: {
    payTier1: 'Pay Tier 1 (≈ $300) →',
    payTier2Deposit: 'Pay deposit (≈ $750) →',
    payTier2Final: 'Pay final balance (≈ $750) →',
    payTier3: 'Pay (quoted amount) →',
    paid: 'Paid ✓',
    paidAmount: (amount: string) => `Paid · ${amount}`,
    paySubscribe: 'Become custodian ($200/yr) →',
    manageSub: 'Manage subscription ↗',
    custodianPastDue: 'Renewal failed — open subscription',
    custodianSwitched: "Mode 'All yours' (subscription ended)",
    checkoutPending: 'Opening checkout…',
    testMode: 'TEST MODE',
    testModeHint: 'No real charge. Test card: 4242 4242 4242 4242.',
  },
} as const

/**
 * Render-on-active payment surface. Lazy-fetches /api/payments?sessionId=...
 * and renders one of:
 *   - "Pay tier N →"  when the session has a tier classified and no paid deposit
 *   - "Pay final balance" after a tier-2 deposit is paid (until final lands)
 *   - "Paid · amount" when the deposit/payment is in (terminal state)
 *   - "Become custodian" when there's no live subscription
 *   - "Manage subscription" when one is active or past_due
 *   - "Mode 'All yours'" note after a sub ends
 *
 * Hidden entirely when nothing relevant applies (tier not set AND no
 * subscription state). Used by both /me cards and the /session/:id page so
 * visitors can pay from either surface.
 *
 * In Stripe test mode a "TEST MODE" pill is rendered above the buttons so
 * visitors don't mistake sandbox charges for real ones. Driven by the
 * stripeMode field on the summary response (server reads STRIPE_SECRET_KEY's
 * prefix).
 */
export function PaymentActions({ session, lang }: { session: SessionRow; lang: Lang }) {
  const copy = COPY[lang]
  const [summary, setSummary] = useState<PaymentSummary | null>(null)
  const [pending, setPending] = useState<'idle' | 'checkout' | 'portal'>('idle')

  useEffect(() => {
    let cancelled = false
    getPaymentSummary(session.id)
      .then((s) => {
        if (!cancelled) setSummary(s)
      })
      .catch(() => {
        // 503 (Stripe unconfigured) / 404 / network — render nothing.
      })
    return () => {
      cancelled = true
    }
  }, [session.id])

  if (!summary) return null

  const onPay = async (kind: PaymentKind) => {
    setPending('checkout')
    try {
      const r = await startCheckout({ sessionId: session.id, kind, lang })
      window.location.assign(r.url)
    } catch {
      setPending('idle')
    }
  }
  const onPortal = async () => {
    setPending('portal')
    try {
      const r = await openCustomerPortal({ sessionId: session.id, lang })
      window.location.assign(r.url)
    } catch {
      setPending('idle')
    }
  }

  // One-time payment button. Mapping: tier1 → one charge; tier2 → deposit
  // first, final later (separate row, separate Checkout); tier3 → quoted
  // (admin uses amount override via the API).
  let payButton: { label: string; kind: PaymentKind } | null = null
  if (session.tier === 1 && !summary.hasPaidDeposit) {
    payButton = { label: copy.payTier1, kind: 'tier1' }
  } else if (session.tier === 2) {
    const hasPaidDepositRow = summary.rows.some(
      (r) => r.kind === 'tier2-deposit' && r.status === 'paid',
    )
    const hasPaidFinalRow = summary.rows.some(
      (r) => r.kind === 'tier2-final' && r.status === 'paid',
    )
    if (!hasPaidDepositRow) {
      payButton = { label: copy.payTier2Deposit, kind: 'tier2-deposit' }
    } else if (!hasPaidFinalRow) {
      payButton = { label: copy.payTier2Final, kind: 'tier2-final' }
    }
  } else if (session.tier === 3 && !summary.hasPaidDeposit) {
    payButton = { label: copy.payTier3, kind: 'tier3' }
  }

  const showCustodianLink =
    summary.custodianStatus === 'active' || summary.custodianStatus === 'past_due'
  const showSwitchedNote = summary.custodianStatus === 'switched_to_tout_a_toi'
  // "Start subscription" surfaces when there's no live sub on the session.
  // 'switched_to_tout_a_toi' means a prior sub ended (visitor can re-subscribe);
  // 'canceled' is a historical state (no webhook writes it today but the type
  // allows it). Both flow back into a fresh Checkout via the same button.
  const showCustodianStartButton =
    summary.custodianStatus === 'none' ||
    summary.custodianStatus === 'switched_to_tout_a_toi' ||
    summary.custodianStatus === 'canceled'

  if (
    !payButton &&
    !summary.hasPaidDeposit &&
    !showCustodianLink &&
    !showSwitchedNote &&
    !showCustodianStartButton
  ) {
    return null
  }

  // Sum all paid one-time rows on this session so a Tier-2 visitor who paid
  // both deposit and final sees "Paid · $1500" rather than just the most
  // recent leg's $750. Custodian sub renewals are excluded (they're a
  // separate, perpetual flow with its own Manage link).
  const paidOneTimeCents = summary.rows
    .filter((r) => r.status === 'paid' && r.kind !== 'custodian-sub' && r.paid_at)
    .reduce((sum, r) => sum + r.amount_cents, 0)
  const paidLabel =
    paidOneTimeCents > 0 ? copy.paidAmount(formatCadCents(paidOneTimeCents, lang)) : copy.paid

  return (
    <div className="me-portal__card-payments mono">
      {summary.stripeMode === 'test' && (
        <span
          className="me-portal__pay-test-pill"
          title={copy.testModeHint}
          aria-label={copy.testModeHint}
        >
          {copy.testMode}
        </span>
      )}
      {payButton && (
        <button
          type="button"
          className="me-portal__pay-btn"
          onClick={() => onPay(payButton!.kind)}
          disabled={pending !== 'idle'}
        >
          {pending === 'checkout' ? copy.checkoutPending : payButton.label}
        </button>
      )}
      {summary.hasPaidDeposit && <span className="me-portal__pay-paid">{paidLabel}</span>}
      {showCustodianLink && (
        <button
          type="button"
          className="me-portal__pay-portal link-btn"
          onClick={onPortal}
          disabled={pending !== 'idle'}
        >
          {summary.custodianStatus === 'past_due' ? copy.custodianPastDue : copy.manageSub}
        </button>
      )}
      {showSwitchedNote && (
        <span className="me-portal__pay-switched">{copy.custodianSwitched}</span>
      )}
      {showCustodianStartButton && (
        <button
          type="button"
          className="me-portal__pay-portal link-btn"
          onClick={() => onPay('custodian-sub')}
          disabled={pending !== 'idle'}
        >
          {pending === 'checkout' ? copy.checkoutPending : copy.paySubscribe}
        </button>
      )}
    </div>
  )
}

/**
 * Format CAD cents per OQLF convention (FR) or standard locale (EN).
 * 75000 cents → "750,00 $" (fr-CA) or "CA$750.00" (en-CA).
 */
function formatCadCents(cents: number, lang: Lang): string {
  return new Intl.NumberFormat(lang === 'fr' ? 'fr-CA' : 'en-CA', {
    style: 'currency',
    currency: 'CAD',
    currencyDisplay: lang === 'fr' ? 'symbol' : 'narrowSymbol',
  }).format(cents / 100)
}
