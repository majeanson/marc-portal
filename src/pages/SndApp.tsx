/**
 * SndApp — the buyer-facing application for SND-template tenants.
 * Renders at the buyer's root domain (when tenant.templateId === 'snd').
 *
 * v1 scope: list of voice clips (most recent first) + a quick-add panel that
 * accepts a client name, a transcript, and optionally a date. Audio capture
 * and invoice generation come in follow-ups.
 */

import { useEffect, useMemo, useState } from 'react'
import type { Lang } from '../i18n'
import { AppShell } from '../components/AppShell'
import { api, ApiError } from '../lib/api'
import { useAuth } from '../lib/authContext'
import { useTenant } from '../lib/tenantContext'
import { Navigate, useLocation } from 'react-router-dom'

interface VoiceClip {
  id: string
  recordedAt: number
  clientName: string
  transcriptFr: string | null
  transcriptEn: string | null
  createdByEmail: string
  createdAt: number
}

const COPY = {
  fr: {
    eyebrow: 'cette semaine',
    title: 'Notes vocales',
    sub: 'Vos notes dictées de la semaine. Cliquez sur + pour en ajouter une.',
    add: '+ Ajouter une note',
    cancel: 'Annuler',
    save: 'Enregistrer',
    saving: 'Enregistrement…',
    client: 'Client',
    clientPh: 'ex. Bélanger',
    when: 'Quand',
    transcript: 'Transcription (ce qui a été dicté)',
    transcriptPh:
      'Ex. : Lundi 8h12 chez Bélanger. 3h de soudure, deux coudes en T 1/2 pouce, joint silicone.',
    empty: 'Aucune note encore. Ajoutez la première en cliquant sur +.',
    error: 'Hmm, ça n’a pas marché. Réessayez.',
    by: 'par',
    settings: 'Réglages',
    signin: 'Se connecter pour commencer →',
    loading: 'Chargement…',
  },
  en: {
    eyebrow: 'this week',
    title: 'Voice notes',
    sub: 'Your dictated notes for the week. Click + to add one.',
    add: '+ Add a note',
    cancel: 'Cancel',
    save: 'Save',
    saving: 'Saving…',
    client: 'Client',
    clientPh: 'e.g. Bélanger',
    when: 'When',
    transcript: 'Transcript (what was dictated)',
    transcriptPh:
      'e.g. Monday 8:12am at Bélanger’s. 3h of welding, two 1/2-inch T-elbows, silicone seal.',
    empty: 'No notes yet. Add the first one by clicking +.',
    error: 'Hmm, that didn’t work. Try again.',
    by: 'by',
    settings: 'Settings',
    signin: 'Sign in to get started →',
    loading: 'Loading…',
  },
} as const

function formatDate(unixSec: number, lang: Lang): string {
  const d = new Date(unixSec * 1000)
  return d.toLocaleDateString(lang === 'fr' ? 'fr-CA' : 'en-CA', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function isoNowLocal(): string {
  const d = new Date()
  // datetime-local needs YYYY-MM-DDTHH:MM in local time
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function SndApp({ lang }: { lang: Lang }) {
  const t = COPY[lang]
  const { tenant, loading: tenantLoading } = useTenant()
  const { email, loading: authLoading } = useAuth()
  const loc = useLocation()

  const [clips, setClips] = useState<VoiceClip[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  // Form state
  const [clientName, setClientName] = useState('')
  const [recordedAtLocal, setRecordedAtLocal] = useState<string>(isoNowLocal())
  const [transcript, setTranscript] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    document.title = `${t.title} — ${tenant?.displayName ?? 'SND'}`
  }, [t, tenant])

  useEffect(() => {
    if (!email || tenant?.templateId !== 'snd') return
    let cancelled = false
    api<{ clips: VoiceClip[] }>('/api/snd/clips')
      .then((r) => {
        if (cancelled) return
        setClips(r.clips)
        setError(null)
      })
      .catch((err) => {
        if (cancelled) return
        if (err instanceof ApiError && err.status === 401) {
          setClips(null)
        } else {
          setError(err instanceof Error ? err.message : 'unknown')
        }
      })
    return () => {
      cancelled = true
    }
  }, [email, tenant?.templateId])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting || !clientName.trim() || !transcript.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const recordedAtSec = recordedAtLocal
        ? Math.floor(new Date(recordedAtLocal).getTime() / 1000)
        : undefined
      const transcriptKey = lang === 'en' ? 'transcriptEn' : 'transcriptFr'
      const r = await api<{ clip: VoiceClip }>('/api/snd/clips', {
        method: 'POST',
        body: {
          clientName: clientName.trim(),
          recordedAt: recordedAtSec,
          [transcriptKey]: transcript.trim(),
        },
      })
      setClips((prev) => [r.clip, ...(prev ?? [])])
      setClientName('')
      setTranscript('')
      setRecordedAtLocal(isoNowLocal())
      setAdding(false)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'unknown')
    } finally {
      setSubmitting(false)
    }
  }

  if (authLoading || tenantLoading) {
    return (
      <main className="page">
        <section className="page__panel">
          <p>{t.loading}</p>
        </section>
      </main>
    )
  }

  // Visiting an SND-tenant root without a session → bounce to login.
  if (!email) {
    const next = encodeURIComponent(loc.pathname)
    return <Navigate to={`${lang === 'en' ? '/en' : ''}/login?next=${next}`} replace />
  }

  return (
    <AppShell lang={lang}>
      <section className="snd-app__intro">
        <div className="section__eyebrow">{t.eyebrow}</div>
        <h2>{t.title}</h2>
        <p>{t.sub}</p>
      </section>

      {!adding && (
        <button
          type="button"
          className="hero__cta snd-app__add-btn"
          onClick={() => setAdding(true)}
        >
          {t.add}
        </button>
      )}

      {adding && (
        <form className="admin-block snd-app__form" onSubmit={submit}>
          <div className="theme-fields">
            <label className="field">
              <span className="field__label">{t.client}</span>
              <input
                required
                className="field__input"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder={t.clientPh}
              />
            </label>
            <label className="field">
              <span className="field__label">{t.when}</span>
              <input
                type="datetime-local"
                className="field__input"
                value={recordedAtLocal}
                onChange={(e) => setRecordedAtLocal(e.target.value)}
              />
            </label>
          </div>
          <label className="field" style={{ marginTop: 14 }}>
            <span className="field__label">{t.transcript}</span>
            <textarea
              required
              className="field__input"
              rows={5}
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder={t.transcriptPh}
            />
          </label>
          <div style={{ marginTop: 18, display: 'flex', gap: 14, alignItems: 'center' }}>
            <button type="submit" className="hero__cta" disabled={submitting}>
              {submitting ? t.saving : t.save}
            </button>
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                setAdding(false)
                setError(null)
              }}
            >
              {t.cancel}
            </button>
            {error && <span className="form__error">{t.error}</span>}
          </div>
        </form>
      )}

      <ClipList clips={clips} t={t} lang={lang} />
    </AppShell>
  )
}

type SndCopy = (typeof COPY)[Lang]

function ClipList({ clips, t, lang }: { clips: VoiceClip[] | null; t: SndCopy; lang: Lang }) {
  const grouped = useMemo(() => {
    if (!clips) return null
    return clips
  }, [clips])

  if (clips === null) return null
  if (grouped && grouped.length === 0) {
    return <p className="snd-app__empty">{t.empty}</p>
  }

  return (
    <ul className="snd-clips" aria-label={t.title}>
      {(grouped ?? []).map((c) => {
        const transcript =
          lang === 'en' ? (c.transcriptEn ?? c.transcriptFr) : (c.transcriptFr ?? c.transcriptEn)
        return (
          <li key={c.id} className="snd-app-clip">
            <header className="snd-app-clip__head">
              <div className="snd-app-clip__when mono">{formatDate(c.recordedAt, lang)}</div>
              <div className="snd-app-clip__client">{c.clientName}</div>
            </header>
            {transcript && <p className="snd-app-clip__body">{transcript}</p>}
            <footer className="snd-app-clip__foot mono">
              {t.by} {c.createdByEmail}
            </footer>
          </li>
        )
      })}
    </ul>
  )
}
