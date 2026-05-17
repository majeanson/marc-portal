import { useEffect, useState } from 'react'
import type { Lang } from '../i18n'
import { patchSession, type SessionRow } from '../lib/sessionsApi'
import {
  getPaymentSummary,
  openCustomerPortal,
  startCheckout,
  type PaymentKind,
  type PaymentSummary,
} from '../lib/paymentsApi'
import { formatDate } from '../lib/format'

const COPY = {
  fr: {
    // Project payment section.
    // Button-label amounts mirror the Intl.NumberFormat output below
    // (formatCadCents) so the button and the post-payment "Payé · X $"
    // pill use the same convention. OQLF: thin-space + dollar sign after.
    projectHeading: 'Paiement du projet',
    payTier1: 'Payer Tier 1 (≈ 300 $) →',
    payTier2Deposit: 'Payer le dépôt (≈ 750 $) →',
    payTier2Final: 'Payer le solde (≈ 750 $) →',
    payTier2FinalHint:
      'Disponible maintenant si tu veux solder. Sinon, Marc te ping à la livraison — pas pressé.',
    payTier3Quoted: (amount: string) => `Payer ${amount} →`,
    tier3PendingQuote:
      'Devis Tier 3 en attente — Marc poste le montant dans le fil ci-dessous (et te ping par courriel) sous 72 h.',
    askFirst: 'Question avant de payer ? Écris-moi ↓',
    paid: 'Payé ✓',
    paidAmount: (amount: string) => `Payé · ${amount}`,
    partiallyRefunded: (amount: string) => `Remboursement partiel : ${amount}`,
    fullyRefunded: (amount: string) => `Remboursé · ${amount}`,
    checkoutPending: 'Ouverture du paiement…',

    // Custodian section — now framed as the recommended default. The $200/yr
    // exists precisely so Marc handles the ops stack (DNS, Cloudflare, D1,
    // Resend, secret rotation) instead of explaining it; Custodian is the
    // path that lets him do that.
    custodianHeading: 'Mode dépositaire',
    custodianRecommended: 'recommandé',
    custodianActive: 'mode actuel',
    custodianPastDueLabel: 'paiement en retard',
    custodianEnded: 'terminé',
    custodianDetailsLink: 'Voir les détails ↗',
    custodianPitch:
      'Mode par défaut. Marc garde les clés (repo, domaine, Cloudflare, Resend) pour 200 $/an, gère DNS, renouvellements, certificats, mises à jour de sécurité, et inclut jusqu’à 2 h/mois de petites retouches. Annulable à tout moment — bascule automatique vers « Tout à toi ».',
    custodianActiveBody:
      'Marc détient repo, domaine et comptes en son nom. Renouvellement annuel automatique. Tu peux annuler ou modifier le mode de paiement via le portail Stripe.',
    custodianPastDueBody:
      'Stripe n’a pas réussi à débiter ta carte. Mets à jour le mode de paiement avant la fin de la période de grâce, sinon ton mode bascule automatiquement vers « Tout à toi ».',
    custodianEndedBody:
      'Ton abonnement dépositaire a pris fin. Tu es maintenant en mode « Tout à toi » — tout est à ton nom. Tu peux reprendre l’abonnement à tout moment.',
    paySubscribe: 'Activer le mode dépositaire (200 $/an) →',
    paySubscribeAgain: 'Reprendre l’abonnement →',
    manageSub: 'Gérer l’abonnement ↗',
    manageSubPastDue: 'Mettre à jour le paiement ↗',

    // "Tout à toi" — now framed as an explicit opt-out. The visitor must
    // tick a skills checklist before they can confirm; Marc doesn't want to
    // explain DNS records and Resend SPF — Custodian exists to absorb that.
    toutAToiHeading: 'Tout à toi',
    toutAToiOptOut: 'à la place du dépositaire',
    toutAToiCurrent: 'mode actuel',
    toutAToiEndedByCancel: 'mode actuel (abonnement annulé)',
    toutAToiPitch:
      'À la place du dépositaire — pour les visiteurs déjà à l’aise avec leur stack. Tout passe à ton nom à la livraison. Tu reprends la garde du repo, du domaine, du compte Cloudflare, et de Resend. Marc n’assure plus le service.',
    toutAToiAckIntro:
      'Avant de confirmer, coche la case ci-dessous. Le mode dépositaire existe précisément parce que ces tâches sont fastidieuses ; si tu coches sans les connaître, tu prends le risque d’un site qui casse silencieusement et que Marc ne te dépannera pas gratuitement.',
    toutAToiSkillsHeading: 'Je sais gérer :',
    toutAToiSkills: [
      'Enregistrements DNS (A, CNAME, MX, TXT) chez mon registrar',
      'Déploiements Cloudflare Pages (env, domaine, rollback)',
      'Migrations et exports D1 (SQLite, secrets de connexion)',
      'Resend (SPF, DKIM, DMARC) pour mon domaine',
      'Rotation des clés API et secrets HMAC',
      'Admin GitHub (collaborateurs, branches, déploiements)',
    ],
    toutAToiAckCheckbox:
      'Je confirme. Je prends la responsabilité de la stack. Marc ne gère plus rien après la livraison.',
    toutAToiConfirm: 'Confirmer « Tout à toi »',
    toutAToiAcking: 'Confirmation…',
    toutAToiAckedOn: (date: string) => `Confirmé le ${date}`,
    toutAToiAckedBody:
      'Tu as pris la responsabilité de la stack. Marc te transfère les comptes à la livraison ; au-delà, c’est à toi.',
    toutAToiSwitchToCustodian: 'Activer le mode dépositaire à la place →',
    toutAToiAckError:
      'Échec — réessaie. La décision peut aussi être prise plus tard.',

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
    payTier2FinalHint:
      "Available now if you want to clear it. Otherwise Marc'll ping you at delivery — no rush.",
    payTier3Quoted: (amount: string) => `Pay ${amount} →`,
    tier3PendingQuote:
      'Tier 3 quote pending — Marc posts the amount in the thread below (and emails you) within 72h.',
    askFirst: 'Question before paying? Drop me a note ↓',
    paid: 'Paid ✓',
    paidAmount: (amount: string) => `Paid · ${amount}`,
    partiallyRefunded: (amount: string) => `Partial refund: ${amount}`,
    fullyRefunded: (amount: string) => `Refunded · ${amount}`,
    checkoutPending: 'Opening checkout…',

    custodianHeading: 'Custodian mode',
    custodianRecommended: 'recommended',
    custodianActive: 'current mode',
    custodianPastDueLabel: 'payment past due',
    custodianEnded: 'ended',
    custodianDetailsLink: 'See the details ↗',
    custodianPitch:
      "Default mode. Marc holds the keys (repo, domain, Cloudflare, Resend) for $200/yr, handles DNS, renewals, certificates, security updates, and includes up to 2h/month of small tweaks. Cancel anytime — auto-switches to \"All yours\".",
    custodianActiveBody:
      'Marc holds repo, domain, and accounts in his name. Auto-renews annually. You can cancel or update the payment method via the Stripe portal.',
    custodianPastDueBody:
      'Stripe failed to charge your card. Update the payment method before the grace period ends, otherwise your mode auto-switches to "All yours".',
    custodianEndedBody:
      'Your custodian subscription has ended. You\'re now in "All yours" mode — everything is in your name. You can re-subscribe anytime.',
    paySubscribe: 'Activate custodian mode ($200/yr) →',
    paySubscribeAgain: 'Re-activate subscription →',
    manageSub: 'Manage subscription ↗',
    manageSubPastDue: 'Update payment method ↗',

    toutAToiHeading: 'All yours',
    toutAToiOptOut: 'opt out of custodian',
    toutAToiCurrent: 'current mode',
    toutAToiEndedByCancel: 'current mode (subscription canceled)',
    toutAToiPitch:
      'Instead of Custodian — for visitors already comfortable with their stack. Everything moves to your name at delivery. You take back the repo, domain, Cloudflare account, and Resend setup. Marc is no longer on the hook.',
    toutAToiAckIntro:
      "Before you confirm, tick the checkbox below. Custodian mode exists precisely because these tasks are tedious; if you tick without knowing them, you risk a site that breaks quietly and Marc won't fix it for free.",
    toutAToiSkillsHeading: 'I can handle:',
    toutAToiSkills: [
      'DNS records (A, CNAME, MX, TXT) at my registrar',
      'Cloudflare Pages deploys (env, domain, rollback)',
      'D1 migrations and exports (SQLite, connection secrets)',
      'Resend (SPF, DKIM, DMARC) for my domain',
      'Rotating API keys and HMAC secrets',
      'GitHub admin (collaborators, branches, deploys)',
    ],
    toutAToiAckCheckbox:
      "I confirm. I take responsibility for the stack. Marc isn't on the hook after delivery.",
    toutAToiConfirm: 'Confirm "All yours"',
    toutAToiAcking: 'Confirming…',
    toutAToiAckedOn: (date: string) => `Confirmed on ${date}`,
    toutAToiAckedBody:
      "You've taken responsibility for the stack. Marc transfers the accounts at delivery; from there, it's on you.",
    toutAToiSwitchToCustodian: 'Activate Custodian mode instead →',
    toutAToiAckError: 'Failed — try again. The decision can also be made later.',

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
export function PaymentActions({
  session: sessionProp,
  lang,
  variant = 'full',
}: {
  session: SessionRow
  lang: Lang
  /** 'full' (default): sectioned block with test banner, project section,
   *  custodian section with explainer copy. Used on /session/:id.
   * 'compact': just the primary Pay button (or paid pill / pending hint) and
   *  a single-line custodian status pill if relevant. No section headings,
   *  no explainer text. Used on /me cards to avoid a wall of repeated copy
   *  across multiple sessions.
   */
  variant?: 'compact' | 'full'
}) {
  const copy = COPY[lang]
  const langPrefix = lang === 'en' ? '/en' : ''
  const [summary, setSummary] = useState<PaymentSummary | null>(null)
  const [pending, setPending] = useState<'idle' | 'checkout' | 'portal' | 'acking'>('idle')
  const [ackChecked, setAckChecked] = useState(false)
  const [ackError, setAckError] = useState(false)
  // Override for the ack timestamp so a successful PATCH updates the UI
  // without forcing the parent to refetch. The prop's value wins by
  // default; the override applies only when set locally. Keyed on the
  // session id so reusing the component for a different session doesn't
  // leak stale ack state (lazy init reads the live prop).
  const [ackedAtOverride, setAckedAtOverride] = useState<number | null>(null)
  // Stable: this comparison is in render-time only, no setState side effect.
  const effectiveAckedAt =
    ackedAtOverride !== null
      ? ackedAtOverride
      : sessionProp.all_yours_acknowledged_at
  const session: SessionRow = {
    ...sessionProp,
    all_yours_acknowledged_at: effectiveAckedAt,
  }

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
  const onAckAllYours = async () => {
    if (!ackChecked || pending !== 'idle') return
    setPending('acking')
    setAckError(false)
    try {
      const r = await patchSession(session.id, { acknowledgeAllYours: true })
      // Store the server's authoritative timestamp so the "Confirmed on X"
      // line renders accurately even before the parent refetches.
      setAckedAtOverride(r.session.all_yours_acknowledged_at)
    } catch {
      setAckError(true)
    } finally {
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
    // Tier 3 has no canonical price — admin quotes via SessionPage's Tier3
    // amount input, persisted as tier3_amount_cents. Show the actual amount
    // in the button label when quoted; suppress the button when not (a
    // "quote pending" hint renders in its place below).
    if (session.tier3_amount_cents != null) {
      const formatted = formatCadCents(session.tier3_amount_cents, lang)
      payButton = { label: copy.payTier3Quoted(formatted), kind: 'tier3' }
    }
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
  const oneTimeRows = summary.rows.filter((r) => r.kind !== 'custodian-sub' && r.paid_at)
  const paidOneTimeCents = oneTimeRows
    .filter((r) => r.status === 'paid')
    .reduce((sum, r) => sum + r.amount_cents, 0)
  // Refunds: a row with refunded_amount_cents > 0 OR a status='refunded' row
  // (which means amount_cents was fully refunded). We surface them as a
  // separate line so the visitor sees the net picture without us silently
  // subtracting from the "Paid" total.
  const refundedCents = oneTimeRows.reduce(
    (sum, r) => sum + (r.refunded_amount_cents ?? 0),
    0,
  )
  const allOneTimeFullyRefunded =
    oneTimeRows.length > 0 && oneTimeRows.every((r) => r.status === 'refunded')
  const paidLabel = allOneTimeFullyRefunded
    ? copy.fullyRefunded(formatCadCents(refundedCents, lang))
    : paidOneTimeCents > 0
      ? copy.paidAmount(formatCadCents(paidOneTimeCents, lang))
      : copy.paid
  // Show the partial-refund note only when there's an actual partial — i.e.
  // refunded > 0 but not everything is fully refunded.
  const partialRefundLabel =
    refundedCents > 0 && !allOneTimeFullyRefunded
      ? copy.partiallyRefunded(formatCadCents(refundedCents, lang))
      : null

  // Decide what to render in the project-payment section.
  //   'pay'           — payButton is set (tier 1/2/3, work owing)
  //   'paid'          — at least one one-time row paid (any tier)
  //   'pending-quote' — tier 3, admin hasn't set tier3_amount_cents yet,
  //                     no payment yet. Show a "quote pending" hint instead
  //                     of a Pay button or a misleading "Paid" pill.
  //   'hidden'        — tier not set (null) OR tier 0 (free engagement)
  // The custodian section is gated separately below.
  const projectState: 'pay' | 'paid' | 'pending-quote' | 'hidden' =
    session.tier === null || session.tier === 0
      ? 'hidden'
      : payButton
        ? 'pay'
        : session.tier === 3 && session.tier3_amount_cents == null && !summary.hasPaidDeposit
          ? 'pending-quote'
          : 'paid'

  // Ownership-mode gating. Policy flip: Custodian is the recommended
  // default; "Tout à toi" is an explicit opt-out that requires the visitor
  // to acknowledge a technical-skills checklist (DNS, Cloudflare, D1,
  // Resend, secret rotation). Why: the $200/yr exists precisely so Marc
  // doesn't have to teach those skills — a silent "do nothing = All yours"
  // default produced support drag.
  //
  //   - showCustodianSection: shipped OR a subscription state exists. When
  //     no decision yet, this section renders FIRST as the recommended
  //     path. When a sub is active/past_due it's the only section shown
  //     (manage via Stripe portal).
  //   - showAllYoursSection: shipped AND custodian isn't currently active
  //     or past_due. Covers (a) decision-pending → ack UI, (b) acked →
  //     "current mode confirmed on X", (c) sub ended → "current mode by
  //     default (sub ended)". Hidden mid-build and during an active sub
  //     so we never read as urging the visitor to drop Custodian.
  //
  // Tier-0 free engagements with no sub history: both false → silent.
  const allYoursAcked = session.all_yours_acknowledged_at !== null
  const showCustodianSection = session.status === 'shipped' || custodianState !== 'none'
  const showAllYoursSection =
    session.status === 'shipped' && custodianState !== 'active' && custodianState !== 'past_due'
  const showOwnershipDecision = showAllYoursSection || showCustodianSection

  // Decision-pending: shipped, no sub, no ack. This is the only state where
  // we render Custodian as visually primary and All-yours below as an
  // acknowledged opt-out. In all other states (acked / sub-ended / sub-
  // active) sections render as peer status surfaces with no urgency.
  const decisionPending =
    session.status === 'shipped' && custodianState === 'none' && !allYoursAcked

  // Don't render the whole block when there's literally nothing to show.
  if (projectState === 'hidden' && !showOwnershipDecision) {
    return null
  }

  // Compact variant: /me cards. Show just the essentials so a visitor with
  // 5 sessions doesn't see 5 walls of identical explainer copy. The full
  // explainer lives on /session/:id; we link there for the custodian
  // decision when relevant.
  if (variant === 'compact') {
    return (
      <div className="me-portal__card-payments me-portal__card-payments--compact">
        {summary.stripeMode === 'test' && (
          <span
            className="me-portal__pay-test-chip mono"
            title={copy.testModeBody}
            aria-label={copy.testModeBody}
          >
            {copy.testModeBadge}
          </span>
        )}
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
        {projectState === 'paid' && (
          <>
            <span className="me-portal__pay-paid">{paidLabel}</span>
            {partialRefundLabel && (
              <span className="me-portal__pay-refund mono">{partialRefundLabel}</span>
            )}
          </>
        )}
        {projectState === 'pending-quote' && (
          <span className="me-portal__pay-muted">{copy.tier3PendingQuote}</span>
        )}
        {showCustodianSection && (
          <span
            className={`me-portal__pay-cust-pill me-portal__pay-cust-pill--${custodianState} mono`}
          >
            {copy.custodianHeading}
            {' · '}
            {custodianState === 'active' && copy.custodianActive}
            {custodianState === 'past_due' && copy.custodianPastDueLabel}
            {custodianState === 'ended' && copy.custodianEnded}
            {custodianState === 'none' &&
              (decisionPending ? copy.custodianRecommended : copy.custodianRecommended)}
          </span>
        )}
        {showAllYoursSection && (
          <span className="me-portal__pay-cust-pill me-portal__pay-cust-pill--tout mono">
            {copy.toutAToiHeading}
            {' · '}
            {allYoursAcked
              ? copy.toutAToiCurrent
              : custodianState === 'ended'
                ? copy.toutAToiCurrent
                : copy.toutAToiOptOut}
          </span>
        )}
      </div>
    )
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
            {projectState === 'paid' && (
              <>
                <span className="me-portal__pay-paid">{paidLabel}</span>
                {partialRefundLabel && (
                  <span className="me-portal__pay-refund mono">{partialRefundLabel}</span>
                )}
              </>
            )}
            {projectState === 'pending-quote' && (
              <span className="me-portal__pay-muted">{copy.tier3PendingQuote}</span>
            )}
          </div>
          {/* Tier-2 final-balance timing: button is live as soon as deposit is
              paid, but most visitors should wait for handoff. Surface the
              expectation inline so the timing isn't ambiguous. */}
          {projectState === 'pay' && payButton?.kind === 'tier2-final' && (
            <p className="field__hint me-portal__pay-hint">{copy.payTier2FinalHint}</p>
          )}
          {projectState === 'pay' && (
            <a href="#thread" className="me-portal__pay-ask-link mono">
              {copy.askFirst}
            </a>
          )}
        </section>
      )}

      {(() => {
        // Decision-pending puts Custodian first as the recommended path.
        // All other states show All-yours first (it's the "current mode"
        // framing). The ordering decision is purely visual — both sections
        // are independent.
        const custodianTag =
          custodianState === 'active'
            ? copy.custodianActive
            : custodianState === 'past_due'
              ? copy.custodianPastDueLabel
              : custodianState === 'ended'
                ? copy.custodianEnded
                : copy.custodianRecommended
        const custodianBody =
          custodianState === 'active'
            ? copy.custodianActiveBody
            : custodianState === 'past_due'
              ? copy.custodianPastDueBody
              : custodianState === 'ended'
                ? copy.custodianEndedBody
                : copy.custodianPitch

        const custodianSection = showCustodianSection ? (
          <section
            key="cust"
            className={`me-portal__pay-section me-portal__pay-custodian me-portal__pay-custodian--${custodianState}${decisionPending ? ' me-portal__pay-custodian--recommended' : ''}`}
            aria-labelledby={`pay-cust-${session.id}`}
          >
            <header className="me-portal__pay-section-head">
              <h3 className="me-portal__pay-section-title mono" id={`pay-cust-${session.id}`}>
                {copy.custodianHeading}{' '}
                <span className="me-portal__pay-section-tag mono">{custodianTag}</span>
              </h3>
              <a className="me-portal__pay-details-link mono" href={`${langPrefix}/handoff`}>
                {copy.custodianDetailsLink}
              </a>
            </header>
            <p className="me-portal__pay-custodian-body">{custodianBody}</p>
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
        ) : null

        // All-yours has three visual variants:
        //   (a) acked → "Confirmed on X" + body, no ack UI; offer
        //       "Activate Custodian instead" link as escape hatch.
        //   (b) custodianState === 'ended' (canceled / switched) → current
        //       mode by default after the sub ended; no ack UI.
        //   (c) decision-pending (none + !acked) → pitch + skills list +
        //       checkbox + Confirm button.
        const ackedDate =
          session.all_yours_acknowledged_at != null
            ? formatDate(
                new Date(session.all_yours_acknowledged_at * 1000).toISOString().slice(0, 10),
                lang,
              )
            : null
        const allYoursTag = allYoursAcked
          ? copy.toutAToiCurrent
          : custodianState === 'ended'
            ? copy.toutAToiEndedByCancel
            : copy.toutAToiOptOut
        const allYoursSection = showAllYoursSection ? (
          <section
            key="tout"
            className={`me-portal__pay-section me-portal__pay-tout-a-toi${decisionPending ? ' me-portal__pay-tout-a-toi--secondary' : ''}`}
            aria-labelledby={`pay-tout-${session.id}`}
          >
            <header className="me-portal__pay-section-head">
              <h3 className="me-portal__pay-section-title mono" id={`pay-tout-${session.id}`}>
                {copy.toutAToiHeading}{' '}
                <span className="me-portal__pay-section-tag mono">{allYoursTag}</span>
              </h3>
              <a className="me-portal__pay-details-link mono" href={`${langPrefix}/handoff`}>
                {copy.custodianDetailsLink}
              </a>
            </header>
            {allYoursAcked ? (
              <>
                <p className="me-portal__pay-custodian-body">
                  {ackedDate && (
                    <span className="me-portal__pay-acked-on mono">
                      {copy.toutAToiAckedOn(ackedDate)}
                    </span>
                  )}{' '}
                  {copy.toutAToiAckedBody}
                </p>
              </>
            ) : custodianState === 'ended' ? (
              <p className="me-portal__pay-custodian-body">{copy.custodianEndedBody}</p>
            ) : (
              // Decision-pending: skills list + checkbox + confirm.
              <>
                <p className="me-portal__pay-custodian-body">{copy.toutAToiPitch}</p>
                <p className="me-portal__pay-custodian-body me-portal__pay-ack-intro">
                  {copy.toutAToiAckIntro}
                </p>
                <div className="me-portal__pay-ack-skills">
                  <div className="mono me-portal__pay-ack-skills-heading">
                    {copy.toutAToiSkillsHeading}
                  </div>
                  <ul className="me-portal__pay-ack-skills-list">
                    {copy.toutAToiSkills.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </div>
                <label className="me-portal__pay-ack-checkbox">
                  <input
                    type="checkbox"
                    checked={ackChecked}
                    onChange={(e) => setAckChecked(e.target.checked)}
                    disabled={pending === 'acking'}
                  />
                  <span>{copy.toutAToiAckCheckbox}</span>
                </label>
                <div className="me-portal__pay-section-body">
                  <button
                    type="button"
                    className="me-portal__pay-btn me-portal__pay-btn--secondary"
                    onClick={onAckAllYours}
                    disabled={!ackChecked || pending !== 'idle'}
                  >
                    {pending === 'acking' ? copy.toutAToiAcking : copy.toutAToiConfirm}
                  </button>
                </div>
                {ackError && (
                  <p
                    className="mono me-portal__pay-ack-error"
                    role="alert"
                    aria-live="assertive"
                  >
                    {copy.toutAToiAckError}
                  </p>
                )}
              </>
            )}
          </section>
        ) : null

        // Render order — Custodian first when decision-pending, All-yours
        // first otherwise.
        return decisionPending ? (
          <>
            {custodianSection}
            {allYoursSection}
          </>
        ) : (
          <>
            {allYoursSection}
            {custodianSection}
          </>
        )
      })()}
    </div>
  )
}

/**
 * Format CAD cents per OQLF convention (FR) or standard locale (EN).
 * Round-dollar amounts drop the cents portion so "Paid · $300" reads cleaner
 * than "Paid · $300.00". Mirrors the server-side helper in functions/_lib/email.ts.
 * 75000 cents → "750 $" (fr-CA) or "$750" (en-CA); 75050 → "750,50 $" / "$750.50".
 */
function formatCadCents(cents: number, lang: Lang): string {
  const isRound = cents % 100 === 0
  return new Intl.NumberFormat(lang === 'fr' ? 'fr-CA' : 'en-CA', {
    style: 'currency',
    currency: 'CAD',
    currencyDisplay: lang === 'fr' ? 'symbol' : 'narrowSymbol',
    minimumFractionDigits: isRound ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}
