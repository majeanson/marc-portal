import { useEffect, useState } from 'react'
import type { Lang } from '../i18n'
import { patchSession, type SessionRow } from '../lib/sessionsApi'
import {
  getPaymentSummary,
  openCustomerPortal,
  startCheckout,
  type CustodianPlan,
  type PaymentKind,
  type PaymentSummary,
} from '../lib/paymentsApi'
import { formatDate, formatCadCents } from '../lib/format'

const COPY = {
  fr: {
    // Project payment section.
    // Button-label amounts come from formatCadCents (lib/format) so the
    // button and the post-payment "Payé · X $" pill use the same
    // convention. OQLF: thin-space + dollar sign after.
    projectHeading: 'Paiement du projet',
    payInstallment: (idx: number, of: number, amount: string) =>
      of > 1 ? `Payer le versement ${idx}/${of} (${amount}) →` : `Payer (${amount}) →`,
    installmentHint:
      'Disponible maintenant si tu veux régler d’avance. Sinon, Marc te ping — pas pressé.',
    quotePending:
      'Devis Tier 4 en attente — Marc poste le montant dans le fil ci-dessous (et te ping par courriel) sous 72 h.',
    scopingPaid: 'Rapport de cadrage payé — 250 $ crédités sur ton build.',
    scopingOffer:
      'Tu veux un cadrage écrit et un devis ferme avant de t’engager ? Le rapport de cadrage est à 250 $, entièrement crédité sur ton build si tu embarques.',
    payScoping: 'Payer le rapport de cadrage (250 $) →',
    askFirst: 'Question avant de payer ? Écris-moi ↓',
    paid: 'Payé ✓',
    paidAmount: (amount: string) => `Payé · ${amount}`,
    partiallyRefunded: (amount: string) => `Remboursement partiel : ${amount}`,
    fullyRefunded: (amount: string) => `Remboursé · ${amount}`,
    checkoutPending: 'Ouverture du paiement…',

    // Custodian section — the recommended default at delivery. Two annual
    // plans (Watch / Care); bigger changes are billed hourly ($75/h).
    custodianHeading: 'Mode dépositaire',
    custodianRecommended: 'recommandé',
    custodianActive: 'mode actuel',
    custodianPastDueLabel: 'paiement en retard',
    custodianEnded: 'terminé',
    custodianDetailsLink: 'Voir les détails ↗',
    custodianPitch:
      'Mode par défaut à la livraison. Marc garde les clés (repo, domaine, Cloudflare, Resend) et garde le site en ligne. Deux forfaits annuels : Watch (120 $/an — surveillance, correctifs de sécurité, mises à jour des dépendances) ou Care (400 $/an — tout Watch, plus 2 h/an de retouches et la file prioritaire). Les changements plus gros se facturent à 75 $/h. Annulable à tout moment — bascule automatique vers « Tout à toi ».',
    custodianActiveBody:
      'Marc détient repo, domaine et comptes en son nom. Renouvellement annuel automatique. Tu peux annuler ou modifier le mode de paiement via le portail Stripe.',
    custodianPastDueBody:
      'Stripe n’a pas réussi à débiter ta carte. Mets à jour le mode de paiement avant la fin de la période de grâce, sinon ton mode bascule automatiquement vers « Tout à toi ».',
    custodianEndedBody:
      'Ton abonnement dépositaire a pris fin. Tu es maintenant en mode « Tout à toi » — tout est à ton nom. Tu peux reprendre un forfait à tout moment.',
    payWatch: 'Activer Watch (120 $/an) →',
    payCare: 'Activer Care (400 $/an) →',
    manageSub: 'Gérer l’abonnement ↗',
    manageSubPastDue: 'Mettre à jour le paiement ↗',

    // "Tout à toi" — an explicit opt-out. The visitor must tick a skills
    // checklist before they can confirm.
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
      'Je confirme. Je prends la responsabilité des outils. Marc ne gère plus rien après la livraison.',
    toutAToiConfirm: 'Confirmer « Tout à toi »',
    toutAToiAcking: 'Confirmation…',
    toutAToiAckedOn: (date: string) => `Confirmé le ${date}`,
    toutAToiAckedBody:
      'Tu as pris la responsabilité des outils. Marc te transfère les comptes à la livraison ; au-delà, c’est à toi.',
    toutAToiSwitchToCustodian: 'Activer le mode dépositaire à la place →',
    toutAToiAckError: 'Échec — réessaie. La décision peut aussi être prise plus tard.',

    // Test mode banner
    testModeBadge: 'MODE TEST',
    testModeBody:
      'Aucun vrai débit. Pour tester un paiement : carte 4242 4242 4242 4242, n’importe quelle date future (ex. 12/30), n’importe quel CVC (ex. 123), n’importe quel code postal (ex. H1A 1A1).',
  },
  en: {
    projectHeading: 'Project payment',
    payInstallment: (idx: number, of: number, amount: string) =>
      of > 1 ? `Pay installment ${idx}/${of} (${amount}) →` : `Pay (${amount}) →`,
    installmentHint:
      "Available now if you'd like to pay ahead. Otherwise Marc'll ping you — no rush.",
    quotePending:
      'Tier 4 quote pending — Marc posts the amount in the thread below (and emails you) within 72h.',
    scopingPaid: 'Scoping report paid — $250 credited to your build.',
    scopingOffer:
      'Want a written scope and a firm quote before you commit? The scoping report is $250, fully credited to your build if you go ahead.',
    payScoping: 'Pay the scoping report ($250) →',
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
      'Default mode at delivery. Marc holds the keys (repo, domain, Cloudflare, Resend) and keeps the site online. Two annual plans: Watch ($120/yr — monitoring, security patches, dependency updates) or Care ($400/yr — everything in Watch, plus 2h/yr of tweaks and the priority queue). Bigger changes are billed at $75/hr. Cancel anytime — auto-switches to "All yours".',
    custodianActiveBody:
      'Marc holds repo, domain, and accounts in his name. Auto-renews annually. You can cancel or update the payment method via the Stripe portal.',
    custodianPastDueBody:
      'Stripe failed to charge your card. Update the payment method before the grace period ends, otherwise your mode auto-switches to "All yours".',
    custodianEndedBody:
      'Your custodian subscription has ended. You\'re now in "All yours" mode — everything is in your name. You can re-subscribe to a plan anytime.',
    payWatch: 'Activate Watch ($120/yr) →',
    payCare: 'Activate Care ($400/yr) →',
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
 *   1. TEST MODE banner — when Stripe runs against a test key (sk_test_*).
 *   2. "Project payment" — installment-aware pay buttons. The server's
 *      `build` summary says which leg is owed and its amount (scoping credit
 *      already applied); a Tier-4 quote-pending state shows a hint instead.
 *      A scoping-report offer surfaces during triage.
 *   3. "Custodian mode" — the post-handoff ownership decision: two annual
 *      plans (Watch / Care), or the All-yours opt-out.
 *
 * Returns null when there's nothing to show. The custodian decision is a
 * top-level section — it's the only ongoing financial commitment, so it's
 * presented clearly, not buried. See /handoff for the narrative it mirrors.
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
   *  a single-line custodian status pill. Used on /me cards. */
  variant?: 'compact' | 'full'
}) {
  const copy = COPY[lang]
  const langPrefix = lang === 'en' ? '/en' : ''
  const [summary, setSummary] = useState<PaymentSummary | null>(null)
  const [pending, setPending] = useState<'idle' | 'checkout' | 'portal' | 'acking'>('idle')
  const [ackChecked, setAckChecked] = useState(false)
  const [ackError, setAckError] = useState(false)
  // Override for the ack timestamp so a successful PATCH updates the UI
  // without forcing the parent to refetch.
  const [ackedAtOverride, setAckedAtOverride] = useState<number | null>(null)
  const effectiveAckedAt =
    ackedAtOverride !== null ? ackedAtOverride : sessionProp.all_yours_acknowledged_at
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

  const onPay = async (kind: PaymentKind, custodianPlan?: CustodianPlan) => {
    setPending('checkout')
    try {
      const r = await startCheckout({ sessionId: session.id, kind, custodianPlan, lang })
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
      setAckedAtOverride(r.session.all_yours_acknowledged_at)
    } catch {
      setAckError(true)
    } finally {
      setPending('idle')
    }
  }

  // The build summary is the single driver of the project section. It carries
  // the next unpaid installment (server-computed, scoping credit applied) or
  // signals a Tier-4 quote pending.
  const build = summary.build
  const payButton: { label: string } | null =
    build && build.nextIndex != null && build.nextAmountCents != null
      ? {
          label: copy.payInstallment(
            build.nextIndex,
            build.installmentCount,
            formatCadCents(build.nextAmountCents, lang),
          ),
        }
      : null

  const custodianState: 'none' | 'active' | 'past_due' | 'ended' =
    summary.custodianStatus === 'active'
      ? 'active'
      : summary.custodianStatus === 'past_due'
        ? 'past_due'
        : summary.custodianStatus === 'switched_to_tout_a_toi' ||
            summary.custodianStatus === 'canceled'
          ? 'ended'
          : 'none'

  // Sum all paid one-time rows (build legs + scoping) so a visitor who paid
  // several installments sees the running total. Custodian sub renewals are
  // excluded — they're a separate perpetual flow with its own Manage link.
  const oneTimeRows = summary.rows.filter((r) => r.kind !== 'custodian' && r.paid_at)
  const paidOneTimeCents = oneTimeRows
    .filter((r) => r.status === 'paid')
    .reduce((sum, r) => sum + r.amount_cents, 0)
  const refundedCents = oneTimeRows.reduce((sum, r) => sum + (r.refunded_amount_cents ?? 0), 0)
  const allOneTimeFullyRefunded =
    oneTimeRows.length > 0 && oneTimeRows.every((r) => r.status === 'refunded')
  const paidLabel = allOneTimeFullyRefunded
    ? copy.fullyRefunded(formatCadCents(refundedCents, lang))
    : paidOneTimeCents > 0
      ? copy.paidAmount(formatCadCents(paidOneTimeCents, lang))
      : copy.paid
  const partialRefundLabel =
    refundedCents > 0 && !allOneTimeFullyRefunded
      ? copy.partiallyRefunded(formatCadCents(refundedCents, lang))
      : null

  // Scoping report — paid note, or an offer during triage (before a tier).
  const scopingPaid = summary.scoping.paid
  const showScopingOffer = !scopingPaid && session.status === 'triage'
  const showScoping = scopingPaid || showScopingOffer

  // Project section state:
  //   'pay'           — payButton set (an installment is owed)
  //   'paid'          — build classified, all installments paid
  //   'pending-quote' — Tier 4 classified, admin hasn't quoted yet
  //   'hidden'        — no build (tier null or 0)
  const projectState: 'pay' | 'paid' | 'pending-quote' | 'hidden' = !build
    ? 'hidden'
    : build.quotePending
      ? 'pending-quote'
      : payButton
        ? 'pay'
        : 'paid'

  // More installments after this one? Mirror the old Tier-2 final-balance
  // timing hint — the button is live now, but waiting is fine.
  const showInstallmentHint = build != null && build.nextIndex != null && build.nextIndex > 1

  const allYoursAcked = session.all_yours_acknowledged_at !== null
  const showCustodianSection = session.status === 'shipped' || custodianState !== 'none'
  const showAllYoursSection =
    session.status === 'shipped' && custodianState !== 'active' && custodianState !== 'past_due'
  const showOwnershipDecision = showAllYoursSection || showCustodianSection

  const decisionPending =
    session.status === 'shipped' && custodianState === 'none' && !allYoursAcked

  // Nothing to show at all.
  if (projectState === 'hidden' && !showOwnershipDecision && !showScoping) {
    return null
  }

  // Compact variant: /me cards. Just the essentials — no explainer walls.
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
            onClick={() => onPay('build')}
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
          <span className="me-portal__pay-muted">{copy.quotePending}</span>
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
            {custodianState === 'none' && copy.custodianRecommended}
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

      {(projectState !== 'hidden' || showScoping) && (
        <section
          id="session-paiement"
          className="me-portal__pay-section"
          aria-labelledby={`pay-proj-${session.id}`}
        >
          <h3 className="me-portal__pay-section-title mono" id={`pay-proj-${session.id}`}>
            {copy.projectHeading}
          </h3>
          <div className="me-portal__pay-section-body">
            {projectState === 'pay' && payButton && (
              <button
                type="button"
                className="me-portal__pay-btn"
                onClick={() => onPay('build')}
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
              <span className="me-portal__pay-muted">{copy.quotePending}</span>
            )}
          </div>
          {projectState === 'pay' && showInstallmentHint && (
            <p className="field__hint me-portal__pay-hint">{copy.installmentHint}</p>
          )}
          {/* Scoping report — a note once paid, an offer during triage. */}
          {scopingPaid && <p className="field__hint me-portal__pay-hint">{copy.scopingPaid}</p>}
          {showScopingOffer && (
            <div className="me-portal__pay-scoping">
              <p className="field__hint me-portal__pay-hint">{copy.scopingOffer}</p>
              <button
                type="button"
                className="me-portal__pay-btn me-portal__pay-btn--secondary"
                onClick={() => onPay('scoping')}
                disabled={pending !== 'idle'}
              >
                {pending === 'checkout' ? copy.checkoutPending : copy.payScoping}
              </button>
            </div>
          )}
          {projectState === 'pay' && (
            <a href="#session-conversation" className="me-portal__pay-ask-link mono">
              {copy.askFirst}
            </a>
          )}
        </section>
      )}

      {(() => {
        // Decision-pending puts Custodian first as the recommended path.
        // All other states show All-yours first ("current mode" framing).
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
            id="session-livraison"
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
              {(custodianState === 'none' || custodianState === 'ended') && (
                <div className="me-portal__pay-custodian-plans">
                  <button
                    type="button"
                    className="me-portal__pay-btn"
                    onClick={() => onPay('custodian', 'watch')}
                    disabled={pending !== 'idle'}
                  >
                    {pending === 'checkout' ? copy.checkoutPending : copy.payWatch}
                  </button>
                  <button
                    type="button"
                    className="me-portal__pay-btn"
                    onClick={() => onPay('custodian', 'care')}
                    disabled={pending !== 'idle'}
                  >
                    {pending === 'checkout' ? copy.checkoutPending : copy.payCare}
                  </button>
                </div>
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

        // All-yours has three visual variants: (a) acked, (b) sub ended,
        // (c) decision-pending → pitch + skills list + checkbox + confirm.
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
                  <p className="mono me-portal__pay-ack-error" role="alert" aria-live="assertive">
                    {copy.toutAToiAckError}
                  </p>
                )}
              </>
            )}
          </section>
        ) : null

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
