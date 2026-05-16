import { useEffect, useState } from 'react'
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
import { flagSet, flagWrite, loadDraft, saveDraft, clearDraft } from '../lib/draft'
import { useAuth } from '../lib/authContext'
import {
  createSession,
  getCapacityLive,
  getIntakeDraft,
  saveIntakeDraft,
  clearIntakeDraft,
  type SessionStatus,
} from '../lib/sessionsApi'
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
  /** Status of the freshly-created session, captured from the createSession
   * response so the confirmation strip reflects truth instead of guessing. */
  sessionStatus?: SessionStatus
  /** True after a magic-link request succeeded for a non-logged-in visitor. */
  magicLinkSent?: boolean
}

const VIBE_FLAG = 'intake-vibe-accepted'
const DRAFT_KEY = 'intake-draft'
/** Stash key picked up by /me on first mount after magic-link login. */
export const PENDING_INTAKE_KEY = 'pending-intake'
/** Stash key written by /napkin (Excalidraw page) when the visitor sends a
 * sketch to the intake. Picked up here on mount; cleared on successful
 * submit so the next intake start doesn't accidentally carry stale art. */
const NAPKIN_KEY = 'napkin-sketch'

interface NapkinSketch {
  png: string
  text: string
  savedAt: string
}

export interface PendingIntake {
  intake: unknown
  email: string
  savedAt: string
}

function emptyDraft(): IntakeDraft {
  return { formData: {} }
}

function pickStep(draft: IntakeDraft, vibeAccepted: boolean): Step {
  if (draft.submittedAt) return 'confirmation'
  if (!vibeAccepted) return 'vibe'
  // Even when signed-in, surface the account step once so the visitor sees a
  // visible "Signed in as X" confirmation and can opt to use a different
  // email. AccountStep auto-advances draft.account on Continue, after which
  // this guard skips the step on subsequent navigations.
  if (!draft.account?.email) return 'account'
  if (!draft.type) return 'type'
  return 'form'
}

/** Tab-scoped flag — once the visitor has made an explicit choice
 * (continue vs fresh) for the current draft, we don't re-prompt on
 * every back-and-forth nav within the same browser session. Cleared on
 * tab close, which is the right moment to re-ask: a brand-new visit
 * shouldn't silently auto-load a months-old draft. */
const DRAFT_PROMPT_DISMISS_KEY = 'marc-portal:intake-draft-prompt-dismissed'

function draftIsMeaningful(d: IntakeDraft | null | undefined): boolean {
  if (!d) return false
  // Already-submitted drafts aren't candidates: the form will jump
  // straight to confirmation regardless of the prompt.
  if (d.submittedAt) return false
  if (d.type) return true
  if (d.account?.email) return true
  if (d.formData && Object.keys(d.formData).length > 0) return true
  return false
}

export function Intake({ lang }: { lang: Lang }) {
  const t = DICT[lang]
  const auth = useAuth()
  const [draft, setDraft] = useState<IntakeDraft>(
    () => loadDraft<IntakeDraft>(DRAFT_KEY) ?? emptyDraft(),
  )
  const [step, setStep] = useState<Step>(() =>
    pickStep(loadDraft<IntakeDraft>(DRAFT_KEY) ?? emptyDraft(), flagSet(VIBE_FLAG)),
  )
  const [draftPromptOpen, setDraftPromptOpen] = useState<boolean>(() => {
    try {
      if (sessionStorage.getItem(DRAFT_PROMPT_DISMISS_KEY) === '1') return false
    } catch {
      // sessionStorage unavailable — fall through, we'll just prompt.
    }
    return draftIsMeaningful(loadDraft<IntakeDraft>(DRAFT_KEY))
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  // Napkin: lazily read once on mount. The /napkin page writes it; we ship
  // it as part of intakeJson on submit and clear it on success.
  const [napkin, setNapkin] = useState<NapkinSketch | null>(() =>
    loadDraft<NapkinSketch>(NAPKIN_KEY),
  )

  // Effective account email — auth wins when the draft hasn't captured one yet.
  // Derived in render so we don't mutate state from inside an effect.
  const effectiveEmail = draft.account?.email ?? auth.email ?? ''
  const accountInitial: Account = {
    email: effectiveEmail,
    name: draft.account?.name,
  }

  // Autosave draft on every change. localStorage is always written; the
  // server-side mirror only kicks in when the visitor is signed in (cross-
  // device resume — they may sign in on phone, open the magic link on desktop).
  // Both paths are best-effort.
  useEffect(() => {
    saveDraft(DRAFT_KEY, draft)
    if (!auth.email) return
    // Debounce the server write so a flurry of keystrokes doesn't hammer D1.
    const handle = setTimeout(() => {
      saveIntakeDraft({ draft, lang }).catch(() => {
        // Network blip — localStorage is still authoritative.
      })
    }, 800)
    return () => clearTimeout(handle)
  }, [draft, auth.email, lang])

  // Update meta
  useEffect(() => {
    document.documentElement.lang = t.langCode
    document.title = `${t.intake.pageTitle} — Marc`
    const meta = document.querySelector('meta[name="description"]')
    if (meta) meta.setAttribute('content', t.intake.metaDescription)
  }, [t])

  // Cross-device resume: when signed-in and our local draft is empty (the
  // visitor may have arrived from a magic link on a different browser), pull
  // the server-side draft if one exists. Local autosave still writes through.
  useEffect(() => {
    if (!auth.email) return
    const localDraft = loadDraft<IntakeDraft>(DRAFT_KEY) ?? emptyDraft()
    const localIsEmpty =
      !localDraft.type && Object.keys(localDraft.formData ?? {}).length === 0 && !localDraft.account
    if (!localIsEmpty) return
    let cancelled = false
    getIntakeDraft<{ draft: IntakeDraft; lang: Lang }>()
      .then((res) => {
        if (cancelled || !res.draft) return
        const recovered = res.draft.payload?.draft
        if (recovered) {
          setDraft(recovered)
          setStep(pickStep(recovered, flagSet(VIBE_FLAG)))
        }
      })
      .catch(() => {
        // Best-effort.
      })
    return () => {
      cancelled = true
    }
  }, [auth.email])

  // Live capacity: null until the first /api/capacity response. We default to
  // "not at cap" for first paint so the form is interactive; the badge appears
  // once the real number arrives. The server is the structural enforcer (POST
  // /sessions returns 409 when at cap) — this state only drives copy.
  const [atCap, setAtCap] = useState<boolean>(false)
  useEffect(() => {
    let cancelled = false
    getCapacityLive()
      .then((c) => {
        if (!cancelled) setAtCap(c.atCap)
      })
      .catch(() => {
        // Stay optimistic on network failure; the server will still 409 if at cap.
      })
    return () => {
      cancelled = true
    }
  }, [])

  const onAcceptVibe = () => {
    flagWrite(VIBE_FLAG, true)
    setStep(pickStep(draft, true))
  }

  const onAccount = (acc: Account) => {
    const next = { ...draft, account: acc }
    setDraft(next)
    setStep(pickStep(next, true))
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
    const waitlist = atCap
    const intakePayload = {
      type: draft.type,
      account,
      formData: draft.formData,
      submittedAt,
      waitlist,
      lang,
      // If the visitor came in via /napkin, ship the sketch + caption with the
      // intake. Stored inline in session.intake_json — Marc can render it in
      // the session detail view. Cleared from localStorage on success below.
      napkin: napkin ? { png: napkin.png, text: napkin.text, savedAt: napkin.savedAt } : undefined,
    }

    // If the visitor is signed in (and is the same email), create the session
    // straight away. Otherwise fire a magic link and stash the intake so /me
    // can pick it up on first mount after sign-in.
    const isSameLoggedInUser =
      !!auth.email && auth.email.toLowerCase() === accountEmail.toLowerCase()

    if (isSameLoggedInUser) {
      try {
        const { session } = await createSession(intakePayload)
        // Successful submit — drop the server-side draft (best-effort), and
        // discard the napkin: it's in the session now.
        clearIntakeDraft().catch(() => {})
        if (napkin) {
          clearDraft(NAPKIN_KEY)
          setNapkin(null)
        }
        const next: IntakeDraft = {
          ...draft,
          account,
          submittedAt,
          waitlist,
          sessionId: session.id,
          sessionStatus: session.status,
          magicLinkSent: false,
        }
        setDraft(next)
        setStep('confirmation')
      } catch (err) {
        // 409 = bedrock cap hit. We still take the visitor to confirmation but
        // flip them to the waitlist branch — the message they see is "I'm at
        // capacity right now; you're on the list." No session row was created.
        if (err instanceof ApiError && err.status === 409) {
          setAtCap(true)
          const next: IntakeDraft = {
            ...draft,
            account,
            submittedAt,
            waitlist: true,
            sessionId: undefined,
            magicLinkSent: false,
          }
          setDraft(next)
          setStep('confirmation')
        } else {
          setSubmitError(
            err instanceof ApiError ? err.message : DICT[lang].intake.confirmation.submitError,
          )
        }
      } finally {
        setSubmitting(false)
      }
      return
    }

    // Anonymous (or different-email) path: stash + magic link. The napkin
    // travels inside intakePayload, so it persists across the magic-link
    // round-trip alongside the rest of the intake.
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
    clearDraft(NAPKIN_KEY)
    flagWrite(VIBE_FLAG, false)
    const fresh = emptyDraft()
    setDraft(fresh)
    setNapkin(null)
    setStep('vibe')
  }

  function dismissDraftPrompt() {
    setDraftPromptOpen(false)
    try {
      sessionStorage.setItem(DRAFT_PROMPT_DISMISS_KEY, '1')
    } catch {
      // sessionStorage may be blocked — the prompt would re-fire on
      // next mount in that case, which is acceptable.
    }
  }

  const onContinueDraft = () => {
    // Nothing to restore — the draft is already loaded into state.
    // Just close the prompt and let the form render.
    dismissDraftPrompt()
  }

  const onStartFreshDraft = () => {
    // Like onStartOver but keeps the vibe flag — no need to re-gate
    // someone who already accepted; they're just dropping in-progress
    // form data on the same device.
    clearDraft(DRAFT_KEY)
    clearDraft(NAPKIN_KEY)
    const fresh = emptyDraft()
    setDraft(fresh)
    setNapkin(null)
    setStep(flagSet(VIBE_FLAG) ? 'account' : 'vibe')
    dismissDraftPrompt()
  }

  function formatDraftSavedAt(): string | null {
    // Best-effort timestamp surfaced in the prompt so the visitor can
    // gauge whether the draft is recent or stale.
    const raw = draft.submittedAt ?? null
    // The autosaved draft doesn't carry its own savedAt — we only have
    // submittedAt (set on submit) which is empty mid-flow. Fall back to
    // a rough "earlier today" via napkin.savedAt if present, else null.
    if (raw) return raw
    if (napkin?.savedAt) return napkin.savedAt
    return null
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

            <CapacityNotice lang={lang} atCap={atCap} />

            {draftPromptOpen && (
              <aside className="intake__draft-prompt" role="dialog" aria-live="polite">
                <h2 className="intake__draft-prompt-title">{t.intake.draftPrompt.title}</h2>
                <p className="intake__draft-prompt-body">{t.intake.draftPrompt.body}</p>
                {formatDraftSavedAt() && (
                  <p className="intake__draft-prompt-meta mono">
                    {t.intake.draftPrompt.summary(formatDraftSavedAt() as string)}
                  </p>
                )}
                <div className="intake__draft-prompt-actions">
                  <button
                    type="button"
                    className="hero__cta intake__draft-prompt-continue"
                    onClick={onContinueDraft}
                  >
                    {t.intake.draftPrompt.continueBtn}
                  </button>
                  <button
                    type="button"
                    className="link-btn mono intake__draft-prompt-fresh"
                    onClick={onStartFreshDraft}
                  >
                    {t.intake.draftPrompt.freshBtn}
                  </button>
                </div>
              </aside>
            )}

            {napkin && step !== 'confirmation' && (
              <NapkinAttachedBadge
                lang={lang}
                napkin={napkin}
                onRemove={() => {
                  clearDraft(NAPKIN_KEY)
                  setNapkin(null)
                }}
              />
            )}

            <ProgressDots step={step} lang={lang} onJump={onJumpStep} />

            {step === 'vibe' && <VibeGate lang={lang} onAccept={onAcceptVibe} />}

            {step === 'account' && (
              <AccountStep
                lang={lang}
                initial={accountInitial}
                signedInAs={auth.email ?? undefined}
                onContinue={onAccount}
              />
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
                sessionStatus={draft.sessionStatus}
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

/**
 * Banner shown across the intake when a napkin sketch has been attached
 * (visitor came in via /napkin). Renders a thumbnail of the PNG so the
 * visitor sees "yes, your drawing is here"; the Remove button clears the
 * stash if they change their mind.
 */
function NapkinAttachedBadge({
  lang,
  napkin,
  onRemove,
}: {
  lang: Lang
  napkin: NapkinSketch
  onRemove: () => void
}) {
  const t = DICT[lang].napkin
  return (
    <div className="napkin-badge" role="status">
      {napkin.png ? (
        // Display the PNG inline. Data URLs are ~50-500 KB; the browser
        // decodes once and the layout doesn't shift.
        <img src={napkin.png} alt="" className="napkin-badge__thumb" />
      ) : (
        <div className="napkin-badge__thumb napkin-badge__thumb--empty" aria-hidden="true">
          ✎
        </div>
      )}
      <div className="napkin-badge__body">
        <span className="napkin-badge__title">{t.pillAttached}</span>
        {napkin.text && <span className="napkin-badge__text">{napkin.text}</span>}
      </div>
      <button
        type="button"
        className="napkin-badge__remove mono"
        onClick={onRemove}
        aria-label={t.pillRemove}
      >
        {t.pillRemove} ✕
      </button>
    </div>
  )
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
