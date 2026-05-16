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
    // Project payment section
    projectHeading: 'Paiement du projet',
    payTier1: 'Payer Tier 1 (≈ 300 $) →',
    payTier2Deposit: 'Payer le dépôt (≈ 750 $) →',
    payTier2Final: 'Payer le solde (≈ 750 $) →',
    payTier3: 'Payer (sur devis) →',
    paid: 'Payé ✓',
    paidAmount: (amount: string) => `Payé · ${amount}`,
    checkoutPending: 'Ouverture du paiement…',

    // Custodian section
    custodianHeading: 'Mode dépositaire',
    custodianOptional: 'facultatif',
    custodianActive: 'actif',
    custodianPastDueLabel: 'paiement en retard',
    custodianEnded: 'terminé',
    custodianDetailsLink: 'Voir les détails ↗',
    custodianPitch:
      'Je garde les clés (repo, domaine, comptes) pour 200 $/an. Petites retouches incluses (jusqu’à 2 h/mois). Annulable n’importe quand — bascule automatique vers « Tout à toi ».',
    custodianActiveBody:
      'Je détiens repo, domaine et comptes en mon nom. Renouvellement annuel automatique. Tu peux annuler ou modifier le mode de paiement via le portail Stripe.',
    custodianPastDueBody:
      'Stripe n’a pas réussi à débiter ta carte. Mets à jour le mode de paiement avant la fin de la période de grâce, sinon ton mode bascule automatiquement vers « Tout à toi ».',
    custodianEndedBody:
      'Ton abonnement dépositaire a pris fin. Tu es maintenant en mode « Tout à toi » — tout est à ton nom. Tu peux reprendre l’abonnement à tout moment.',
    paySubscribe: 'Activer le mode dépositaire (200 $/an) →',
    paySubscribeAgain: 'Reprendre l’abonnement →',
    manageSub: 'Gérer l’abonnement ↗',
    manageSubPastDue: 'Mettre à jour le paiement ↗',

    // Test mode banner
    testModeBadge: 'MODE TEST',
    testModeBody:
      'Aucun vrai débit. Pour tester un paiement : carte 4242 4242 4242 4242, n’importe quelle date future (ex. 12/30), n’importe quel CVC (ex. 123), n’importe quel code postal (ex. H1A 1A1).',
  },
  en: {
    projectHeading: 'Project payment',
    payTier1: 'Pay Tier 1 (≈ $300) →',
    payTier2Deposit: 'Pay deposit (≈ $750) →',
    payTier2Final: 'Pay final balance (≈ $750) →',
    payTier3: 'Pay (quoted amount) →',
    paid: 'Paid ✓',
    paidAmount: (amount: string) => `Paid · ${amount}`,
    checkoutPending: 'Opening checkout…',

    custodianHeading: 'Custodian mode',
    custodianOptional: 'optional',
    custodianActive: 'active',
    custodianPastDueLabel: 'payment past due',
    custodianEnded: 'ended',
    custodianDetailsLink: 'See the details ↗',
    custodianPitch:
      'I hold the keys (repo, domain, accounts) for $200/yr. Small tweaks included (up to 2h/month). Cancel anytime — auto-switches to "All yours".',
    custodianActiveBody:
      'I hold repo, domain, and accounts in my name. Auto-renews annually. You can cancel or update the payment method via the Stripe portal.',
    custodianPastDueBody:
      'Stripe failed to charge your card. Update the payment method before the grace period ends, otherwise your mode auto-switches to "All yours".',
    custodianEndedBody:
      'Your custodian subscription has ended. You\'re now in "All yours" mode — everything is in your name. You can re-subscribe anytime.',
    paySubscribe: 'Activate custodian mode ($200/yr) →',
    paySubscribeAgain: 'Re-activate subscription →',
    manageSub: 'Manage subscription ↗',
    manageSubPastDue: 'Update payment method ↗',

    testModeBadge: 'TEST MODE',
    testModeBody:
      'No real charge. To test a payment: card 4242 4242 4242 4242, any future date (e.g. 12/30), any CVC (e.g. 123), any postal/ZIP (e.g. H1A 1A1).',
  },
} as const

/**
 * Render-on-active payment surface. Lazy-fetches /api/payments?sessionId=...
 * and renders a structured block with up to three sections:
 *
 *   1. TEST MODE banner — when Stripe is configured against a test key
 *      (sk_test_*). Persistent, explanatory; never shown in live mode.
 *   2. "Paiement du projet" — tier-based one-time payment buttons.
 *      Hidden when tier isn't set yet OR when the work is fully paid.
 *   3. "Mode dépositaire" — the post-handoff custodian decision, framed
 *      as its own labeled section with explanation + CTA. State-driven:
 *      none → pitch + CTA; active/past_due → status + manage; ended →
 *      note + re-activate.
 *
 * Used on /me cards and the /session/:id page. Returns null when there's
 * truly nothing to show (no tier AND no custodian state to surface).
 *
 * The custodian decision is intentionally promoted to a top-level
 * section — it's the only ongoing financial commitment in the product
 * and visitors should see it presented clearly, not buried as a side
 * button. See /handoff for the full narrative this mirrors.
 */
export function PaymentActions({ session, lang }: { session: SessionRow; lang: Lang }) {
  const copy = COPY[lang]
  const langPrefix = lang === 'en' ? '/en' : ''
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

  const custodianState: 'none' | 'active' | 'past_due' | 'ended' =
    summary.custodianStatus === 'active'
      ? 'active'
      : summary.custodianStatus === 'past_due'
        ? 'past_due'
        : summary.custodianStatus === 'switched_to_tout_a_toi' ||
            summary.custodianStatus === 'canceled'
          ? 'ended'
          : 'none'

  // Sum all paid one-time rows on this session so a Tier-2 visitor who paid
  // both deposit and final sees "Paid · $1500" rather than just the most
  // recent leg's $750. Custodian sub renewals are excluded (they're a
  // separate, perpetual flow with its own Manage link).
  const paidOneTimeCents = summary.rows
    .filter((r) => r.status === 'paid' && r.kind !== 'custodian-sub' && r.paid_at)
    .reduce((sum, r) => sum + r.amount_cents, 0)
  const paidLabel =
    paidOneTimeCents > 0 ? copy.paidAmount(formatCadCents(paidOneTimeCents, lang)) : copy.paid

  // Decide whether to render the project-payment section.
  //   'pay'    — payButton is set (tier 1/2/3, work owing)
  //   'paid'   — at least one one-time row paid (any tier)
  //   'hidden' — tier not set (null) OR tier 0 (free engagement)
  // The custodian section is independent and can render below regardless.
  const projectState: 'pay' | 'paid' | 'hidden' =
    session.tier === null || session.tier === 0 ? 'hidden' : payButton ? 'pay' : 'paid'

  // Don't render the whole block when there is literally nothing to show.
  // (Tier-0 free engagement with no custodian sub — clean card.)
  if (projectState === 'hidden' && custodianState === 'none') {
    return null
  }

  return (
    <div className="me-portal__card-payments">
      {summary.stripeMode === 'test' && (
        <div className="me-portal__pay-test-banner" role="status">
          <span className="me-portal__pay-test-badge mono">{copy.testModeBadge}</span>
          <span className="me-portal__pay-test-body">{copy.testModeBody}</span>
        </div>
      )}

      {projectState !== 'hidden' && (
        <section className="me-portal__pay-section" aria-labelledby={`pay-proj-${session.id}`}>
          <h3 className="me-portal__pay-section-title mono" id={`pay-proj-${session.id}`}>
            {copy.projectHeading}
          </h3>
          <div className="me-portal__pay-section-body">
            {projectState === 'pay' && payButton && (
              <button
                type="button"
                className="me-portal__pay-btn"
                onClick={() => onPay(payButton!.kind)}
                disabled={pending !== 'idle'}
              >
                {pending === 'checkout' ? copy.checkoutPending : payButton.label}
              </button>
            )}
            {projectState === 'paid' && <span className="me-portal__pay-paid">{paidLabel}</span>}
          </div>
        </section>
      )}

      <section
        className={`me-portal__pay-section me-portal__pay-custodian me-portal__pay-custodian--${custodianState}`}
        aria-labelledby={`pay-cust-${session.id}`}
      >
        <header className="me-portal__pay-section-head">
          <h3 className="me-portal__pay-section-title mono" id={`pay-cust-${session.id}`}>
            {copy.custodianHeading}{' '}
            <span className="me-portal__pay-section-tag mono">
              {custodianState === 'active' && copy.custodianActive}
              {custodianState === 'past_due' && copy.custodianPastDueLabel}
              {custodianState === 'ended' && copy.custodianEnded}
              {custodianState === 'none' && copy.custodianOptional}
            </span>
          </h3>
          <a className="me-portal__pay-details-link mono" href={`${langPrefix}/handoff`}>
            {copy.custodianDetailsLink}
          </a>
        </header>
        <p className="me-portal__pay-custodian-body">
          {custodianState === 'active' && copy.custodianActiveBody}
          {custodianState === 'past_due' && copy.custodianPastDueBody}
          {custodianState === 'ended' && copy.custodianEndedBody}
          {custodianState === 'none' && copy.custodianPitch}
        </p>
        <div className="me-portal__pay-section-body">
          {custodianState === 'none' && (
            <button
              type="button"
              className="me-portal__pay-btn"
              onClick={() => onPay('custodian-sub')}
              disabled={pending !== 'idle'}
            >
              {pending === 'checkout' ? copy.checkoutPending : copy.paySubscribe}
            </button>
          )}
          {custodianState === 'ended' && (
            <button
              type="button"
              className="me-portal__pay-btn"
              onClick={() => onPay('custodian-sub')}
              disabled={pending !== 'idle'}
            >
              {pending === 'checkout' ? copy.checkoutPending : copy.paySubscribeAgain}
            </button>
          )}
          {(custodianState === 'active' || custodianState === 'past_due') && (
            <button
              type="button"
              className="me-portal__pay-portal link-btn"
              onClick={onPortal}
              disabled={pending !== 'idle'}
            >
              {custodianState === 'past_due' ? copy.manageSubPastDue : copy.manageSub}
            </button>
          )}
        </div>
      </section>
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
