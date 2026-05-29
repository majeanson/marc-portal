import { useState } from 'react'
import type { Lang } from '../../i18n'
import { DICT } from '../../i18n'
import { SectionEyebrow } from '../SectionEyebrow'

export interface Account {
  email: string
  name?: string
}

export function AccountStep({
  lang,
  initial,
  signedInAs,
  onContinue,
}: {
  lang: Lang
  initial: Partial<Account>
  signedInAs?: string
  onContinue: (acc: Account) => void
}) {
  const t = DICT[lang].intake.account
  const [email, setEmail] = useState(initial.email ?? '')
  const [name, setName] = useState(initial.name ?? '')
  // When signed-in, default to the confirmation card; the visitor can opt out
  // and switch to a different email via "Use a different email".
  const [useOther, setUseOther] = useState(false)
  const valid = /\S+@\S+\.\S+/.test(email)
  const loginHref = lang === 'en' ? '/en/login' : '/login'

  if (signedInAs && !useOther) {
    // Signed-in: the email already identifies the visitor and the name is
    // optional + editable later in the summary step (IntakeSummary's
    // EditableText). Asking again here is friction with no payoff — every
    // submission already lands tied to the account.
    return (
      <div className="intake__step intake__step--signed-in">
        <SectionEyebrow lang={lang} feature="intake">
          {t.signedInAsEyebrow}
        </SectionEyebrow>
        <div className="intake__signed-in-card">
          <div className="intake__signed-in-check" aria-hidden="true">
            ✓
          </div>
          <div className="intake__signed-in-body">
            <div className="intake__signed-in-label">{t.signedInAsTitle}</div>
            <div className="intake__signed-in-email mono">{signedInAs}</div>
          </div>
        </div>

        <p>{t.signedInAsBody}</p>

        <div className="intake__signed-in-actions">
          <button
            type="button"
            className="hero__cta"
            onClick={() => onContinue({ email: signedInAs, name: initial.name || undefined })}
          >
            {t.signedInAsCta}
          </button>
          <button
            type="button"
            className="link-btn mono"
            onClick={() => {
              setUseOther(true)
              setEmail('')
            }}
          >
            {t.signedInAsSwitch}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="intake__step">
      <SectionEyebrow lang={lang} feature="intake">
        {t.eyebrow}
      </SectionEyebrow>
      <h2>{t.title}</h2>
      <p>{t.body}</p>

      <p className="surface intake__signin">
        <span>{t.alreadyHaveAccount}</span>{' '}
        <a href={loginHref} className="intake__signin-link">
          {t.signIn}
        </a>
      </p>

      {/* Privacy hint moved above the inputs — non-tech visitors read the
          reassurance before they type, not after. */}
      <p className="field__hint field__hint--lede">{t.hint}</p>

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

      {/* Autosave reassurance — visible from the account step so visitors
          don't worry that closing the tab loses what they've typed. */}
      <p className="intake__autosave-note mono">{t.autosaveNote}</p>

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
