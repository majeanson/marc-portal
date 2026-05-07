/**
 * /admin/equipe — buyer-facing team management.
 *
 * Stub. Real implementation lives in feat-buyer-admin (feat-2026-020) and
 * needs: invite by email, role per member (owner / admin / member), revoke,
 * list pending invites. For now the UI shows the owner alone with a "coming
 * soon" rail.
 */

import type { Lang } from '../i18n'
import { useTenant } from '../lib/tenantContext'
import { useAuth } from '../lib/authContext'

const COPY = {
  fr: {
    eyebrow: 'équipe',
    title: 'Membres de l’équipe',
    sub: 'Invite tes collègues à utiliser l’app. Chacun a son propre lien magique de connexion.',
    owner: 'Propriétaire',
    soon: 'Invitations à venir',
    soonBody:
      'La gestion d’équipe complète arrive bientôt — invitations par courriel, rôles, révocation. Pour l’instant, contacte-nous via une session si tu veux ajouter quelqu’un.',
  },
  en: {
    eyebrow: 'team',
    title: 'Team members',
    sub: 'Invite your colleagues to use the app. Each gets their own magic-link sign-in.',
    owner: 'Owner',
    soon: 'Invitations — coming soon',
    soonBody:
      'Full team management is on the way — email invitations, roles, revocation. For now, reach out via a support session if you need to add someone.',
  },
} as const

export function AdminTeam({ lang }: { lang: Lang }) {
  const t = COPY[lang]
  const { tenant } = useTenant()
  const { email } = useAuth()

  return (
    <div className="admin-page">
      <header className="admin-page__head">
        <div className="section__eyebrow">{t.eyebrow}</div>
        <h1>{t.title}</h1>
        <p>{t.sub}</p>
      </header>

      <section className="admin-block">
        <ul className="team-list">
          <li className="team-list__item">
            <div className="team-list__avatar">{(email ?? '?').charAt(0).toUpperCase()}</div>
            <div className="team-list__meta">
              <div className="team-list__name">{email}</div>
              <div className="team-list__role">{t.owner}</div>
            </div>
          </li>
        </ul>
      </section>

      <section className="admin-block admin-block--soon">
        <h2>{t.soon}</h2>
        <p>{t.soonBody}</p>
        {tenant && (
          <p className="admin-meta mono">
            tenant: {tenant.slug} · template: {tenant.templateId}@{tenant.templateVersion}
          </p>
        )}
      </section>
    </div>
  )
}
