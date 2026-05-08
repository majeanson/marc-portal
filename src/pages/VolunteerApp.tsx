/**
 * VolunteerApp — buyer-facing app for volunteer-roster template tenants.
 * Renders at the buyer's root domain when tenant.templateId === 'volunteer-roster'.
 *
 * v1 scope: list of upcoming shifts grouped by date, owner-only "+ Add shift"
 * action, signed-in users sign up / cancel their slot. The slot fill count
 * comes from the server (shifts join signups), so the SPA stays dumb.
 *
 * Differs from SndApp on purpose: forward-dated time buckets, two role types,
 * mutable signups. Phase 3 generalization compares this against SndApp to
 * extract what's truly shared spine.
 */

import { useEffect, useMemo, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import type { Lang } from '../i18n'
import { AppShell } from '../components/AppShell'
import { api, ApiError } from '../lib/api'
import { useAuth } from '../lib/authContext'
import { useTenant } from '../lib/tenantContext'

interface Shift {
  id: string
  startsAt: number
  endsAt: number
  role: string
  slotsNeeded: number
  filled: number
  location: string | null
  notes: string | null
  createdByEmail: string
  createdAt: number
}

const COPY = {
  fr: {
    title: 'Quarts à venir',
    sub: 'Inscris-toi à un quart, ou ajoutes-en un (propriétaire seulement).',
    add: '+ Ajouter un quart',
    cancel: 'Annuler',
    signup: 'M’inscrire',
    cancelSignup: 'Annuler mon inscription',
    saveShift: 'Enregistrer',
    saving: 'Enregistrement…',
    role: 'Rôle',
    rolePh: 'Cuisine, accueil, dépose…',
    starts: 'Début',
    ends: 'Fin',
    slots: 'Bénévoles requis',
    location: 'Lieu (optionnel)',
    locationPh: 'Centre communautaire',
    notes: 'Notes (optionnel)',
    full: 'Complet',
    filled: 'rempli',
    of: 'sur',
    you: 'toi',
    settings: 'Réglages',
    empty: 'Aucun quart à venir. Ajoute-en un avec le bouton +.',
    error: 'Hmm, ça n’a pas marché. Réessaye.',
    loading: 'Chargement…',
    namePlaceholder: 'Ton prénom (optionnel)',
    nameLabel: 'Nom à afficher',
    by: 'créé par',
  },
  en: {
    title: 'Upcoming shifts',
    sub: 'Sign up for a shift, or add one (owner only).',
    add: '+ Add a shift',
    cancel: 'Cancel',
    signup: 'Sign me up',
    cancelSignup: 'Cancel my signup',
    saveShift: 'Save',
    saving: 'Saving…',
    role: 'Role',
    rolePh: 'Kitchen, greeter, drop-off…',
    starts: 'Starts',
    ends: 'Ends',
    slots: 'Volunteers needed',
    location: 'Location (optional)',
    locationPh: 'Community centre',
    notes: 'Notes (optional)',
    full: 'Full',
    filled: 'filled',
    of: 'of',
    you: 'you',
    settings: 'Settings',
    empty: 'No upcoming shifts. Add one with the + button.',
    error: 'Hmm, that didn’t work. Try again.',
    loading: 'Loading…',
    namePlaceholder: 'Your first name (optional)',
    nameLabel: 'Display name',
    by: 'created by',
  },
} as const

type VRCopy = (typeof COPY)[Lang]

function isoNowLocal(addHours = 0): string {
  const d = new Date(Date.now() + addHours * 3600 * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fmtDate(unixSec: number, lang: Lang, withYear = false): string {
  const d = new Date(unixSec * 1000)
  return d.toLocaleDateString(lang === 'fr' ? 'fr-CA' : 'en-CA', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: withYear ? 'numeric' : undefined,
  })
}

function fmtTime(unixSec: number, lang: Lang): string {
  const d = new Date(unixSec * 1000)
  return d.toLocaleTimeString(lang === 'fr' ? 'fr-CA' : 'en-CA', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function VolunteerApp({ lang }: { lang: Lang }) {
  const t = COPY[lang]
  const { tenant, loading: tenantLoading } = useTenant()
  const { email, loading: authLoading } = useAuth()
  const loc = useLocation()

  const [shifts, setShifts] = useState<Shift[] | null>(null)
  // Map of shiftId → signupId for the current user's confirmed signups.
  // Used to flip the "Sign me up" button to "Cancel my signup" and to know
  // which signup to DELETE when cancelling.
  const [mySignups, setMySignups] = useState<Map<string, string>>(new Map())
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    document.title = `${t.title} — ${tenant?.displayName ?? 'Volunteer Roster'}`
  }, [t, tenant])

  // Owner detection happens server-side on POST; the UI exposes the "+ Add"
  // button to everyone and lets the API reject non-owners. Widening
  // TenantPublic to include ownerEmail would let us hide the button up-front;
  // tracked for the Phase 3 generalization pass.

  useEffect(() => {
    if (!email || tenant?.templateId !== 'volunteer-roster') return
    let cancelled = false
    Promise.all([
      api<{ shifts: Shift[] }>('/api/volunteer/shifts'),
      api<{ signups: Array<{ id: string; shiftId: string }> }>('/api/volunteer/signups'),
    ])
      .then(([shiftsResp, signupsResp]) => {
        if (cancelled) return
        setShifts(shiftsResp.shifts)
        const map = new Map<string, string>()
        for (const s of signupsResp.signups) map.set(s.shiftId, s.id)
        setMySignups(map)
        setError(null)
      })
      .catch((err) => {
        if (cancelled) return
        if (err instanceof ApiError && err.status === 401) setShifts(null)
        else setError(err instanceof Error ? err.message : 'unknown')
      })
    return () => {
      cancelled = true
    }
  }, [email, tenant?.templateId])

  const onSignup = async (shiftId: string) => {
    try {
      const r = await api<{ filled: number; signup: { id: string } | null }>(
        '/api/volunteer/signups',
        { method: 'POST', body: { shiftId } },
      )
      setShifts((prev) =>
        (prev ?? []).map((s) => (s.id === shiftId ? { ...s, filled: r.filled } : s)),
      )
      if (r.signup) {
        setMySignups((prev) => {
          const next = new Map(prev)
          next.set(shiftId, r.signup!.id)
          return next
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'unknown')
    }
  }

  const onCancelSignup = async (shiftId: string) => {
    const signupId = mySignups.get(shiftId)
    if (!signupId) return
    try {
      const r = await api<{ filled: number }>(`/api/volunteer/signups/${signupId}`, {
        method: 'DELETE',
      })
      setShifts((prev) =>
        (prev ?? []).map((s) => (s.id === shiftId ? { ...s, filled: r.filled } : s)),
      )
      setMySignups((prev) => {
        const next = new Map(prev)
        next.delete(shiftId)
        return next
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'unknown')
    }
  }

  const onShiftCreated = (newShift: Shift) => {
    setShifts((prev) => {
      const all = [...(prev ?? []), newShift]
      all.sort((a, b) => a.startsAt - b.startsAt)
      return all
    })
    setAdding(false)
  }

  // Hooks must run before any conditional return — group shifts up-front.
  const grouped = useMemoGroupByDay(shifts, lang)

  if (authLoading || tenantLoading) {
    return (
      <main className="page">
        <section className="page__panel">
          <p>{t.loading}</p>
        </section>
      </main>
    )
  }

  if (!email) {
    const next = encodeURIComponent(loc.pathname)
    return <Navigate to={`${lang === 'en' ? '/en' : ''}/login?next=${next}`} replace />
  }

  return (
    <AppShell lang={lang}>
      <section className="snd-app__intro">
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
        <AddShiftForm
          t={t}
          onCancel={() => setAdding(false)}
          onCreated={onShiftCreated}
        />
      )}

      {error && <p className="form__error">{t.error}</p>}

      {shifts && shifts.length === 0 && <p className="snd-app__empty">{t.empty}</p>}

      {grouped.map(([dayKey, dayShifts]) => (
        <section key={dayKey} className="vr-day">
          <h3 className="vr-day__head">{dayShifts[0] ? fmtDate(dayShifts[0].startsAt, lang, true) : dayKey}</h3>
          <ul className="snd-clips">
            {dayShifts.map((s) => {
                const full = s.filled >= s.slotsNeeded
                const mineHere = mySignups.has(s.id)
                return (
                  <li key={s.id} className="snd-app-clip vr-shift">
                    <header className="snd-app-clip__head vr-shift__head">
                      <div className="snd-app-clip__when mono">
                        {fmtTime(s.startsAt, lang)} – {fmtTime(s.endsAt, lang)}
                      </div>
                      <div className="snd-app-clip__client">{s.role}</div>
                      <div className={`vr-shift__fill${full ? ' vr-shift__fill--full' : ''}`}>
                        {full
                          ? t.full
                          : `${s.filled} ${t.of} ${s.slotsNeeded} ${t.filled}`}
                      </div>
                    </header>
                    {s.location && (
                      <p className="snd-app-clip__body" style={{ margin: '0 0 6px' }}>
                        📍 {s.location}
                      </p>
                    )}
                    {s.notes && <p className="snd-app-clip__body">{s.notes}</p>}
                    <footer className="vr-shift__foot">
                      <span className="snd-app-clip__foot mono">
                        {t.by} {s.createdByEmail}
                      </span>
                      {!full && !mineHere && (
                        <button
                          type="button"
                          className="hero__cta vr-shift__action"
                          onClick={() => onSignup(s.id)}
                        >
                          {t.signup}
                        </button>
                      )}
                      {mineHere && (
                        <button
                          type="button"
                          className="link-btn vr-shift__action"
                          onClick={() => onCancelSignup(s.id)}
                        >
                          {t.cancelSignup}
                        </button>
                      )}
                    </footer>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
    </AppShell>
  )
}

function AddShiftForm({
  t,
  onCancel,
  onCreated,
}: {
  t: VRCopy
  onCancel: () => void
  onCreated: (s: Shift) => void
}) {
  const [role, setRole] = useState('')
  const [startsAt, setStartsAt] = useState(isoNowLocal(24))
  const [endsAt, setEndsAt] = useState(isoNowLocal(26))
  const [slotsNeeded, setSlotsNeeded] = useState(2)
  const [location, setLocation] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setErr(null)
    try {
      const r = await api<{ shift: Shift }>('/api/volunteer/shifts', {
        method: 'POST',
        body: {
          role: role.trim(),
          startsAt: new Date(startsAt).getTime(),
          endsAt: new Date(endsAt).getTime(),
          slotsNeeded,
          location: location.trim() || undefined,
          notes: notes.trim() || undefined,
        },
      })
      onCreated(r.shift)
    } catch (error) {
      setErr(error instanceof ApiError ? error.message : 'unknown')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="admin-block snd-app__form" onSubmit={submit}>
      <div className="theme-fields">
        <label className="field">
          <span className="field__label">{t.role}</span>
          <input
            required
            className="field__input"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder={t.rolePh}
          />
        </label>
        <label className="field">
          <span className="field__label">{t.slots}</span>
          <input
            type="number"
            min={1}
            max={200}
            className="field__input"
            value={slotsNeeded}
            onChange={(e) => setSlotsNeeded(Math.max(1, Number(e.target.value) || 1))}
          />
        </label>
        <label className="field">
          <span className="field__label">{t.starts}</span>
          <input
            type="datetime-local"
            required
            className="field__input"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
          />
        </label>
        <label className="field">
          <span className="field__label">{t.ends}</span>
          <input
            type="datetime-local"
            required
            className="field__input"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
          />
        </label>
        <label className="field" style={{ gridColumn: '1 / -1' }}>
          <span className="field__label">{t.location}</span>
          <input
            className="field__input"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder={t.locationPh}
          />
        </label>
      </div>
      <label className="field" style={{ marginTop: 14 }}>
        <span className="field__label">{t.notes}</span>
        <textarea
          rows={3}
          className="field__input"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>
      <div style={{ marginTop: 18, display: 'flex', gap: 14, alignItems: 'center' }}>
        <button type="submit" className="hero__cta" disabled={submitting}>
          {submitting ? t.saving : t.saveShift}
        </button>
        <button type="button" className="link-btn" onClick={onCancel}>
          {t.cancel}
        </button>
        {err && <span className="form__error">{err}</span>}
      </div>
    </form>
  )
}

function useMemoGroupByDay(shifts: Shift[] | null, lang: Lang): Array<[string, Shift[]]> {
  return useMemo(() => {
    if (!shifts) return []
    const map = new Map<string, Shift[]>()
    for (const s of shifts) {
      const key = new Date(s.startsAt * 1000).toLocaleDateString(
        lang === 'fr' ? 'fr-CA' : 'en-CA',
        { year: 'numeric', month: '2-digit', day: '2-digit' },
      )
      const arr = map.get(key) ?? []
      arr.push(s)
      map.set(key, arr)
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [shifts, lang])
}
