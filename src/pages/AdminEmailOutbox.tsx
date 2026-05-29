/**
 * /admin/email-outbox — pending email outbox viewer with manual retry.
 *
 * The daily digest cron's sweepEmailOutbox handles the automated retries
 * (exponential backoff, up to 5 attempts). After that, a row sits silently
 * with attempts=5 until someone investigates. This page is the operator's
 * hands-on path: see the stuck rows, click retry, see the new state.
 *
 * Read from /api/admin/email-outbox; retries via POST { id } to the same
 * endpoint.
 */

import { useEffect, useState } from 'react'
import type { Lang } from '../i18n'
import { api, ApiError } from '../lib/api'

interface OutboxEntry {
  id: string
  toEmail: string
  subject: string
  kind: string
  createdAt: number
  attempts: number
  lastAttempt: number | null
  lastError: string | null
}

interface RetryResult {
  delivered: boolean
  alreadySent?: boolean
  error?: string
}

const STUCK_AT_ATTEMPTS = 5

// Operator-only surface — inline COPY per the i18n convention.
const COPY = {
  fr: {
    eyebrow: 'diagnostic · courriel',
    title: 'Outbox courriel',
    sub: 'Envois durables qui ont échoué une fois et attendent la prochaine passe du cron quotidien. Bloqués après 5 essais — relance ici pour déboguer.',
    loading: 'Chargement…',
    forbidden: 'Cette page est réservée à l’opérateur.',
    failed: 'Hmm, on n’a pas pu charger la liste.',
    empty: 'Outbox vide. Tous les envois durables sont passés.',
    refresh: 'Recharger',
    cols: {
      to: 'Destinataire',
      kind: 'Modèle',
      attempts: 'Essais',
      lastError: 'Dernière erreur',
      created: 'Créé',
      action: '',
    },
    retry: 'Relancer',
    retrying: 'Envoi…',
    delivered: 'Livré ✓',
    alreadySent: 'Déjà livré',
    retryFailed: (err: string) => `Échec : ${err}`,
    stuckTag: 'bloqué',
    pendingTag: 'en attente',
  },
  en: {
    eyebrow: 'diagnostic · email',
    title: 'Email outbox',
    sub: 'Durable sends that failed once and are waiting for the daily cron’s next sweep. Stuck after 5 attempts — retry here to debug.',
    loading: 'Loading…',
    forbidden: 'This page is for the operator only.',
    failed: 'Hmm, couldn’t load the list.',
    empty: 'Outbox is clear. Every durable send made it through.',
    refresh: 'Reload',
    cols: {
      to: 'Recipient',
      kind: 'Template',
      attempts: 'Attempts',
      lastError: 'Last error',
      created: 'Created',
      action: '',
    },
    retry: 'Retry',
    retrying: 'Sending…',
    delivered: 'Delivered ✓',
    alreadySent: 'Already sent',
    retryFailed: (err: string) => `Failed: ${err}`,
    stuckTag: 'stuck',
    pendingTag: 'pending',
  },
} as const

function formatTime(unixSec: number, lang: Lang): string {
  return new Date(unixSec * 1000).toLocaleString(lang === 'fr' ? 'fr-CA' : 'en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function AdminEmailOutbox({ lang }: { lang: Lang }) {
  const t = COPY[lang]
  const [entries, setEntries] = useState<OutboxEntry[] | null>(null)
  const [error, setError] = useState<'forbidden' | 'other' | null>(null)
  const [busy, setBusy] = useState<Record<string, boolean>>({})
  const [lastResult, setLastResult] = useState<Record<string, RetryResult>>({})

  useEffect(() => {
    document.title = `${t.title} — Marc`
  }, [t])

  // Initial load. Cancelled-flag pattern matches AdminToday — avoids
  // setState-after-unmount when the route is swapped mid-fetch.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await api<{ entries: OutboxEntry[] }>('/api/admin/email-outbox')
        if (!cancelled) setEntries(r.entries)
      } catch (err) {
        if (cancelled) return
        if (err instanceof ApiError && err.status === 403) setError('forbidden')
        else setError('other')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function reload() {
    setError(null)
    setEntries(null)
    try {
      const r = await api<{ entries: OutboxEntry[] }>('/api/admin/email-outbox')
      setEntries(r.entries)
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) setError('forbidden')
      else setError('other')
    }
  }

  async function retry(id: string) {
    setBusy((prev) => ({ ...prev, [id]: true }))
    try {
      const r = await api<RetryResult>('/api/admin/email-outbox', {
        method: 'POST',
        body: { id },
      })
      setLastResult((prev) => ({ ...prev, [id]: r }))
      // On delivery, refresh the list so the row drops off.
      if (r.delivered) await reload()
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : String(err)
      setLastResult((prev) => ({ ...prev, [id]: { delivered: false, error: msg } }))
    } finally {
      setBusy((prev) => ({ ...prev, [id]: false }))
    }
  }

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
        <div className="admin-page__head-actions">
          <button type="button" className="link-btn mono" onClick={() => void reload()}>
            ↺ {t.refresh}
          </button>
        </div>
      </header>

      <section className="surface admin-block fleet-block">
        {error === 'other' && <p className="form__error">{t.failed}</p>}
        {!entries && !error && (
          <p className="mono" style={{ color: 'var(--text-soft)' }}>
            {t.loading}
          </p>
        )}
        {entries && entries.length === 0 && (
          <p style={{ color: 'var(--text-mid)', padding: 18 }}>{t.empty}</p>
        )}
        {entries && entries.length > 0 && (
          <div className="table-scroll">
            <table className="fleet-table">
              <thead>
                <tr>
                  <th>{t.cols.to}</th>
                  <th>{t.cols.kind}</th>
                  <th>{t.cols.attempts}</th>
                  <th>{t.cols.lastError}</th>
                  <th>{t.cols.created}</th>
                  <th>{t.cols.action}</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => {
                  const stuck = e.attempts >= STUCK_AT_ATTEMPTS
                  const result = lastResult[e.id]
                  const isBusy = !!busy[e.id]
                  return (
                    <tr key={e.id}>
                      <td className="mono fleet-table__primary">{e.toEmail}</td>
                      <td>
                        <div className="fleet-table__primary mono">{e.kind}</div>
                        <div className="fleet-table__secondary">{e.subject}</div>
                      </td>
                      <td className="mono">
                        {e.attempts}
                        <span className="mono fleet-table__secondary" style={{ marginLeft: 8 }}>
                          {stuck ? t.stuckTag : t.pendingTag}
                        </span>
                      </td>
                      <td className="mono fleet-table__secondary">{e.lastError ?? '—'}</td>
                      <td className="mono fleet-table__secondary">
                        {formatTime(e.createdAt, lang)}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="link-btn mono"
                          onClick={() => void retry(e.id)}
                          disabled={isBusy}
                        >
                          {isBusy ? t.retrying : t.retry}
                        </button>
                        {result && (
                          <div className="fleet-table__secondary mono" style={{ marginTop: 4 }}>
                            {result.alreadySent
                              ? t.alreadySent
                              : result.delivered
                                ? t.delivered
                                : t.retryFailed(result.error ?? 'unknown')}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
