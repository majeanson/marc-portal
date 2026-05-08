import { useEffect, useMemo, useState } from 'react'
import type { Lang } from '../i18n'
import { DICT } from '../i18n'
import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import { VibeGate } from '../components/intake/VibeGate'
import { AccountStep } from '../components/intake/AccountStep'
import type { Account } from '../components/intake/AccountStep'
import { TypePicker } from '../components/intake/TypePicker'
import { TypeForm } from '../components/intake/TypeForm'
import type { FormData } from '../components/intake/TypeForm'
import { Confirmation } from '../components/intake/Confirmation'
import type { ProblemType } from '../lib/intakeSchemas'
import { getCapacity } from '../lib/capacity'
import { flagSet, flagWrite, loadDraft, saveDraft, clearDraft } from '../lib/draft'
import { useAuth } from '../lib/authContext'
import { createSession } from '../lib/sessionsApi'
import { ApiError } from '../lib/api'

type Step = 'vibe' | 'account' | 'type' | 'form' | 'confirmation'

interface IntakeDraft {
  account?: Account
  type?: ProblemType
  formData: FormData
  submittedAt?: string
  waitlist?: boolean
  /** Set after a successful createSession() call. */
  sessionId?: string
  /** True after a magic-link request succeeded for a non-logged-in visitor. */
  magicLinkSent?: boolean
}

const VIBE_FLAG = 'intake-vibe-accepted'
const DRAFT_KEY = 'intake-draft'
/** Stash key picked up by /me on first mount after magic-link login. */
export const PENDING_INTAKE_KEY = 'pending-intake'

export interface PendingIntake {
  intake: unknown
  email: string
  savedAt: string
}

function emptyDraft(): IntakeDraft {
  return { formData: {} }
}

function pickStep(draft: IntakeDraft, vibeAccepted: boolean, authEmail: string | null): Step {
  if (draft.submittedAt) return 'confirmation'
  if (!vibeAccepted) return 'vibe'
  // A signed-in visitor doesn't need to retype their email; carry the auth
  // identity into the next step automatically.
  if (!draft.account?.email && !authEmail) return 'account'
  if (!draft.type) return 'type'
  return 'form'
}

export function Intake({ lang }: { lang: Lang }) {
  const t = DICT[lang]
  const auth = useAuth()
  const [draft, setDraft] = useState<IntakeDraft>(
    () => loadDraft<IntakeDraft>(DRAFT_KEY) ?? emptyDraft(),
  )
  const [step, setStep] = useState<Step>(() =>
    pickStep(loadDraft<IntakeDraft>(DRAFT_KEY) ?? emptyDraft(), flagSet(VIBE_FLAG), null),
  )
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Effective account email — auth wins when the draft hasn't captured one yet.
  // Derived in render so we don't mutate state from inside an effect.
  const effectiveEmail = draft.account?.email ?? auth.email ?? ''
  const accountInitial: Account = {
    email: effectiveEmail,
    name: draft.account?.name,
  }

  // Autosave draft on every change
  useEffect(() => {
    saveDraft(DRAFT_KEY, draft)
  }, [draft])

  // Update meta
  useEffect(() => {
    document.documentElement.lang = t.langCode
    document.title = `${t.intake.pageTitle} — Marc`
    const meta = document.querySelector('meta[name="description"]')
    if (meta) meta.setAttribute('content', t.intake.metaDescription)
  }, [t])

  const capacity = useMemo(() => getCapacity(), [])

  const onAcceptVibe = () => {
    flagWrite(VIBE_FLAG, true)
    setStep(pickStep(draft, true, auth.email))
  }

  const onAccount = (acc: Account) => {
    const next = { ...draft, account: acc }
    setDraft(next)
    setStep(pickStep(next, true, auth.email))
  }

  const onPickType = (type: ProblemType) => {
    const prevType = draft.type
    const next: IntakeDraft = {
      ...draft,
      type,
      // Reset form data only if switching types
      formData: prevType === type ? draft.formData : {},
    }
    setDraft(next)
    setStep('form')
  }

  const onFormChange = (formData: FormData) => {
    setDraft({ ...draft, formData })
  }

  const onBack = () => {
    setStep('type')
  }

  const onJumpStep = (s: Step) => {
    // Progress dots are read-only after submission.
    if (draft.submittedAt) return
    setStep(s)
  }

  const onSubmit = async () => {
    if (submitting) return
    if (!draft.type) return
    // The signed-in path may not have a draft.account yet (we skip the step
    // when auth supplies the email). Fall back to the auth identity.
    const accountEmail = draft.account?.email ?? auth.email ?? ''
    if (!accountEmail) return
    const account: Account = draft.account ?? { email: accountEmail }

    setSubmitting(true)
    setSubmitError(null)

    const submittedAt = new Date().toISOString().slice(0, 10)
    const waitlist = capacity.atCap
    const intakePayload = {
      type: draft.type,
      account,
      formData: draft.formData,
      submittedAt,
      waitlist,
      lang,
    }

    // If the visitor is signed in (and is the same email), create the session
    // straight away. Otherwise fire a magic link and stash the intake so /me
    // can pick it up on first mount after sign-in.
    const isSameLoggedInUser =
      !!auth.email && auth.email.toLowerCase() === accountEmail.toLowerCase()

    if (isSameLoggedInUser) {
      try {
        const { session } = await createSession(intakePayload)
        const next: IntakeDraft = {
          ...draft,
          account,
          submittedAt,
          waitlist,
          sessionId: session.id,
          magicLinkSent: false,
        }
        setDraft(next)
        setStep('confirmation')
      } catch (err) {
        setSubmitError(
          err instanceof ApiError ? err.message : DICT[lang].intake.confirmation.submitError,
        )
      } finally {
        setSubmitting(false)
      }
      return
    }

    // Anonymous (or different-email) path: stash + magic link.
    try {
      const pending: PendingIntake = {
        intake: intakePayload,
        email: accountEmail,
        savedAt: new Date().toISOString(),
      }
      saveDraft(PENDING_INTAKE_KEY, pending)
      const sent = await auth.requestLink(accountEmail, lang)
      if (!sent) {
        // Network/API failure — keep the user on the form so they can retry.
        // The server itself returns 200 even on Resend soft-failures, so reaching
        // here means the request never landed (offline, server down).
        setSubmitError(DICT[lang].intake.confirmation.submitError)
        return
      }
      const next: IntakeDraft = {
        ...draft,
        account,
        submittedAt,
        waitlist,
        sessionId: undefined,
        magicLinkSent: true,
      }
      setDraft(next)
      setStep('confirmation')
    } catch {
      setSubmitError(DICT[lang].intake.confirmation.submitError)
    } finally {
      setSubmitting(false)
    }
  }

  const onResendLink = async () => {
    const target = draft.account?.email ?? auth.email
    if (!target) return
    await auth.requestLink(target, lang)
  }

  const onStartOver = () => {
    clearDraft(DRAFT_KEY)
    clearDraft(PENDING_INTAKE_KEY)
    flagWrite(VIBE_FLAG, false)
    const fresh = emptyDraft()
    setDraft(fresh)
    setStep('vibe')
  }

  return (
    <div className="app">
      <Header lang={lang} />
      <main id="main-content">
        <article className="section intake">
          <div className="section__inner">
            <a className="showcase-page__back" href={lang === 'fr' ? '/' : '/en'}>
              {t.intake.backHome}
            </a>

            <CapacityNotice lang={lang} atCap={capacity.atCap} />

            <ProgressDots step={step} lang={lang} onJump={onJumpStep} />

            {step === 'vibe' && <VibeGate lang={lang} onAccept={onAcceptVibe} />}

            {step === 'account' && (
              <AccountStep lang={lang} initial={accountInitial} onContinue={onAccount} />
            )}

            {step === 'type' && (
              <TypePicker lang={lang} selected={draft.type} onPick={onPickType} />
            )}

            {step === 'form' && draft.type && (
              <TypeForm
                lang={lang}
                type={draft.type}
                values={draft.formData}
                onChange={onFormChange}
                onBack={onBack}
                onContinue={onSubmit}
                submitting={submitting}
                submitError={submitError}
              />
            )}

            {step === 'confirmation' && draft.account && draft.type && draft.submittedAt && (
              <Confirmation
                lang={lang}
                account={draft.account}
                type={draft.type}
                values={draft.formData}
                waitlist={draft.waitlist ?? false}
                submittedAt={draft.submittedAt}
                sessionId={draft.sessionId}
                magicLinkSent={draft.magicLinkSent ?? false}
                onResendLink={onResendLink}
                onStartOver={onStartOver}
              />
            )}
          </div>
        </article>
      </main>
      <Footer lang={lang} />
    </div>
  )
}

function CapacityNotice({ lang, atCap }: { lang: Lang; atCap: boolean }) {
  const t = DICT[lang].intake.capacity
  if (!atCap) return null
  return <div className="intake__notice">{t.atCap}</div>
}

const STEPS: Step[] = ['vibe', 'account', 'type', 'form', 'confirmation']

function ProgressDots({
  step,
  lang,
  onJump,
}: {
  step: Step
  lang: Lang
  onJump?: (s: Step) => void
}) {
  const t = DICT[lang].intake.steps
  const currentIdx = STEPS.indexOf(step)
  const locked = step === 'confirmation'
  return (
    <ol className="intake__progress">
      {STEPS.map((s, i) => {
        // Vibe is a one-way gate; confirmation freezes the trail.
        const isJumpable = !!onJump && !locked && i < currentIdx && s !== 'vibe'
        const stepClass = `intake__progress-step${i <= currentIdx ? ' intake__progress-step--done' : ''}${i === currentIdx ? ' intake__progress-step--current' : ''}`
        const label = `0${i + 1} · ${t[s]}`
        return (
          <li key={s} className="intake__progress-item">
            {isJumpable ? (
              <button type="button" className={`${stepClass} mono`} onClick={() => onJump!(s)}>
                {label}
              </button>
            ) : (
              <span className={`${stepClass} mono`}>{label}</span>
            )}
          </li>
        )
      })}
    </ol>
  )
}
