/**
 * Admin layer — mirrors the AdminHub tile grid by reading from the same
 * buildAdminSections() helper. Two views:
 *
 *  - admin viewer → full sections + tiles (visually consistent with
 *    /admin so there's no learning curve)
 *  - visitor viewer → a single locked card naming the section count, so
 *    the layer toggle still does something but the surface is gated
 */

import { Link } from 'react-router-dom'
import type { Lang } from '../../../i18n'
import { buildAdminSections } from '../../../lib/admin/hubSections'

interface Props {
  lang: Lang
  isAdmin: boolean
}

export function AdminLayer({ lang, isAdmin }: Props) {
  if (!isAdmin) {
    const total = buildAdminSections(lang).reduce((n, s) => n + s.tiles.length, 0)
    const sections = buildAdminSections(lang).length
    return (
      <div className="map-admin map-admin--locked">
        <p className="map-admin__lock">
          {lang === 'en'
            ? `Operator console — ${sections} sections, ${total} tiles. Hidden in visitor view.`
            : `Console opérateur — ${sections} sections, ${total} tuiles. Cachée en vue visiteur.`}
        </p>
        <p className="map-admin__hint">
          <Link to={lang === 'en' ? '/en/login' : '/login'}>
            {lang === 'en' ? 'Sign in' : 'Se connecter'} →
          </Link>
        </p>
      </div>
    )
  }

  const sections = buildAdminSections(lang)
  return (
    <div className="map-admin">
      {sections.map((s) => (
        <section key={s.title} className="map-admin__section">
          <h3 className="map-admin__section-title mono">{s.title}</h3>
          <ul className="map-admin__grid">
            {s.tiles.map((tile) => (
              <li key={tile.href} className="map-admin__tile">
                {tile.external ? (
                  <a
                    className="map-admin__tile-link"
                    href={tile.href}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <TileBody tile={tile} external />
                  </a>
                ) : (
                  <Link className="map-admin__tile-link" to={tile.href}>
                    <TileBody tile={tile} />
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function TileBody({
  tile,
  external,
}: {
  tile: { title: string; desc: string; badge?: string }
  external?: boolean
}) {
  return (
    <>
      <div className="map-admin__tile-head">
        <h4 className="map-admin__tile-title">{tile.title}</h4>
        {tile.badge && (
          <span className="mono map-admin__tile-badge">
            {external ? '↗ ' : ''}
            {tile.badge}
          </span>
        )}
      </div>
      <p className="map-admin__tile-desc">{tile.desc}</p>
    </>
  )
}
