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

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Lang } from '../i18n'
import { LangPrefCard } from '../components/LangPrefCard'
import { EmailTestCard } from '../components/EmailTestCard'
import { buildAdminSections, type AdminTile } from '../lib/admin/hubSections'
import { ProposalSheet } from '../components/intake/ProposalSheet'
import type { Account } from '../components/intake/AccountStep'
import type { FormData } from '../components/intake/TypeForm'
import { getSchemaForType, type ProblemType } from '../lib/intakeSchemas'

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

      {/* Outils — a single shared section holds every operator widget so the
          "Outils" heading appears once. Each tool is body-only (no inner
          section/heading) and the rhythm comes from .admin-hub__tool. */}
      <section className="admin-hub__section">
        <h2 className="admin-hub__section-title mono">{lang === 'en' ? 'Tools' : 'Outils'}</h2>
        <ProposalProof lang={lang} />
        <EmailTestCard lang={lang} />
      </section>

      <LangPrefCard lang={lang} />
    </article>
  )
}

/**
 * Operator tool — print a sample one-page proposal without walking the
 * whole intake flow. It mounts a ProposalSheet (see ProposalSheet.tsx)
 * filled with representative answers, then opens the print dialog, so the
 * printed brief can be eyeballed on demand.
 */
function ProposalProof({ lang }: { lang: Lang }) {
  const [mounted, setMounted] = useState(false)
  const copy =
    lang === 'fr'
      ? {
          label: 'Tester le dossier PDF',
          hint: 'Ouvre l’aperçu d’impression avec un dossier d’exemple — aucun intake à remplir.',
        }
      : {
          label: 'Test the proposal PDF',
          hint: 'Opens the print preview with a sample brief — no intake to fill out.',
        }

  // A fully-answered sample: select/radio take their first option, the
  // rest get representative text, so the printed sheet looks real.
  const sample = useMemo(() => {
    const type: ProblemType = 'paperasse'
    const values: FormData = {}
    for (const field of getSchemaForType(type).fields) {
      if ((field.type === 'select' || field.type === 'radio') && field.options?.length) {
        values[field.id] = field.options[0].value
      } else if (field.type === 'number') {
        values[field.id] = '24'
      } else {
        values[field.id] =
          lang === 'fr'
            ? 'Réponse d’exemple — du texte représentatif pour juger la mise en page.'
            : 'Sample answer — representative text to judge the layout.'
      }
    }
    const account: Account = { email: 'apercu@exemple.ca', name: 'Sophie Tremblay' }
    return { account, type, values, submittedAt: new Date().toISOString().slice(0, 10) }
  }, [lang])

  const onTest = () => {
    setMounted(true)
    // Let the sheet commit to the DOM before the print dialog reads it.
    requestAnimationFrame(() => requestAnimationFrame(() => window.print()))
  }

  return (
    <div className="admin-hub__tool">
      <p style={{ margin: '0 0 6px 0' }}>
        <button type="button" className="link-btn mono" onClick={onTest}>
          {copy.label}
        </button>
      </p>
      <p className="field__hint" style={{ marginTop: 0 }}>
        {copy.hint}
      </p>
      {mounted && (
        <ProposalSheet
          lang={lang}
          account={sample.account}
          type={sample.type}
          values={sample.values}
          submittedAt={sample.submittedAt}
        />
      )}
    </div>
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
