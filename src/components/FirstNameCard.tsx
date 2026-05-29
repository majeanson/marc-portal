import { useEffect, useState } from 'react'
import type { Lang } from '../i18n'
import { getPrefs, updateFirstName } from '../lib/prefsApi'
import { Btn } from './Btn'

/**
 * First-name card on /me. Optional field — visitors who don't set one
 * still receive emails (greeting falls back to "Bonjour" / "Hi"). Saved
 * on Enter or on blur; cleared by submitting an empty value.
 *
 * Visual match: same outer chrome as LangPrefCard so the two prefs read
 * as a stacked panel.
 */

const COPY = {
  fr: {
    eyebrow: 'préférences',
    title: 'Comment je devrais t’appeler',
    description:
      'Ton prénom (ou l’équivalent). Je l’utilise dans les courriels. Optionnel — tu peux laisser vide.',
    label: 'Prénom',
    placeholder: 'ex. Marc',
    save: 'Enregistrer',
    saving: 'Enregistrement…',
    saved: 'Enregistré.',
    cleared: 'Effacé.',
    error: 'Pas pu enregistrer — réessaie.',
    tooLong: '80 caractères max.',
  },
  en: {
    eyebrow: 'preferences',
    title: 'What should I call you',
    description:
      'Your first name (or whatever you go by). I use it in emails. Optional — leave it blank.',
    label: 'First name',
    placeholder: 'e.g. Marc',
    save: 'Save',
    saving: 'Saving…',
    saved: 'Saved.',
    cleared: 'Cleared.',
    error: "Couldn't save — try again.",
    tooLong: '80 characters max.',
  },
} as const

type State = 'loading' | 'idle' | 'saving' | 'saved' | 'cleared' | 'error' | 'tooLong'

export function FirstNameCard({ lang }: { lang: Lang }) {
  const t = COPY[lang]
  const [value, setValue] = useState('')
  const [saved, setSaved] = useState('')
  const [state, setState] = useState<State>('loading')

  useEffect(() => {
    let cancelled = false
    getPrefs()
      .then((r) => {
        if (cancelled) return
        const initial = r.firstName ?? ''
        setValue(initial)
        setSaved(initial)
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

  const onCommit = async () => {
    const trimmed = value.trim()
    if (trimmed === saved) return // nothing to do
    if (trimmed.length > 80) {
      setState('tooLong')
      return
    }
    setState('saving')
    try {
      const next = trimmed === '' ? null : trimmed
      const r = await updateFirstName(next)
      setSaved(r.firstName ?? '')
      setValue(r.firstName ?? '')
      setState(next === null ? 'cleared' : 'saved')
      window.setTimeout(() => setState('idle'), 2500)
    } catch {
      setState('error')
    }
  }

  return (
    <section id="first-name" className="surface lang-pref" aria-labelledby="first-name-title">
      <div className="lang-pref__head">
        <div className="section__eyebrow">{t.eyebrow}</div>
        <h2 id="first-name-title" className="lang-pref__title">
          {t.title}
        </h2>
        <p className="lang-pref__desc">{t.description}</p>
      </div>
      <div className="first-name__row">
        <label className="first-name__label">
          <span className="first-name__label-text mono">{t.label}</span>
          <input
            type="text"
            className="input first-name__input"
            placeholder={t.placeholder}
            value={value}
            maxLength={80}
            disabled={state === 'loading' || state === 'saving'}
            onChange={(e) => setValue(e.target.value)}
            onBlur={onCommit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                ;(e.currentTarget as HTMLInputElement).blur()
              }
            }}
          />
        </label>
        <Btn
          onClick={onCommit}
          disabled={state === 'loading' || state === 'saving' || value.trim() === saved}
        >
          {state === 'saving' ? t.saving : t.save}
        </Btn>
      </div>
      <p className="lang-pref__status mono" role="status" aria-live="polite">
        {state === 'saved' && t.saved}
        {state === 'cleared' && t.cleared}
        {state === 'error' && t.error}
        {state === 'tooLong' && t.tooLong}
      </p>
    </section>
  )
}
