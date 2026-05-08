/**
 * /admin/fleet — operator (Marc) view of every tenant in the workspace.
 * Forbidden on buyer tenants (server-side gate via flags.isOperator).
 *
 * Default view is the table of tenants. The "Provision new buyer" CTA
 * navigates to /admin/fleet/new.
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Lang } from '../i18n'
import { api, ApiError } from '../lib/api'

interface FleetRow {
  id: string
  slug: string
  ownerEmail: string
  templateId: string
  templateVersion: string
  status: 'pending' | 'active' | 'frozen'
  domains: string[]
  primaryDomain: string | null
  createdAt: number
  frozenAt: number | null
}

const COPY = {
  fr: {
    eyebrow: 'flotte',
    title: 'Tous les clients',
    sub: 'Vue d’ensemble de chaque instance que tu opères. Cliquez sur une ligne pour voir les détails.',
    provision: 'Provisionner un nouveau client →',
    cols: { tenant: 'Client', template: 'App', domain: 'Domaine', status: 'État', age: 'Créé' },
    statusActive: 'Actif',
    statusPending: 'En attente',
    statusFrozen: 'Pausé',
    empty: 'Aucun client encore. Provisionne le premier.',
    error: 'Hmm, on n’a pas pu charger la flotte.',
    forbidden: 'Cette page est réservée à l’opérateur.',
  },
  en: {
    eyebrow: 'fleet',
    title: 'All buyers',
    sub: 'Overview of every instance you operate. Click a row to see details.',
    provision: 'Provision a new buyer →',
    cols: { tenant: 'Buyer', template: 'App', domain: 'Domain', status: 'Status', age: 'Created' },
    statusActive: 'Active',
    statusPending: 'Pending',
    statusFrozen: 'Paused',
    empty: 'No buyers yet. Provision the first one.',
    error: 'Hmm, couldn’t load the fleet.',
    forbidden: 'This page is for the operator only.',
  },
} as const

function formatAge(unixSec: number, lang: Lang): string {
  const now = Date.now() / 1000
  const diff = now - unixSec
  const day = 86400
  if (diff < day) return lang === 'fr' ? 'aujourd’hui' : 'today'
  const days = Math.floor(diff / day)
  if (days < 7) return lang === 'fr' ? `il y a ${days} j` : `${days}d ago`
  if (days < 60) {
    const w = Math.floor(days / 7)
    return lang === 'fr' ? `il y a ${w} sem.` : `${w}w ago`
  }
  const m = Math.floor(days / 30)
  return lang === 'fr' ? `il y a ${m} mois` : `${m}mo ago`
}

export function AdminFleet({ lang }: { lang: Lang }) {
  const t = COPY[lang]
  const [rows, setRows] = useState<FleetRow[] | null>(null)
  const [error, setError] = useState<'forbidden' | 'other' | null>(null)
  const langPrefix = lang === 'en' ? '/en' : ''

  useEffect(() => {
    let cancelled = false
    api<{ tenants: FleetRow[] }>('/api/admin/fleet')
      .then((r) => {
        if (cancelled) return
        setRows(r.tenants)
      })
      .catch((err) => {
        if (cancelled) return
        if (err instanceof ApiError && err.status === 403) setError('forbidden')
        else setError('other')
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (error === 'forbidden') {
    return (
      <div className="admin-page">
        <header className="admin-page__head">
          <h1>{t.title}</h1>
          <p>{t.forbidden}</p>
        </header>
      </div>
    )
  }

  return (
    <div className="admin-page">
      <header className="admin-page__head">
        <div className="section__eyebrow">{t.eyebrow}</div>
        <h1>{t.title}</h1>
        <p>{t.sub}</p>
        <div style={{ marginTop: 18 }}>
          <Link className="hero__cta" to={`${langPrefix}/admin/fleet/new`}>
            {t.provision}
          </Link>
        </div>
      </header>

      <section className="admin-block fleet-block">
        {error === 'other' && <p className="form__error">{t.error}</p>}
        {!rows && !error && (
          <p className="mono" style={{ color: 'var(--text-soft)' }}>
            …
          </p>
        )}
        {rows && rows.length === 0 && <p style={{ color: 'var(--text-mid)' }}>{t.empty}</p>}
        {rows && rows.length > 0 && (
          <table className="fleet-table">
            <thead>
              <tr>
                <th>{t.cols.tenant}</th>
                <th>{t.cols.template}</th>
                <th>{t.cols.domain}</th>
                <th>{t.cols.status}</th>
                <th>{t.cols.age}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div className="fleet-table__primary">{r.slug}</div>
                    <div className="fleet-table__secondary mono">{r.ownerEmail}</div>
                  </td>
                  <td>
                    <div className="fleet-table__primary">{r.templateId}</div>
                    <div className="fleet-table__secondary mono">v{r.templateVersion}</div>
                  </td>
                  <td>
                    <a
                      href={`https://${r.primaryDomain}`}
                      target="_blank"
                      rel="noreferrer"
                      className="fleet-table__domain mono"
                    >
                      {r.primaryDomain ?? '—'}
                    </a>
                    {r.domains.length > 1 && (
                      <div className="fleet-table__secondary mono">+{r.domains.length - 1}</div>
                    )}
                  </td>
                  <td>
                    <span
                      className={`status status--${r.status === 'active' ? 'active' : r.status === 'frozen' ? 'deprecated' : 'draft'}`}
                    >
                      {r.status === 'active'
                        ? t.statusActive
                        : r.status === 'frozen'
                          ? t.statusFrozen
                          : t.statusPending}
                    </span>
                  </td>
                  <td className="mono fleet-table__secondary">{formatAge(r.createdAt, lang)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
