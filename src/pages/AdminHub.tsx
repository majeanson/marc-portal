/**
 * Admin hub — the operator console. One scannable index of every admin
 * surface and external dashboard, grouped by purpose so Marc can land
 * here, see at a glance what state the practice is in, and click
 * through to the right tool without remembering URLs.
 *
 * Mounted as the /admin index (replacing the legacy redirect to
 * /admin/apparence which is a marketplace-shaped page that's no longer
 * surfaced in the sidebar).
 */

import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import type { Lang } from '../i18n'
import { LangPrefCard } from '../components/LangPrefCard'

const COPY = {
  fr: {
    title: 'Console',
    sub: "Tout ce qu'il faut pour piloter la pratique. Tuiles regroupées par usage.",
    sections: {
      working: 'Surfaces de travail',
      brand: 'Carte de marque',
      onboarding: 'Onboarding & vente',
      diag: 'Diagnostics',
      external: 'Tableaux externes',
    },
  },
  en: {
    title: 'Console',
    sub: 'Everything to operate the practice. Tiles grouped by use.',
    sections: {
      working: 'Working surfaces',
      brand: 'Brand check',
      onboarding: 'Onboarding & sale',
      diag: 'Diagnostics',
      external: 'External dashboards',
    },
  },
} as const

interface Tile {
  href: string
  external?: boolean
  title: string
  desc: string
  /** Tiny mono tag rendered in the corner — e.g. "live", "JSON", or
   * the raw path. Optional. */
  badge?: string
}

interface Section {
  title: string
  tiles: Tile[]
}

function buildSections(lang: Lang): Section[] {
  const langPrefix = lang === 'en' ? '/en' : ''
  const t = COPY[lang]

  if (lang === 'en') {
    return [
      {
        title: t.sections.working,
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
        ],
      },
      {
        title: t.sections.brand,
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
        title: t.sections.onboarding,
        tiles: [
          {
            href: `${langPrefix}/admin/runbook`,
            title: 'Runbook',
            desc: 'Three tracks: dev handoff, user journey under new ownership, template-as-product. Progress saved in this browser.',
            badge: '/admin/runbook',
          },
          {
            href: `${langPrefix}/template`,
            title: 'Template (public)',
            desc: 'The buyer-facing page mirroring Track C. Open this when you want to see what a template buyer sees.',
            badge: '/template',
          },
          {
            href: `${langPrefix}/admin/runbook?tab=decisions`,
            title: 'Decisions',
            desc: 'Eight strategic questions to answer before selling the template. Open answers persist locally.',
            badge: '?tab=decisions',
          },
        ],
      },
      {
        title: t.sections.diag,
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
        title: t.sections.external,
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
      title: t.sections.working,
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
      ],
    },
    {
      title: t.sections.brand,
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
      title: t.sections.onboarding,
      tiles: [
        {
          href: `${langPrefix}/admin/runbook`,
          title: 'Runbook',
          desc: 'Trois pistes : handoff dev, parcours visiteur sous nouvelle direction, template à vendre. Progression sauvée dans ce navigateur.',
          badge: '/admin/runbook',
        },
        {
          href: `${langPrefix}/template`,
          title: 'Template (public)',
          desc: 'Page acheteur miroir de Track C. À ouvrir quand tu veux voir ce qu’un acheteur du template voit.',
          badge: '/template',
        },
        {
          href: `${langPrefix}/admin/runbook?tab=decisions`,
          title: 'Décisions',
          desc: 'Huit questions stratégiques à trancher avant de vendre le template. Réponses libres persistées localement.',
          badge: '?tab=decisions',
        },
      ],
    },
    {
      title: t.sections.diag,
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
      title: t.sections.external,
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

export function AdminHub({ lang }: { lang: Lang }) {
  const t = COPY[lang]
  const sections = buildSections(lang)

  useEffect(() => {
    document.title = `${t.title} — Marc`
  }, [t])

  return (
    <article className="admin-hub">
      <header className="admin-hub__head">
        <div className="section__eyebrow">{lang === 'en' ? 'OPERATOR' : 'OPÉRATEUR'}</div>
        <h1 className="admin-hub__title">{t.title}</h1>
        <p className="admin-hub__sub">{t.sub}</p>
      </header>

      {sections.map((s) => (
        <section key={s.title} className="admin-hub__section">
          <h2 className="admin-hub__section-title mono">{s.title}</h2>
          <ul className="admin-hub__grid">
            {s.tiles.map((tile) => (
              <li key={tile.href} className="admin-hub__tile">
                {tile.external ? (
                  <a
                    className="admin-hub__tile-link"
                    href={tile.href}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <TileBody tile={tile} external />
                  </a>
                ) : (
                  <Link className="admin-hub__tile-link" to={tile.href}>
                    <TileBody tile={tile} />
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}

      <LangPrefCard lang={lang} />
    </article>
  )
}

function TileBody({ tile, external }: { tile: Tile; external?: boolean }) {
  return (
    <>
      <div className="admin-hub__tile-head">
        <h3 className="admin-hub__tile-title">{tile.title}</h3>
        {tile.badge && (
          <span className="mono admin-hub__tile-badge">
            {external ? '↗ ' : ''}
            {tile.badge}
          </span>
        )}
      </div>
      <p className="admin-hub__tile-desc">{tile.desc}</p>
    </>
  )
}
