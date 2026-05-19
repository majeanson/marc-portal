/**
 * Admin hub — the operator console. One scannable index of every admin
 * surface and external dashboard, grouped by purpose so Marc can land
 * here, see at a glance what state the practice is in, and click
 * through to the right tool without remembering URLs.
 *
 * Mounted as the /admin index (replacing the legacy redirect to
 * /admin/apparence which is a marketplace-shaped page that's no longer
 * surfaced in the sidebar).
 *
 * Section definitions live in src/lib/admin/hubSections.ts so the /carte
 * map's Admin layer can render the same grouped tile structure.
 */

import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import type { Lang } from '../i18n'
import { LangPrefCard } from '../components/LangPrefCard'
import { buildAdminSections, type AdminTile } from '../lib/admin/hubSections'

const COPY = {
  fr: {
    title: 'Console',
    sub: "Tout ce qu'il faut pour piloter la pratique. Tuiles regroupées par usage.",
  },
  en: {
    title: 'Console',
    sub: 'Everything to operate the practice. Tiles grouped by use.',
  },
} as const

export function AdminHub({ lang }: { lang: Lang }) {
  const t = COPY[lang]
  const sections = buildAdminSections(lang)

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

function TileBody({ tile, external }: { tile: AdminTile; external?: boolean }) {
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
