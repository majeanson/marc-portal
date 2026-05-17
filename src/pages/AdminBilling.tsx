/**
 * /admin/facturation — buyer-admin scaffolding surface.
 *
 * The buyer-admin tree (Fleet, Team, Billing) is hidden from the operator
 * sidebar but routes still resolve for direct-URL access. The visitor-facing
 * payment surface lives on /me via PaymentActions — that is the real billing
 * UI. This page just acknowledges that and points there, so a stray landing
 * does not show a false "Stripe coming soon" promise.
 */

import type { Lang } from '../i18n'
import { useTenant } from '../lib/tenantContext'

const COPY = {
  fr: {
    eyebrow: 'facturation',
    title: 'Plan & paiements',
    sub: 'Cette section fait partie de la maquette buyer-admin (multi-locataire), qui est gelée pour le moment. La facturation réelle des engagements vit ailleurs.',
    plan: 'Plan',
    placeholderPlan: 'À déterminer',
    realLeadHeading: 'Où se trouve la facturation réelle',
    realLeadBody:
      'Pour ton projet, le paiement (dépôt Tier 1/2, solde Tier 2, abonnement mode dépositaire) se fait directement depuis ta page personnelle — chaque session porte ses propres boutons de paiement et son statut.',
    realLeadCta: 'Ouvrir /me →',
  },
  en: {
    eyebrow: 'billing',
    title: 'Plan & payments',
    sub: 'This page belongs to the buyer-admin scaffolding (multi-tenant), which is currently frozen. The real engagement billing lives elsewhere.',
    plan: 'Plan',
    placeholderPlan: 'TBD',
    realLeadHeading: 'Where real billing happens',
    realLeadBody:
      'For your project, payment (Tier 1/2 deposit, Tier 2 final balance, custodian-mode subscription) happens directly on your personal page — each session carries its own payment buttons and status.',
    realLeadCta: 'Open /me →',
  },
} as const

export function AdminBilling({ lang }: { lang: Lang }) {
  const t = COPY[lang]
  const { tenant } = useTenant()
  const meHref = lang === 'en' ? '/en/me' : '/me'

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
        </div>
      </section>

      <section className="admin-block">
        <h2>{t.realLeadHeading}</h2>
        <p>{t.realLeadBody}</p>
        <p>
          <a className="link-btn" href={meHref}>
            {t.realLeadCta}
          </a>
        </p>
      </section>
    </div>
  )
}
