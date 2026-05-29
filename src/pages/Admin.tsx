/**
 * Admin shell. Routes nested under /admin render through this layout.
 * Single source for the admin chrome (sidebar nav, language toggle).
 *
 * Auth check: an unsigned visitor is bounced to /login. Whether the page
 * shows operator vs buyer chrome depends on the resolved tenant's flags
 * and the signed-in user's role — handled by individual sub-routes.
 */

import { useEffect, useState } from 'react'
import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom'
import type { Lang } from '../i18n'
import { useAuth } from '../lib/authContext'
import { useTenant } from '../lib/tenantContext'
import { Surface } from '../components/Surface'

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
    today: 'Aujourd’hui',
    hub: 'Console',
    backToApp: '← Retour à l’app',
    operator: 'Opérateur',
    owner: 'Propriétaire',
    loading: 'Chargement…',
    menuOpen: 'Menu ↓',
    menuClose: 'Menu ↑',
    menuAria: 'Ouvrir le menu admin',
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
    today: 'Today',
    hub: 'Console',
    backToApp: '← Back to app',
    operator: 'Operator',
    owner: 'Owner',
    loading: 'Loading…',
    menuOpen: 'Menu ↓',
    menuClose: 'Menu ↑',
    menuAria: 'Open admin menu',
  },
} as const

export function Admin({ lang }: { lang: Lang }) {
  const t = COPY[lang]
  const { tenant, loading: tenantLoading } = useTenant()
  const { email, loading: authLoading } = useAuth()
  const loc = useLocation()
  // Mobile-only: collapse the nav by default so the link list + footer
  // don't eat half the viewport above the actual content. Desktop ignores
  // this via CSS — the toggle button is `display: none` past 800px and
  // the links/footer are always visible. The nav body itself listens for
  // clicks and closes (event delegation) so tapping a NavLink navigates
  // the visitor INTO the page instead of leaving them looking at the
  // still-expanded menu.
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const closeMobileNav = () => setMobileNavOpen(false)

  useEffect(() => {
    document.title = `${t.titleSuffix} — ${tenant?.displayName ?? 'Marc'}`
  }, [t, tenant])

  if (authLoading || tenantLoading) {
    return (
      <main className="page">
        <Surface as="section" className="page__panel">
          <p>{t.loading}</p>
        </Surface>
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
      <aside
        className={`admin__nav${mobileNavOpen ? ' admin__nav--open' : ''}`}
        aria-label="Admin navigation"
      >
        <div className="admin__nav-bar">
          <Link to={`${langPrefix}/admin`} className="admin__brand admin__brand--link">
            <div className="admin__brand-name">{tenant?.displayName ?? 'Marc'}</div>
            <div className="admin__brand-role">{isOperator ? t.operator : t.owner}</div>
          </Link>
          <button
            type="button"
            className="admin__nav-toggle mono"
            onClick={() => setMobileNavOpen((v) => !v)}
            aria-expanded={mobileNavOpen}
            aria-controls="admin-nav-body"
            aria-label={t.menuAria}
          >
            {mobileNavOpen ? t.menuClose : t.menuOpen}
          </button>
        </div>
        <div id="admin-nav-body" className="admin__nav-body">
          {/* Marketplace-shaped surfaces (Apparence, Équipe, Facturation, Flotte)
            are no longer in the sidebar — vision is solo practice, not SaaS.
            They still exist as routes for direct-URL access if Marc ever needs
            them. The audit log is the only operator-only surface kept visible.
            See feature.json analysis: "Fleet/tenant primitives exist as
            architecture for per-engagement isolation; this is not a marketplace." */}
          <nav className="admin__links">
            {isOperator && (
              <>
                <NavLink
                  to={`${langPrefix}/admin`}
                  end
                  className="admin__link"
                  onClick={closeMobileNav}
                >
                  <span className="admin__link-dot admin__link-dot--operator" /> {t.hub}
                </NavLink>
                <NavLink
                  to={`${langPrefix}/admin/today`}
                  className="admin__link"
                  onClick={closeMobileNav}
                >
                  <span className="admin__link-dot admin__link-dot--operator" /> {t.today}
                </NavLink>
                <NavLink
                  to={`${langPrefix}/admin/showcase`}
                  className="admin__link"
                  onClick={closeMobileNav}
                >
                  <span className="admin__link-dot admin__link-dot--operator" /> {t.showcase}
                </NavLink>
                <NavLink
                  to={`${langPrefix}/admin/audit`}
                  className="admin__link"
                  onClick={closeMobileNav}
                >
                  <span className="admin__link-dot admin__link-dot--operator" /> {t.audit}
                </NavLink>
                <NavLink
                  to={`${langPrefix}/admin/runbook`}
                  className="admin__link"
                  onClick={closeMobileNav}
                >
                  <span className="admin__link-dot admin__link-dot--operator" /> {t.runbook}
                </NavLink>
              </>
            )}
          </nav>

          <div className="admin__footer">
            <Link to={home} className="admin__back" onClick={closeMobileNav}>
              {t.backToApp}
            </Link>
            <div className="admin__user">{email}</div>
          </div>
        </div>
      </aside>

      <main id="main-content" className="admin__main">
        <Outlet />
      </main>
    </div>
  )
}
