/**
 * Operator-only diagnostic tile. Fires one of every outbound email type at
 * the signed-in admin's inbox so Marc can eyeball deliverability, voice,
 * and rendering across the catalog without walking the matching user flow.
 *
 * Mounted on /admin (AdminHub) inside the shared "Outils" section. The
 * caller owns the section + heading; this component renders body-only.
 * The picked language drives every send in the batch; default mirrors
 * the current UI lang. Synthetic sample data — no real session or vouch
 * rows are touched.
 */

import { useState } from 'react'
import { ApiError, api } from '../lib/api'
import type { Lang } from '../i18n'

interface TestResult {
  kind: string
  delivered: boolean
}

interface TestResponse {
  recipient: string
  lang: Lang
  results: TestResult[]
}

type Status = 'idle' | 'sending' | 'done' | 'error'

const COPY = {
  fr: {
    title: 'Tester toutes les notifications courriel',
    desc: 'Envoie un exemple de chaque type de courriel à ton inbox — exactement comme un visiteur les recevrait. Données synthétiques, aucune session réelle touchée.',
    langLabel: 'Langue du lot',
    fr: 'FR',
    en: 'EN',
    fire: 'Envoyer le lot',
    sending: 'Envoi en cours… (≈ 8 s)',
    done: (n: number, recipient: string) => `${n} envoyés à ${recipient}.`,
    fail: 'Échec — voir la console.',
    miss: (n: number) => `(${n} non livré${n > 1 ? 's' : ''})`,
  },
  en: {
    title: 'Test every email notification',
    desc: 'Sends a sample of each email type to your inbox — exactly like a visitor receives them. Synthetic data, no real session touched.',
    langLabel: 'Batch language',
    fr: 'FR',
    en: 'EN',
    fire: 'Send the bundle',
    sending: 'Sending… (~8 s)',
    done: (n: number, recipient: string) => `${n} sent to ${recipient}.`,
    fail: 'Failed — see the console.',
    miss: (n: number) => `(${n} not delivered)`,
  },
} as const

export function EmailTestCard({ lang }: { lang: Lang }) {
  const t = COPY[lang]
  const [batchLang, setBatchLang] = useState<Lang>(lang)
  const [status, setStatus] = useState<Status>('idle')
  const [response, setResponse] = useState<TestResponse | null>(null)

  const onFire = async () => {
    if (status === 'sending') return
    setStatus('sending')
    setResponse(null)
    try {
      const r = await api<TestResponse>('/api/admin/test-emails', {
        method: 'POST',
        body: { lang: batchLang },
      })
      setResponse(r)
      setStatus('done')
    } catch (err) {
      console.error('test-emails failed', err)
      if (err instanceof ApiError) {
        setResponse({ recipient: '', lang: batchLang, results: [] })
      }
      setStatus('error')
    }
  }

  const delivered = response?.results.filter((r) => r.delivered).length ?? 0
  const missed = (response?.results.length ?? 0) - delivered

  return (
    <div className="admin-hub__tool">
      <p style={{ margin: '0 0 6px 0' }}>
        <button
          type="button"
          className="link-btn mono"
          onClick={onFire}
          disabled={status === 'sending'}
        >
          {status === 'sending' ? t.sending : t.fire}
        </button>
      </p>
      <p className="field__hint" style={{ marginTop: 0 }}>
        {t.title}. {t.desc}
      </p>
      <div
        role="radiogroup"
        aria-label={t.langLabel}
        style={{ display: 'flex', gap: 8, marginTop: 6, marginBottom: 6 }}
      >
        <LangPill
          value="fr"
          active={batchLang === 'fr'}
          disabled={status === 'sending'}
          label={t.fr}
          onPick={setBatchLang}
        />
        <LangPill
          value="en"
          active={batchLang === 'en'}
          disabled={status === 'sending'}
          label={t.en}
          onPick={setBatchLang}
        />
      </div>
      {status === 'done' && response && (
        <p className="field__hint mono" role="status" aria-live="polite">
          {t.done(delivered, response.recipient)} {missed > 0 && t.miss(missed)}
        </p>
      )}
      {status === 'error' && (
        <p className="field__hint mono" role="status" aria-live="polite">
          {t.fail}
        </p>
      )}
      {status === 'done' && response && response.results.length > 0 && (
        <ul
          className="mono"
          style={{
            listStyle: 'none',
            padding: 0,
            margin: '8px 0 0 0',
            fontSize: 12,
            lineHeight: 1.7,
            color: 'var(--text-mid)',
          }}
        >
          {response.results.map((r) => (
            <li key={r.kind}>
              <span aria-hidden="true">{r.delivered ? '✓' : '×'}</span> {r.kind}
              {!r.delivered && ' — failed'}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function LangPill({
  value,
  active,
  disabled,
  label,
  onPick,
}: {
  value: Lang
  active: boolean
  disabled: boolean
  label: string
  onPick: (v: Lang) => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      disabled={disabled}
      onClick={() => onPick(value)}
      className="mono"
      style={{
        background: active ? 'var(--accent)' : 'transparent',
        color: active ? 'var(--bg-card)' : 'var(--text-soft)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        padding: '4px 10px',
        fontSize: 12,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {label}
    </button>
  )
}
