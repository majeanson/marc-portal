/**
 * /admin/equipe — surface kept for the (frozen) feat-buyer-admin scenario
 * where a buyer who installs the portal would need per-tenant team
 * invitations. For Marc's own tenant — the only operationally live one —
 * this is a solo practice and team management is intentionally NOT on the
 * roadmap.
 *
 * Previous copy said "arrive bientôt" / "coming soon" which was a false
 * promise: vision is solo practice, not a SaaS team product. Rewritten to
 * surface the actual posture honestly so Marc-or-a-buyer landing here gets
 * the truth and a single owner row.
 */

import type { Lang } from '../i18n'
import { useTenant } from '../lib/tenantContext'
import { useAuth } from '../lib/authContext'

const COPY = {
  fr: {
    eyebrow: 'équipe',
    title: 'Membres',
    sub: 'Cabinet solo. La gestion d’équipe n’est pas prévue — un seul opérateur, le propriétaire, suffit au modèle du portail.',
    owner: 'Propriétaire',
    posture: 'Modèle solo',
    postureBody:
      'Aucune invitation, aucun rôle, aucun partage de compte. Si tu as besoin que quelqu’un voie une session, ouvre-lui simplement la session via un lien magique sur son propre courriel — pas de notion d’équipe interne.',
  },
  en: {
    eyebrow: 'team',
    title: 'Members',
    sub: 'Solo practice. Team management is intentionally not planned — a single operator, the owner, fits the portal model.',
    owner: 'Owner',
    posture: 'Solo model',
    postureBody:
      'No invitations, no roles, no shared accounts. If someone needs to see a session, simply open it for them via a magic link on their own email — there is no internal team concept.',
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

      <section className="admin-block">
        <h2>{t.posture}</h2>
        <p>{t.postureBody}</p>
        {tenant && (
          <p className="admin-meta mono">
            tenant: {tenant.slug} · template: {tenant.templateId}@{tenant.templateVersion}
          </p>
        )}
      </section>
    </div>
  )
}
