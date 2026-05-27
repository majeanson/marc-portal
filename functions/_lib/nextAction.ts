// Per-session "what should I do next?" inference for /admin/today.
//
// The single-operator capacity cap means there's never more than ~2 live
// sessions to think about. The friction isn't volume — it's reconstructing
// state after a few days off ("where did this one land?"). This helper
// answers that in one line by walking the session state, the payments
// rows, and the last visitor/operator messages.
//
// Pure function — given the inputs, the output is deterministic. The
// /admin/today aggregator calls it once per live session; the same logic
// powers the dashboard's "next action" pill and would be the natural
// place to drive future automation (push-notify Marc when an urgent
// action lands, etc.).
//
// Severity vocabulary:
//   - 'urgent' — someone is waiting on Marc *now* (overdue SLA, message
//     unanswered > 24h, past-due custodian charge, missing tier/quote).
//   - 'warn'   — action is needed soon but not blocking anyone.
//   - 'info'   — a nudge worth noticing; not action-required.
//   - 'muted'  — no action; surfaced for completeness.
//
// Adding a new label: extend NextActionCode, add a branch in inferNextAction
// keeping precedence (earlier branches win), and extend LABELS / HINTS with
// FR + EN copy. The dashboard renders by code, so a new label flows through
// automatically.

import type { SessionRow } from './sessions'

export type NextActionCode =
  | 'rejected'
  | 'shipped_done'
  | 'shipped_handoff_pending'
  | 'custodian_past_due'
  | 'reply_overdue'
  | 'tier_missing'
  | 'tier4_quote_missing'
  | 'installment_unpaid'
  | 'check_in_due'
  | 'ready_to_start'
  | 'triage_overdue'
  | 'triage_pending'
  | 'draft_stalled'
  | 'ok'

export type NextActionSeverity = 'urgent' | 'warn' | 'info' | 'muted'

export interface NextAction {
  code: NextActionCode
  severity: NextActionSeverity
  label_fr: string
  label_en: string
  hint_fr: string
  hint_en: string
}

export interface NextActionContext {
  /** unix seconds — "now". Caller passes Date.now()/1000 floored. */
  nowS: number
  /** most recent visitor message timestamp (unix seconds), or null. */
  lastVisitorMessageAtS: number | null
  /** most recent operator (Marc) message timestamp (unix seconds), or null. */
  lastMarcMessageAtS: number | null
  /** count of build-kind payments with status='paid'. */
  paidBuildLegs: number
  /** count of build-kind payments with status='pending' that are >7 days old.
   *  These are visitor-initiated checkouts that never completed — different
   *  from a freshly minted leg the visitor just hasn't paid yet. */
  stalePendingBuildLegs: number
  /** unix seconds when the session last moved into its current status, or
   *  null if no status_history (the row has never transitioned, which means
   *  it's still in `draft`). Reads from statusHistory's last entry on the
   *  caller side so this stays pure-data. */
  statusEnteredAtS: number | null
}

// Thresholds. Kept named (not magic numbers) so a future tweak ("OK, 36h
// not 24h for reply-overdue") is one-line and self-documenting.
const ONE_DAY_S = 24 * 3600
const TRIAGE_OVERDUE_S = 48 * 3600
const DRAFT_STALLED_S = 12 * 3600
const REPLY_OVERDUE_S = 24 * 3600
const INSTALLMENT_NUDGE_S = 7 * ONE_DAY_S
const CHECK_IN_DUE_S = 14 * ONE_DAY_S

const LABELS: Record<NextActionCode, { fr: string; en: string }> = {
  rejected: { fr: 'Refusé', en: 'Declined' },
  shipped_done: { fr: 'Livré', en: 'Shipped' },
  shipped_handoff_pending: { fr: 'Mode de garde à choisir', en: 'Handoff mode to pick' },
  custodian_past_due: { fr: 'Dépositaire en retard', en: 'Custodian past due' },
  reply_overdue: { fr: 'Répondre', en: 'Reply' },
  tier_missing: { fr: 'Classer le tier', en: 'Set tier' },
  tier4_quote_missing: { fr: 'Envoyer le devis', en: 'Send Tier 4 quote' },
  installment_unpaid: { fr: 'Relancer le paiement', en: 'Nudge payment' },
  check_in_due: { fr: 'Donner des nouvelles', en: 'Check in' },
  ready_to_start: { fr: 'Démarrer', en: 'Start the build' },
  triage_overdue: { fr: 'Triage en retard', en: 'Triage overdue' },
  triage_pending: { fr: 'Trier', en: 'Triage' },
  draft_stalled: { fr: 'Intake commencé', en: 'Intake started' },
  ok: { fr: 'Rien à faire', en: 'Nothing to do' },
}

const HINTS: Record<NextActionCode, { fr: string; en: string }> = {
  rejected: {
    fr: 'Marc a refusé. Pas d’action.',
    en: 'Declined. No action.',
  },
  shipped_done: {
    fr: 'Livré. Garde + mode sont réglés.',
    en: 'Shipped. Custodian + handoff are settled.',
  },
  shipped_handoff_pending: {
    fr: 'Le visiteur n’a pas choisi entre dépositaire et « tout à toi ».',
    en: 'Visitor has not chosen between custodian and "all yours".',
  },
  custodian_past_due: {
    fr: 'Stripe ne réussit pas à charger la carte. Contacter le visiteur avant que le système bascule en « tout à toi ».',
    en: 'Stripe can’t charge the card. Contact the visitor before the auto-switch to "all yours" fires.',
  },
  reply_overdue: {
    fr: 'Le visiteur a écrit il y a plus de 24h sans réponse.',
    en: 'Visitor wrote more than 24h ago and is still waiting.',
  },
  tier_missing: {
    fr: 'Active sans tier. Le visiteur ne peut pas payer tant que ce n’est pas classé.',
    en: 'Active without a tier. The visitor can’t pay until you classify.',
  },
  tier4_quote_missing: {
    fr: 'Tier 4 sans devis. Le bouton « payer » reste désactivé tant que le montant n’est pas saisi.',
    en: 'Tier 4 without a quote. The Pay button stays disabled until you set the amount.',
  },
  installment_unpaid: {
    fr: 'Plus de 7 jours depuis le tier sans premier paiement.',
    en: 'More than 7 days since tier was set without a first payment.',
  },
  check_in_due: {
    fr: 'Pas de message dans la session depuis plus de 14 jours. Un mot rapide.',
    en: 'No message in the session for more than 14 days. A quick note.',
  },
  ready_to_start: {
    fr: 'Le visiteur a payé. Promouvoir en actif et embarquer.',
    en: 'Visitor has paid. Promote to active and get rolling.',
  },
  triage_overdue: {
    fr: 'En triage depuis plus de 48h. SLA visiteur dépassé.',
    en: 'In triage for more than 48h. Visitor SLA missed.',
  },
  triage_pending: {
    fr: 'Lire l’intake, fixer le tier ou refuser.',
    en: 'Read the intake, set the tier or decline.',
  },
  draft_stalled: {
    fr: 'Le visiteur a commencé l’intake mais n’a pas envoyé.',
    en: 'Visitor started the intake but didn’t submit.',
  },
  ok: {
    fr: 'Tout est à jour de ton côté.',
    en: 'Nothing waiting on you.',
  },
}

const SEVERITY: Record<NextActionCode, NextActionSeverity> = {
  rejected: 'muted',
  shipped_done: 'muted',
  shipped_handoff_pending: 'warn',
  custodian_past_due: 'urgent',
  reply_overdue: 'urgent',
  tier_missing: 'urgent',
  tier4_quote_missing: 'urgent',
  installment_unpaid: 'warn',
  check_in_due: 'warn',
  ready_to_start: 'urgent',
  triage_overdue: 'urgent',
  triage_pending: 'warn',
  draft_stalled: 'info',
  ok: 'muted',
}

function build(code: NextActionCode): NextAction {
  return {
    code,
    severity: SEVERITY[code],
    label_fr: LABELS[code].fr,
    label_en: LABELS[code].en,
    hint_fr: HINTS[code].fr,
    hint_en: HINTS[code].en,
  }
}

/**
 * Pick the single "next action" label for a session. Earlier branches win,
 * so urgent visitor-facing issues outrank lower-priority ops follow-ups.
 *
 * Caller is responsible for computing the payment/message inputs — this
 * helper takes them as data so it stays pure and trivially testable.
 */
export function inferNextAction(session: SessionRow, ctx: NextActionContext): NextAction {
  // Terminal: rejected sessions need no action. Surfaced for completeness
  // (so the row still renders) but the dashboard can collapse them.
  if (session.status === 'rejected') return build('rejected')

  // Past-due custodian is the most time-critical signal across any status:
  // Stripe is actively retrying a failed charge, and after enough retries
  // the system flips the visitor to switched_to_tout_a_toi (per the Handoff
  // promise). A quick personal nudge is much better than a silent flip.
  if (session.custodian_status === 'past_due') return build('custodian_past_due')

  if (session.status === 'shipped') {
    // The "handoff mode to pick" window is bounded: after 30 days without a
    // decision, AdminInbox stops nagging about it (matches existing
    // shipped_no_mode bucket logic), so we mirror that here.
    const noCustodianDecision =
      (session.custodian_status === null || session.custodian_status === 'none') &&
      session.all_yours_acknowledged_at === null
    const within30d = ctx.nowS - session.updated_at < 30 * ONE_DAY_S
    if (noCustodianDecision && within30d) return build('shipped_handoff_pending')
    return build('shipped_done')
  }

  // Active: reply-overdue takes precedence over the structural classifier
  // gaps (tier/quote) because a waiting visitor sees the silence before
  // they discover they can't pay.
  if (session.status === 'active') {
    if (
      ctx.lastVisitorMessageAtS !== null &&
      (ctx.lastMarcMessageAtS === null || ctx.lastMarcMessageAtS < ctx.lastVisitorMessageAtS) &&
      ctx.nowS - ctx.lastVisitorMessageAtS > REPLY_OVERDUE_S
    ) {
      return build('reply_overdue')
    }
    if (session.tier === null) return build('tier_missing')
    if (session.tier === 4 && session.tier4_amount_cents === null) {
      return build('tier4_quote_missing')
    }
    // Installment nudge: tier is set, time has passed, no leg paid yet.
    // statusEnteredAtS is the closest proxy for "tier-set time" without a
    // dedicated tier_assigned_at column. If status_history is missing this
    // collapses to a no-op (we only nudge when we know the clock).
    if (
      ctx.paidBuildLegs === 0 &&
      ctx.statusEnteredAtS !== null &&
      ctx.nowS - ctx.statusEnteredAtS > INSTALLMENT_NUDGE_S
    ) {
      return build('installment_unpaid')
    }
    // Check-in due: build is underway, no one's said anything in 14 days.
    const lastAnyMessageAtS = Math.max(ctx.lastVisitorMessageAtS ?? 0, ctx.lastMarcMessageAtS ?? 0)
    if (lastAnyMessageAtS > 0 && ctx.nowS - lastAnyMessageAtS > CHECK_IN_DUE_S) {
      return build('check_in_due')
    }
    return build('ok')
  }

  if (session.status === 'triage') {
    // Visitor has paid a build leg but the session is still in triage. This is
    // the strongest "act now" signal in the system — payment landed without
    // a corresponding promotion, so the operator must move it to 'active' to
    // start work. Outranks the age-based overdue/pending classifiers because
    // a paid-but-unpromoted session is more urgent than a fresh-and-unread
    // triage.
    if (ctx.paidBuildLegs > 0) return build('ready_to_start')
    const ageS = ctx.nowS - session.created_at
    return ageS > TRIAGE_OVERDUE_S ? build('triage_overdue') : build('triage_pending')
  }

  // Draft: visitor opened an intake-session but never submitted. If it's
  // been sitting around (>12h) it's worth a soft "did your form save?"
  // nudge by email. Below the threshold we don't surface it.
  if (session.status === 'draft') {
    const ageS = ctx.nowS - session.updated_at
    return ageS > DRAFT_STALLED_S ? build('draft_stalled') : build('ok')
  }

  return build('ok')
}
