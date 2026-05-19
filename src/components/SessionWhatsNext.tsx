import type { Lang } from '../i18n'
import type { SessionRow } from '../lib/sessionsApi'
import type { PaymentSummary } from '../lib/paymentsApi'
import { computeSla, formatRelativeWindow } from '../lib/format'

/**
 * One-line "you are here, here's what's next" strip rendered above the
 * payment block on /session/:id. Mirrors the state machine so the visitor
 * never has to guess what the system expects of them next.
 *
 * Hidden for admins — Marc has the status/tier strips for that. Hidden for
 * sessions where there's nothing distinctive to say (e.g. shipped without a
 * custodian decision is covered by the All-yours/Custodian sections
 * downstream).
 */
export function SessionWhatsNext({
  session,
  summary,
  isAdmin,
  lang,
}: {
  session: SessionRow
  /** May still be null while the summary fetch is in flight; we render a
   *  status-only message in that case and upgrade once it lands. */
  summary: PaymentSummary | null
  isAdmin: boolean
  lang: Lang
}) {
  if (isAdmin) return null

  const t = COPY[lang]
  const sla = computeSla(session)

  // Triage / draft: SLA-driven copy. Highest information density when the
  // visitor's wondering whether Marc will reply.
  if (session.status === 'triage' || session.status === 'draft') {
    const window = sla.active
      ? sla.overdue
        ? t.slaOverdue
        : formatRelativeWindow(sla.msLeft, lang)
      : null
    return <Frame tone="info">{window ? t.triageWithSla(window) : t.triagePlain}</Frame>
  }

  if (session.status === 'rejected') {
    return <Frame tone="muted">{t.rejected}</Frame>
  }

  // Shipped: the next step is the ownership decision (Custodian by default
  // vs explicit All-yours opt-out). For the decision-pending variants we
  // return null on purpose — the MODE DÉPOSITAIRE and TOUT À TOI sections
  // rendered directly below already carry the same explanation in full
  // detail, so a cream summary box above them was pure duplication. Only
  // post-decision status (subscription active, past-due, acked all-yours)
  // gets a strip, since those aren't redundant with the cards below.
  if (session.status === 'shipped') {
    const ackedAllYours = session.all_yours_acknowledged_at !== null
    const custActive = summary?.custodianStatus === 'active'
    const custPastDue = summary?.custodianStatus === 'past_due'
    if (custActive) return <Frame tone="ok">{t.shippedCustodianActive}</Frame>
    if (custPastDue) return <Frame tone="cta">{t.shippedCustodianPastDue}</Frame>
    if (ackedAllYours) return <Frame tone="ok">{t.shippedAllYoursAcked}</Frame>
    return null
  }

  // Active: most of the nuance. Branch on tier + payment summary.
  const tier = session.tier
  if (tier === null) {
    return <Frame tone="info">{t.activeNoTier}</Frame>
  }
  if (tier === 0) {
    return <Frame tone="info">{t.activeTier0}</Frame>
  }

  // For tier 1/2/3 we need the payment summary to say anything precise.
  if (!summary) {
    return <Frame tone="info">{t.activeLoading}</Frame>
  }

  if (tier === 1) {
    const paidT1 = summary.rows.some((r) => r.kind === 'tier1' && r.status === 'paid')
    return paidT1 ? (
      <Frame tone="ok">{t.activeTier1Paid}</Frame>
    ) : (
      <Frame tone="cta">{t.activeTier1Unpaid}</Frame>
    )
  }

  if (tier === 2) {
    const paidDeposit = summary.rows.some((r) => r.kind === 'tier2-deposit' && r.status === 'paid')
    const paidFinal = summary.rows.some((r) => r.kind === 'tier2-final' && r.status === 'paid')
    if (!paidDeposit) return <Frame tone="cta">{t.activeTier2NoDeposit}</Frame>
    if (!paidFinal) return <Frame tone="ok">{t.activeTier2DepositOnly}</Frame>
    return <Frame tone="ok">{t.activeTier2Cleared}</Frame>
  }

  if (tier === 3) {
    const hasPayRow = summary.rows.some((r) => r.kind === 'tier3' && r.status === 'paid')
    if (hasPayRow) return <Frame tone="ok">{t.activeTier3Paid}</Frame>
    if (session.tier3_amount_cents == null) {
      return <Frame tone="info">{t.activeTier3PendingQuote}</Frame>
    }
    return <Frame tone="cta">{t.activeTier3Quoted}</Frame>
  }

  return null
}

function Frame({
  tone,
  children,
}: {
  tone: 'info' | 'cta' | 'ok' | 'muted'
  children: React.ReactNode
}) {
  return (
    <aside
      className={`session-whats-next session-whats-next--${tone}`}
      role="status"
      aria-live="polite"
    >
      {children}
    </aside>
  )
}

const COPY = {
  fr: {
    triagePlain:
      'Marc lit ton intake et te répond — oui, non, ou « raconte-moi plus » — par courriel et dans le fil.',
    triageWithSla: (w: string) =>
      `Marc répond ${w} — oui, non, ou « raconte-moi plus ». Tu reçois aussi un courriel quand c’est posté.`,
    slaOverdue: 'bientôt (un peu en retard)',
    rejected:
      'Marc a refusé cette session — la raison est dans le fil. Tu peux ouvrir une nouvelle proposition à tout moment.',
    shippedNudgeDefault:
      'Projet livré. Par défaut tu pars en mode dépositaire (200 $/an) — Marc continue d’opérer le site. Si tu préfères « Tout à toi », confirme-le ci-dessous (checklist de compétences).',
    shippedNudgeCustodian:
      'Projet livré. Tu avais coché « Je m’en occupe » à l’intake — active le mode dépositaire ci-dessous (200 $/an) pour que Marc continue d’opérer le site.',
    shippedNudgeAllYours:
      'Projet livré. Tu avais coché « Tout à toi » à l’intake — confirme ci-dessous avec la checklist de compétences pour finaliser ce choix.',
    shippedAllYoursAcked:
      'Projet livré. Tu as confirmé « Tout à toi » — Marc te transfère les comptes. Tu peux toujours activer le mode dépositaire plus tard si besoin.',
    shippedCustodianActive:
      'Projet livré. Mode dépositaire actif — Marc opère le site. Gérer l’abonnement via le portail Stripe ci-dessous.',
    shippedCustodianPastDue:
      'Projet livré. Mode dépositaire actif mais Stripe n’a pas pu débiter ta carte — mets à jour le paiement via le portail Stripe ci-dessous avant la fin de la période de grâce.',
    activeNoTier:
      'Marc a accepté ton projet et le dimensionne. Tu verras le prix et le bouton « Payer » ici quand c’est prêt — par courriel aussi.',
    activeTier0:
      'Marc t’a redirigé vers un patron / template (Tier 0). Détails dans le fil ci-dessous — pas de paiement à faire.',
    activeLoading: 'Marc a accepté ton projet. Chargement des détails de paiement…',
    activeTier1Unpaid: 'Marc a accepté en Tier 1 (≈ 300 $). Paie ci-dessous pour démarrer.',
    activeTier1Paid:
      'Tier 1 payé. Marc démarre. Les avancements apparaissent dans la chronologie plus bas — tu reçois aussi un courriel aux étapes clés.',
    activeTier2NoDeposit:
      'Marc a accepté en Tier 2 (≈ 1 500 $, payé en deux temps). Paie le dépôt de 750 $ ci-dessous pour démarrer ; le solde de 750 $ est à la livraison.',
    activeTier2DepositOnly:
      'Dépôt Tier 2 reçu — Marc démarre. Le solde final (750 $) est dû à la livraison ; tu peux solder avant si tu veux.',
    activeTier2Cleared:
      'Tier 2 entièrement payé. Marc finalise. La livraison arrive — tu seras notifié par courriel.',
    activeTier3PendingQuote:
      'Marc a accepté en Tier 3 — il poste le montant exact dans le fil ci-dessous (et te ping par courriel) sous 72 h.',
    activeTier3Quoted:
      'Marc a posté son devis Tier 3. Paie ci-dessous pour démarrer ; questions dans le fil.',
    activeTier3Paid:
      'Tier 3 payé. Marc démarre. Les avancements apparaissent dans la chronologie plus bas.',
  },
  en: {
    triagePlain:
      "Marc is reading your intake and will reply — yes, no, or 'tell me more' — by email and in the thread.",
    triageWithSla: (w: string) =>
      `Marc replies ${w} — yes, no, or 'tell me more'. You'll also get an email when it's posted.`,
    slaOverdue: 'soon (a bit overdue)',
    rejected:
      'Marc declined this session — the reason is in the thread. You can open a new proposal anytime.',
    shippedNudgeDefault:
      'Project shipped. By default you go into custodian mode ($200/yr) — Marc keeps operating the site. If you prefer "All yours", confirm it below (skills checklist).',
    shippedNudgeCustodian:
      'Project shipped. You ticked "I handle it" at intake — activate custodian mode below ($200/yr) so Marc keeps operating the site.',
    shippedNudgeAllYours:
      'Project shipped. You ticked "All yours" at intake — confirm below with the skills checklist to finalize that choice.',
    shippedAllYoursAcked:
      'Project shipped. You confirmed "All yours" — Marc is transferring the accounts. You can still activate custodian mode later if needed.',
    shippedCustodianActive:
      'Project shipped. Custodian mode active — Marc is operating the site. Manage the subscription via the Stripe portal below.',
    shippedCustodianPastDue:
      "Project shipped. Custodian mode active but Stripe couldn't charge your card — update the payment via the Stripe portal below before the grace period ends.",
    activeNoTier:
      "Marc accepted your project and is sizing it. You'll see the price and a Pay button here when he's done — by email too.",
    activeTier0:
      'Marc redirected you to a pattern/template (Tier 0). Details in the thread — no payment due.',
    activeLoading: 'Marc accepted your project. Loading payment details…',
    activeTier1Unpaid: 'Marc accepted at Tier 1 (≈ $300). Pay below to start the build.',
    activeTier1Paid:
      "Tier 1 paid. Marc is starting. Build updates appear in the timeline below — you'll also get an email at key steps.",
    activeTier2NoDeposit:
      'Marc accepted at Tier 2 (≈ $1500, paid in two halves). Pay the $750 deposit below to start; the $750 balance is due at delivery.',
    activeTier2DepositOnly:
      'Tier 2 deposit received — Marc is starting. The final balance ($750) is due at delivery; you can clear it earlier if you want.',
    activeTier2Cleared:
      "Tier 2 fully paid. Marc is wrapping up. Delivery is coming — you'll be notified by email.",
    activeTier3PendingQuote:
      'Marc accepted at Tier 3 — he posts the exact amount in the thread below (and emails you) within 72h.',
    activeTier3Quoted:
      'Marc posted his Tier 3 quote. Pay below to start; ask questions in the thread.',
    activeTier3Paid: 'Tier 3 paid. Marc is starting. Build updates appear in the timeline below.',
  },
} as const
