import { useState } from 'react'
import type { Lang } from '../../i18n'
import { DICT } from '../../i18n'
import type { Account } from './AccountStep'
import type { ProblemType } from '../../lib/intakeSchemas'
import type { FormData } from './TypeForm'
import type { SessionStatus } from '../../lib/sessionsApi'
import { IntakeSummary } from './IntakeSummary'
import { SessionStatusStrip } from './SessionStatusStrip'

export function Confirmation({
  lang,
  account,
  type,
  values,
  waitlist,
  submittedAt,
  sessionId,
  sessionStatus,
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
  /** Real status of the freshly-created session, threaded from the
   * createSession response. Falls back to 'draft' (the server's actual
   * default) if absent. */
  sessionStatus?: SessionStatus
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
      {/* One-shot success stamp — plays only on the "accepted" branch, not
          the waitlist branch (waitlist is good news but not "this is in
          motion"). Pure CSS animation on mount; @keyframes confirmation-
          stamp-land runs once. prefers-reduced-motion disables the motion
          but keeps the stamp visible. */}
      {!waitlist && (
        <div className="confirmation__stamp-wrap" aria-hidden="true">
          <svg
            className="confirmation__stamp"
            viewBox="0 0 260 100"
            focusable="false"
          >
            <g transform="translate(130 50) rotate(-7)">
              <rect
                x="-122"
                y="-42"
                width="244"
                height="84"
                rx="10"
                ry="10"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
              />
              <rect
                x="-114"
                y="-34"
                width="228"
                height="68"
                rx="6"
                ry="6"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <text
                x="0"
                y="-4"
                textAnchor="middle"
                fontFamily="var(--mono), monospace"
                fontSize="20"
                fontWeight="700"
                letterSpacing="4"
                fill="currentColor"
              >
                {lang === 'fr' ? 'REÇU' : 'RECEIVED'}
              </text>
              <text
                x="0"
                y="20"
                textAnchor="middle"
                fontFamily="var(--mono), monospace"
                fontSize="11"
                letterSpacing="5"
                fill="currentColor"
              >
                MARC · PORTAL
              </text>
            </g>
          </svg>
        </div>
      )}
      <div className="section__eyebrow">{waitlist ? t.eyebrowWaitlist : t.eyebrowAccepted}</div>
      <h2>{waitlist ? t.titleWaitlist : t.titleAccepted}</h2>
      <p>{waitlist ? t.bodyWaitlist : t.bodyAccepted}</p>

      <div className="confirmation__sla">
        <span className="mono" style={{ color: 'var(--accent-warm)' }}>
          {t.sla}
        </span>
      </div>

      {/* Continuity: once a session exists, show the same status strip the live
          session page renders so the visitor sees one consistent journey. The
          status comes from the createSession response (server defaults to
          'draft'); we fall back to 'draft' rather than guessing. */}
      {sessionHref && (
        <div className="confirmation__strip">
          <SessionStatusStrip lang={lang} status={sessionStatus ?? 'draft'} />
        </div>
      )}

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
        <>
          {/* Parked-intake strip — locked at draft, dimmed via .session-strip--parked
              so the visitor sees their intake hasn't vanished, just hasn't booted. */}
          <div className="confirmation__strip session-strip--parked">
            <SessionStatusStrip lang={lang} status="draft" />
            <p className="field__hint session-strip__parked-hint">{t.parkedStripHint}</p>
          </div>
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
        </>
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
