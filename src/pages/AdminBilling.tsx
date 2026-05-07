/**
 * /admin/facturation — buyer-facing billing.
 *
 * Stub. Real implementation: feat-billing-stripe (TBD) wires Stripe Checkout
 * + Customer Portal so buyers can update payment method, see invoice history,
 * cancel. For Phase 1 (manual billing), this page just shows the plan + the
 * "contact us via support session" path.
 */

import type { Lang } from '../i18n'
import { useTenant } from '../lib/tenantContext'

const COPY = {
  fr: {
    eyebrow: 'facturation',
    title: 'Plan & paiements',
    sub: 'Voici l’état de ton plan, les prochaines factures, et l’historique de paiement.',
    plan: 'Plan',
    next: 'Prochaine facture',
    soon: 'Stripe arrive bientôt',
    soonBody:
      'D’ici là, la facturation est faite manuellement par courriel. Ouvre une session de support si tu as une question ou si tu veux changer de plan.',
    placeholderPlan: 'À déterminer',
    placeholderNext: '—',
  },
  en: {
    eyebrow: 'billing',
    title: 'Plan & payments',
    sub: 'Here’s your current plan, upcoming invoices, and payment history.',
    plan: 'Plan',
    next: 'Next invoice',
    soon: 'Stripe — coming soon',
    soonBody:
      'In the meantime, billing is handled manually by email. Open a support session if you have a question or want to change plans.',
    placeholderPlan: 'TBD',
    placeholderNext: '—',
  },
} as const

export function AdminBilling({ lang }: { lang: Lang }) {
  const t = COPY[lang]
  const { tenant } = useTenant()

  return (
    <div className="admin-page">
      <header className="admin-page__head">
        <div className="section__eyebrow">{t.eyebrow}</div>
        <h1>{t.title}</h1>
        <p>{t.sub}</p>
      </header>

      <section className="admin-block">
        <div className="billing-grid">
          <div className="billing-cell">
            <div className="billing-cell__label">{t.plan}</div>
            <div className="billing-cell__value">{tenant?.templateId ?? t.placeholderPlan}</div>
            <div className="billing-cell__sub mono">v{tenant?.templateVersion ?? '—'}</div>
          </div>
          <div className="billing-cell">
            <div className="billing-cell__label">{t.next}</div>
            <div className="billing-cell__value">{t.placeholderNext}</div>
          </div>
        </div>
      </section>

      <section className="admin-block admin-block--soon">
        <h2>{t.soon}</h2>
        <p>{t.soonBody}</p>
      </section>
    </div>
  )
}
