/**
 * Admin shell. Routes nested under /admin render through this layout.
 * Single source for the admin chrome (sidebar nav, language toggle).
 *
 * Auth check: an unsigned visitor is bounced to /login. Whether the page
 * shows operator vs buyer chrome depends on the resolved tenant's flags
 * and the signed-in user's role — handled by individual sub-routes.
 */

import { useEffect } from 'react'
import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom'
import type { Lang } from '../i18n'
import { useAuth } from '../lib/authContext'
import { useTenant } from '../lib/tenantContext'

const COPY = {
  fr: {
    titleSuffix: 'Réglages',
    appearance: 'Apparence',
    team: 'Équipe',
    billing: 'Facturation',
    fleet: 'Flotte',
    audit: 'Journal',
    showcase: 'Vitrine',
    runbook: 'Runbook',
    hub: 'Console',
    backToApp: '← Retour à l’app',
    operator: 'Opérateur',
    owner: 'Propriétaire',
    loading: 'Chargement…',
  },
  en: {
    titleSuffix: 'Settings',
    appearance: 'Appearance',
    team: 'Team',
    billing: 'Billing',
    fleet: 'Fleet',
    audit: 'Audit log',
    showcase: 'Showcase',
    runbook: 'Runbook',
    hub: 'Console',
    backToApp: '← Back to app',
    operator: 'Operator',
    owner: 'Owner',
    loading: 'Loading…',
  },
} as const

export function Admin({ lang }: { lang: Lang }) {
  const t = COPY[lang]
  const { tenant, loading: tenantLoading } = useTenant()
  const { email, loading: authLoading } = useAuth()
  const loc = useLocation()

  useEffect(() => {
    document.title = `${t.titleSuffix} — ${tenant?.displayName ?? 'Marc'}`
  }, [t, tenant])

  if (authLoading || tenantLoading) {
    return (
      <main className="page">
        <section className="page__panel">
          <p>{t.loading}</p>
        </section>
      </main>
    )
  }

  if (!email) {
    const next = encodeURIComponent(loc.pathname + loc.search)
    return <Navigate to={`${lang === 'en' ? '/en' : ''}/login?next=${next}`} replace />
  }

  const isOperator = tenant?.id === 't_marc' && tenant?.templateId === 'marc-portal'
  const langPrefix = lang === 'en' ? '/en' : ''
  const home = lang === 'en' ? '/en' : '/'

  return (
    <div className="admin">
      <aside className="admin__nav" aria-label="Admin navigation">
        <Link to={`${langPrefix}/admin`} className="admin__brand admin__brand--link">
          <div className="admin__brand-name">{tenant?.displayName ?? 'Marc'}</div>
          <div className="admin__brand-role">{isOperator ? t.operator : t.owner}</div>
        </Link>

        {/* Marketplace-shaped surfaces (Apparence, Équipe, Facturation, Flotte)
            are no longer in the sidebar — vision is solo practice, not SaaS.
            They still exist as routes for direct-URL access if Marc ever needs
            them. The audit log is the only operator-only surface kept visible.
            See feature.json analysis: "Fleet/tenant primitives exist as
            architecture for per-engagement isolation; this is not a marketplace." */}
        <nav className="admin__links">
          {isOperator && (
            <>
              <NavLink to={`${langPrefix}/admin`} end className="admin__link">
                <span className="admin__link-dot admin__link-dot--operator" /> {t.hub}
              </NavLink>
              <NavLink to={`${langPrefix}/admin/showcase`} className="admin__link">
                <span className="admin__link-dot admin__link-dot--operator" /> {t.showcase}
              </NavLink>
              <NavLink to={`${langPrefix}/admin/audit`} className="admin__link">
                <span className="admin__link-dot admin__link-dot--operator" /> {t.audit}
              </NavLink>
              <NavLink to={`${langPrefix}/admin/runbook`} className="admin__link">
                <span className="admin__link-dot admin__link-dot--operator" /> {t.runbook}
              </NavLink>
            </>
          )}
        </nav>

        <div className="admin__footer">
          <Link to={home} className="admin__back">
            {t.backToApp}
          </Link>
          <div className="admin__user">{email}</div>
        </div>
      </aside>

      <main id="main-content" className="admin__main">
        <Outlet />
      </main>
    </div>
  )
}
