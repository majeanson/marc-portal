/**
 * /admin/audit — operator-only audit log viewer.
 *
 * Shows a reverse-chronological feed of every operator-significant action:
 * tenant provisioning, theme updates, status freezes. Read from audit_log via
 * /api/admin/audit (operator-gated).
 */

import { useEffect, useState } from 'react'
import type { Lang } from '../i18n'
import { api, ApiError } from '../lib/api'

interface AuditEntry {
  id: string
  ts: number
  actorEmail: string
  tenantId: string | null
  tenantSlug: string | null
  action: string
  payload: unknown
}

const COPY = {
  fr: {
    eyebrow: 'journal',
    title: 'Journal des actions',
    sub: 'Historique de chaque action d’opérateur — pour ta mémoire et pour la sécurité.',
    error: 'Hmm, on n’a pas pu charger le journal.',
    forbidden: 'Cette page est réservée à l’opérateur.',
    empty: 'Aucune action enregistrée — c’est neuf.',
    cols: { when: 'Quand', actor: 'Acteur', tenant: 'Client', action: 'Action' },
  },
  en: {
    eyebrow: 'audit log',
    title: 'Action history',
    sub: 'Reverse-chronological log of every operator action — for your memory and security.',
    error: 'Hmm, couldn’t load the log.',
    forbidden: 'This page is for the operator only.',
    empty: 'No actions recorded yet — fresh slate.',
    cols: { when: 'When', actor: 'Actor', tenant: 'Buyer', action: 'Action' },
  },
} as const

function formatTime(unixSec: number, lang: Lang): string {
  const d = new Date(unixSec * 1000)
  return d.toLocaleString(lang === 'fr' ? 'fr-CA' : 'en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function summarizePayload(p: unknown): string {
  if (p === null || p === undefined) return ''
  if (typeof p === 'string') return p
  if (typeof p === 'object') {
    const entries = Object.entries(p as Record<string, unknown>)
    return entries.map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(' · ')
  }
  return String(p)
}

export function AdminAudit({ lang }: { lang: Lang }) {
  const t = COPY[lang]
  const [entries, setEntries] = useState<AuditEntry[] | null>(null)
  const [error, setError] = useState<'forbidden' | 'other' | null>(null)

  useEffect(() => {
    let cancelled = false
    api<{ entries: AuditEntry[] }>('/api/admin/audit')
      .then((r) => {
        if (cancelled) return
        setEntries(r.entries)
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
      </header>

      <section className="admin-block fleet-block">
        {error === 'other' && <p className="form__error">{t.error}</p>}
        {!entries && !error && <p className="mono" style={{ color: 'var(--text-soft)' }}>…</p>}
        {entries && entries.length === 0 && (
          <p style={{ color: 'var(--text-mid)', padding: 18 }}>{t.empty}</p>
        )}
        {entries && entries.length > 0 && (
          <table className="fleet-table">
            <thead>
              <tr>
                <th>{t.cols.when}</th>
                <th>{t.cols.actor}</th>
                <th>{t.cols.tenant}</th>
                <th>{t.cols.action}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td className="mono fleet-table__secondary">{formatTime(e.ts, lang)}</td>
                  <td className="mono fleet-table__secondary">{e.actorEmail}</td>
                  <td>
                    {e.tenantSlug ? (
                      <span className="fleet-table__primary">{e.tenantSlug}</span>
                    ) : (
                      <span className="fleet-table__secondary">—</span>
                    )}
                  </td>
                  <td>
                    <div className="fleet-table__primary mono">{e.action}</div>
                    {e.payload !== null && (
                      <div className="fleet-table__secondary mono">{summarizePayload(e.payload)}</div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
