import { useState } from 'react'
import type { Lang } from '../../i18n'
import { DICT } from '../../i18n'

export interface Account {
  email: string
  name?: string
}

export function AccountStep({
  lang,
  initial,
  onContinue,
}: {
  lang: Lang
  initial: Partial<Account>
  onContinue: (acc: Account) => void
}) {
  const t = DICT[lang].intake.account
  const [email, setEmail] = useState(initial.email ?? '')
  const [name, setName] = useState(initial.name ?? '')
  const valid = /\S+@\S+\.\S+/.test(email)
  const loginHref = lang === 'en' ? '/en/login' : '/login'

  return (
    <div className="intake__step">
      <div className="section__eyebrow">{t.eyebrow}</div>
      <h2>{t.title}</h2>
      <p>{t.body}</p>

      <p className="intake__signin">
        <span>{t.alreadyHaveAccount}</span>{' '}
        <a href={loginHref} className="intake__signin-link">
          {t.signIn}
        </a>
      </p>

      <label className="field">
        <span className="field__label">{t.emailLabel}</span>
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="ex: marie@drummondville-pavage.qc.ca"
          className="field__input mono"
        />
      </label>

      <label className="field">
        <span className="field__label">{t.nameLabel}</span>
        <input
          type="text"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t.namePlaceholder}
          className="field__input"
        />
      </label>

      <p className="field__hint">{t.hint}</p>

      <button
        type="button"
        className="hero__cta"
        disabled={!valid}
        onClick={() => onContinue({ email, name: name || undefined })}
        style={{ opacity: valid ? 1 : 0.4, cursor: valid ? 'pointer' : 'not-allowed' }}
      >
        {t.cta}
      </button>
    </div>
  )
}
