import { useEffect, useState } from 'react'
import type { Lang } from '../i18n'
import { getPrefs, updatePrefs, type PrefLang } from '../lib/prefsApi'

/**
 * Language preference card. Controls which language the portal sends
 * notification emails in (sign-in link, status changes, vouches awaiting
 * moderation, etc.). Independent of the UI language toggle in the header —
 * that one switches the page you're looking at; this one switches the
 * language the inbox will speak to you in.
 *
 * Mounted on:
 *  - /me  (visitor account console)
 *  - /admin (operator console — affects Marc's notification emails)
 *
 * Visual: cream-paper tile matching the surrounding console. Optimistic
 * update: we set local state immediately and roll back on PATCH failure.
 */

const COPY = {
  fr: {
    eyebrow: 'préférences',
    title: 'Langue des courriels',
    description:
      'Quelle langue je devrais parler dans ton inbox ? Tu peux changer d’idée quand tu veux.',
    fr: 'Français',
    frHint: 'Tu / OQLF / 1 800 $',
    en: 'English',
    enHint: 'You / standard / $1,800',
    loading: 'Chargement…',
    saving: 'Enregistrement…',
    saved: 'Préférence enregistrée.',
    error: 'Pas pu enregistrer — réessaie.',
  },
  en: {
    eyebrow: 'preferences',
    title: 'Email language',
    description: 'Which language should I speak in your inbox? Change your mind anytime.',
    fr: 'Français',
    frHint: 'Tu / OQLF / 1 800 $',
    en: 'English',
    enHint: 'You / standard / $1,800',
    loading: 'Loading…',
    saving: 'Saving…',
    saved: 'Preference saved.',
    error: "Couldn't save — try again.",
  },
} as const

export function LangPrefCard({ lang }: { lang: Lang }) {
  const t = COPY[lang]
  const [pref, setPref] = useState<PrefLang | null>(null)
  const [state, setState] = useState<'idle' | 'loading' | 'saving' | 'saved' | 'error'>('loading')

  useEffect(() => {
    let cancelled = false
    getPrefs()
      .then((r) => {
        if (cancelled) return
        setPref(r.lang)
        setState('idle')
      })
      .catch(() => {
        if (cancelled) return
        setState('error')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const onPick = async (next: PrefLang) => {
    if (next === pref || state === 'saving') return
    const previous = pref
    setPref(next)
    setState('saving')
    try {
      await updatePrefs(next)
      setState('saved')
      // Self-dismiss the "saved" pill after a short beat so the card
      // returns to a quiet state.
      window.setTimeout(() => setState('idle'), 2500)
    } catch {
      setPref(previous)
      setState('error')
    }
  }

  return (
    <section id="prefs" className="surface lang-pref" aria-labelledby="lang-pref-title">
      <div className="lang-pref__head">
        <div className="section__eyebrow">{t.eyebrow}</div>
        <h2 id="lang-pref-title" className="lang-pref__title">
          {t.title}
        </h2>
        <p className="lang-pref__desc">{t.description}</p>
      </div>
      <div className="lang-pref__choices" role="radiogroup" aria-labelledby="lang-pref-title">
        <LangChoice
          value="fr"
          active={pref === 'fr'}
          disabled={state === 'loading' || state === 'saving'}
          label={t.fr}
          hint={t.frHint}
          flag="FR"
          onPick={onPick}
        />
        <LangChoice
          value="en"
          active={pref === 'en'}
          disabled={state === 'loading' || state === 'saving'}
          label={t.en}
          hint={t.enHint}
          flag="EN"
          onPick={onPick}
        />
      </div>
      <p className="lang-pref__status mono" role="status" aria-live="polite">
        {state === 'loading' && t.loading}
        {state === 'saving' && t.saving}
        {state === 'saved' && t.saved}
        {state === 'error' && t.error}
      </p>
    </section>
  )
}

function LangChoice({
  value,
  active,
  disabled,
  label,
  hint,
  flag,
  onPick,
}: {
  value: PrefLang
  active: boolean
  disabled: boolean
  label: string
  hint: string
  flag: string
  onPick: (v: PrefLang) => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      disabled={disabled}
      onClick={() => onPick(value)}
      className={`surface lang-pref__choice${active ? ' lang-pref__choice--active' : ''}`}
    >
      <span className="lang-pref__choice-flag mono" aria-hidden="true">
        {flag}
      </span>
      <span className="lang-pref__choice-body">
        <span className="lang-pref__choice-label">{label}</span>
        <span className="lang-pref__choice-hint mono">{hint}</span>
      </span>
      {active && (
        <span className="lang-pref__choice-tick" aria-hidden="true">
          ✓
        </span>
      )}
    </button>
  )
}
