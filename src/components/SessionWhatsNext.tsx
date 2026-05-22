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
  // detail. Only post-decision status gets a strip.
  if (session.status === 'shipped') {
    const ackedAllYours = session.all_yours_acknowledged_at !== null
    const custActive = summary?.custodianStatus === 'active'
    const custPastDue = summary?.custodianStatus === 'past_due'
    if (custActive) return <Frame tone="ok">{t.shippedCustodianActive}</Frame>
    if (custPastDue) return <Frame tone="cta">{t.shippedCustodianPastDue}</Frame>
    if (ackedAllYours) return <Frame tone="ok">{t.shippedAllYoursAcked}</Frame>
    return null
  }

  // Active: branch on the server-computed build summary.
  const tier = session.tier
  if (tier === null) return <Frame tone="info">{t.activeNoTier}</Frame>
  if (tier === 0) return <Frame tone="info">{t.activeTier0}</Frame>
  if (!summary || !summary.build) return <Frame tone="info">{t.activeLoading}</Frame>

  const b = summary.build
  if (b.quotePending) return <Frame tone="info">{t.activeQuotePending}</Frame>
  if (b.nextIndex == null) return <Frame tone="ok">{t.activePaid}</Frame>
  if (b.paidCount === 0) return <Frame tone="cta">{t.activeUnpaid(b.installmentCount)}</Frame>
  return <Frame tone="ok">{t.activePartlyPaid(b.paidCount, b.installmentCount)}</Frame>
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
    activeQuotePending:
      'Marc a accepté ton projet en Tier 4 — il poste le devis dans le fil ci-dessous (et te ping par courriel) sous 72 h.',
    activeUnpaid: (of: number) =>
      of > 1
        ? 'Marc a accepté ton projet. Paie le premier versement ci-dessous pour démarrer.'
        : 'Marc a accepté ton projet. Paie ci-dessous pour démarrer.',
    activePartlyPaid: (paid: number, of: number) =>
      `Versement ${paid} sur ${of} payé — Marc avance le build. Le prochain est disponible ci-dessous quand tu veux.`,
    activePaid:
      'Projet entièrement payé. Marc finalise. La livraison arrive — tu seras notifié par courriel.',
  },
  en: {
    triagePlain:
      "Marc is reading your intake and will reply — yes, no, or 'tell me more' — by email and in the thread.",
    triageWithSla: (w: string) =>
      `Marc replies ${w} — yes, no, or 'tell me more'. You'll also get an email when it's posted.`,
    slaOverdue: 'soon (a bit overdue)',
    rejected:
      'Marc declined this session — the reason is in the thread. You can open a new proposal anytime.',
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
    activeQuotePending:
      'Marc accepted your Tier 4 project — he posts the quote in the thread below (and emails you) within 72h.',
    activeUnpaid: (of: number) =>
      of > 1
        ? 'Marc accepted your project. Pay the first installment below to start the build.'
        : 'Marc accepted your project. Pay below to start the build.',
    activePartlyPaid: (paid: number, of: number) =>
      `Installment ${paid} of ${of} paid — Marc is building. The next one is live below when you're ready.`,
    activePaid:
      "Project fully paid. Marc is wrapping up. Delivery is coming — you'll be notified by email.",
  },
} as const
