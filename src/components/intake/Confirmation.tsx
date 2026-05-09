import { useState } from 'react'
import type { Lang } from '../../i18n'
import { DICT } from '../../i18n'
import type { Account } from './AccountStep'
import type { ProblemType } from '../../lib/intakeSchemas'
import type { FormData } from './TypeForm'
import { IntakeSummary } from './IntakeSummary'

export function Confirmation({
  lang,
  account,
  type,
  values,
  waitlist,
  submittedAt,
  sessionId,
  magicLinkSent,
  onResendLink,
  onStartOver,
}: {
  lang: Lang
  account: Account
  type: ProblemType
  values: FormData
  waitlist: boolean
  submittedAt: string
  sessionId?: string
  magicLinkSent?: boolean
  onResendLink?: () => void | Promise<void>
  onStartOver: () => void
}) {
  const t = DICT[lang].intake.confirmation
  const sessionHref = sessionId ? `${lang === 'en' ? '/en' : ''}/session/${sessionId}` : null

  const [resending, setResending] = useState(false)
  const onResendClick = async () => {
    if (!onResendLink || resending) return
    setResending(true)
    try {
      await onResendLink()
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="intake__step">
      <div className="section__eyebrow">{waitlist ? t.eyebrowWaitlist : t.eyebrowAccepted}</div>
      <h2>{waitlist ? t.titleWaitlist : t.titleAccepted}</h2>
      <p>{waitlist ? t.bodyWaitlist : t.bodyAccepted}</p>

      <div className="confirmation__sla">
        <span className="mono" style={{ color: 'var(--accent-warm)' }}>
          {t.sla}
        </span>
      </div>

      {sessionHref && (
        <div className="confirmation__cta">
          <a className="hero__cta" href={sessionHref}>
            {t.sessionLinkLabel}
          </a>
          <p className="field__hint" style={{ marginTop: 8 }}>
            {t.sessionLinkHint}
          </p>
          <p className="field__hint" style={{ marginTop: 4 }}>
            {t.sessionEditHint}
          </p>
        </div>
      )}

      {magicLinkSent && !sessionHref && (
        <div className="confirmation__cta">
          <h3 style={{ marginBottom: 8 }}>{t.magicLinkSentTitle}</h3>
          <p>{t.magicLinkSentBody(account.email)}</p>
          {onResendLink && (
            <button
              type="button"
              className="link-btn mono"
              onClick={onResendClick}
              disabled={resending}
            >
              {resending ? t.submitting : t.magicLinkAgain}
            </button>
          )}
        </div>
      )}

      <section className="showcase-page__block">
        <IntakeSummary
          lang={lang}
          account={account}
          type={type}
          values={values}
          submittedAt={submittedAt}
        />
      </section>

      <button type="button" className="link-btn mono" onClick={onStartOver}>
        {t.startOver}
      </button>
    </div>
  )
}
