/**
 * Admin hub section definitions — lifted out of AdminHub.tsx so the
 * /carte map's Admin layer can render the same grouped tile structure
 * without forking the labels. AdminHub.tsx is the only other consumer;
 * if either surface needs to diverge, fork at the call site, not here.
 */

import type { Lang } from '../../i18n'

export interface AdminTile {
  href: string
  external?: boolean
  title: string
  desc: string
  /** Tiny mono tag rendered in the corner — e.g. "live", "JSON", or
   * the raw path. Optional. */
  badge?: string
}

export interface AdminSection {
  title: string
  tiles: AdminTile[]
}

const SECTION_LABELS = {
  fr: {
    working: 'Surfaces de travail',
    brand: 'Carte de marque',
    diag: 'Diagnostics',
    external: 'Tableaux externes',
  },
  en: {
    working: 'Working surfaces',
    brand: 'Brand check',
    diag: 'Diagnostics',
    external: 'External dashboards',
  },
} as const

export function buildAdminSections(lang: Lang): AdminSection[] {
  const langPrefix = lang === 'en' ? '/en' : ''
  const t = SECTION_LABELS[lang]

  if (lang === 'en') {
    return [
      {
        title: t.working,
        tiles: [
          {
            href: `${langPrefix}/admin/inbox`,
            title: 'Inbox',
            desc: 'Live sessions, triage, replies. The primary working surface.',
            badge: '/admin/inbox',
          },
          {
            href: `${langPrefix}/admin/trash`,
            title: 'Trash',
            desc: 'Soft-deleted sessions. Restore or hard-delete from here.',
            badge: '/admin/trash',
          },
          {
            href: `${langPrefix}/admin/custodians`,
            title: 'Custodians',
            desc: 'Active "I handle it" subscriptions, past-due failures, ended/switched history. MRR at a glance.',
            badge: '/admin/custodians',
          },
          {
            href: `${langPrefix}/admin/vouches`,
            title: 'Vouches',
            desc: 'Moderation queue for visitor-submitted testimonials. Approve, reject, edit, soft-delete.',
            badge: '/admin/vouches',
          },
          {
            href: `${langPrefix}/admin/runbook`,
            title: 'Runbook',
            desc: 'Two-track operator memory: dev-handoff steps in parallel with the user journey they unblock. Progress saved in this browser.',
            badge: '/admin/runbook',
          },
          {
            href: `${langPrefix}/map`,
            title: 'Map',
            desc: 'Layered atlas of every route, data path, journey, and admin surface. Public view shows visitor surfaces; preview-as-visitor toggle in the legend.',
            badge: '/map',
          },
        ],
      },
      {
        title: t.brand,
        tiles: [
          {
            href: `${langPrefix}/admin/showcase`,
            title: 'Showcase grid',
            desc: 'Live OG cards for every showcased project + the home card. Brand-check before sharing.',
            badge: 'live',
          },
          {
            href: '/og/home?lang=en',
            external: true,
            title: 'Home OG preview',
            desc: 'Open the live home unfurl PNG in a new tab. ?debug=1 for the JSON payload.',
            badge: '/og/home',
          },
        ],
      },
      {
        title: t.diag,
        tiles: [
          {
            href: `${langPrefix}/admin/audit`,
            title: 'Audit log',
            desc: 'Operator actions over time. Surfaces tech-debt drift and incident timelines.',
            badge: '/admin/audit',
          },
          {
            href: '/og/ping?fonts=1',
            external: true,
            title: 'OG font health',
            desc: 'JSON probe of the OG renderer’s font assets. 200 = all good, 503 = something to fix.',
            badge: 'JSON',
          },
          {
            href: '/sitemap.xml',
            external: true,
            title: 'Sitemap',
            desc: 'What crawlers see. Auto-built at deploy by scripts/build-sitemap.mjs.',
            badge: 'XML',
          },
        ],
      },
      {
        title: t.external,
        tiles: [
          {
            href: 'https://sentry.io/organizations/marc-portal/issues/',
            external: true,
            title: 'Sentry',
            desc: 'Errors and incidents from the SPA + Pages Functions. PII-stripped per the Loi 25 PIA.',
            badge: 'sentry.io',
          },
          {
            href: 'https://dash.cloudflare.com/?to=/:account/pages/view/marc-portal',
            external: true,
            title: 'Cloudflare Pages',
            desc: 'Build history, env, custom domains, D1 binding.',
            badge: 'dash.cloudflare.com',
          },
          {
            href: 'https://github.com/majeanson/marc-portal',
            external: true,
            title: 'GitHub repo',
            desc: 'Source, issues, CI runs.',
            badge: 'github.com',
          },
        ],
      },
    ]
  }

  // FR mirror
  return [
    {
      title: t.working,
      tiles: [
        {
          href: `${langPrefix}/admin/inbox`,
          title: 'Boîte de réception',
          desc: 'Sessions en cours, triage, réponses. Surface de travail principale.',
          badge: '/admin/inbox',
        },
        {
          href: `${langPrefix}/admin/trash`,
          title: 'Corbeille',
          desc: 'Sessions supprimées (soft-delete). Restaure ou supprime définitivement.',
          badge: '/admin/trash',
        },
        {
          href: `${langPrefix}/admin/custodians`,
          title: 'Dépositaires',
          desc: 'Abonnements « Je m’en occupe » actifs, paiements en retard, historique des bascules. MRR d’un coup d’œil.',
          badge: '/admin/custodians',
        },
        {
          href: `${langPrefix}/admin/vouches`,
          title: 'Témoignages',
          desc: 'File de modération des témoignages visiteurs. Approuver, rejeter, éditer, supprimer.',
          badge: '/admin/vouches',
        },
        {
          href: `${langPrefix}/admin/runbook`,
          title: 'Runbook',
          desc: 'Mémoire opérateur en deux pistes : étapes de handoff dev en parallèle avec le parcours visiteur qu’elles débloquent. Progression sauvée dans ce navigateur.',
          badge: '/admin/runbook',
        },
        {
          href: `${langPrefix}/carte`,
          title: 'Carte',
          desc: 'Atlas en couches de chaque route, flux de données, parcours et surface admin. La vue publique montre les surfaces visiteur ; bascule « voir comme visiteur » dans la légende.',
          badge: '/carte',
        },
      ],
    },
    {
      title: t.brand,
      tiles: [
        {
          href: `${langPrefix}/admin/showcase`,
          title: 'Grille vitrine',
          desc: 'Cartes OG en direct pour chaque projet + la carte d’accueil. Vérification de marque avant partage.',
          badge: 'live',
        },
        {
          href: '/og/home',
          external: true,
          title: 'Aperçu OG accueil',
          desc: 'Ouvre la PNG d’accueil dans un nouvel onglet. ?debug=1 pour le JSON.',
          badge: '/og/home',
        },
      ],
    },
    {
      title: t.diag,
      tiles: [
        {
          href: `${langPrefix}/admin/audit`,
          title: 'Journal',
          desc: 'Actions opérateur dans le temps. Met en évidence la dette technique et la chronologie des incidents.',
          badge: '/admin/audit',
        },
        {
          href: '/og/ping?fonts=1',
          external: true,
          title: 'Santé des polices OG',
          desc: 'Sonde JSON des polices du moteur OG. 200 = OK, 503 = à corriger.',
          badge: 'JSON',
        },
        {
          href: '/sitemap.xml',
          external: true,
          title: 'Sitemap',
          desc: 'Ce que voient les crawlers. Auto-généré au déploiement (scripts/build-sitemap.mjs).',
          badge: 'XML',
        },
      ],
    },
    {
      title: t.external,
      tiles: [
        {
          href: 'https://sentry.io/organizations/marc-portal/issues/',
          external: true,
          title: 'Sentry',
          desc: 'Erreurs et incidents (SPA + Pages Functions). PII retirée selon le PIA Loi 25.',
          badge: 'sentry.io',
        },
        {
          href: 'https://dash.cloudflare.com/?to=/:account/pages/view/marc-portal',
          external: true,
          title: 'Cloudflare Pages',
          desc: 'Historique des builds, env, domaines, binding D1.',
          badge: 'dash.cloudflare.com',
        },
        {
          href: 'https://github.com/majeanson/marc-portal',
          external: true,
          title: 'Dépôt GitHub',
          desc: 'Source, issues, runs CI.',
          badge: 'github.com',
        },
      ],
    },
  ]
}
