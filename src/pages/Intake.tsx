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

type Step = 'vibe' | 'account' | 'type' | 'form' | 'confirmation'

interface IntakeDraft {
  account?: Account
  type?: ProblemType
  formData: FormData
  submittedAt?: string
  waitlist?: boolean
}

const VIBE_FLAG = 'intake-vibe-accepted'
const DRAFT_KEY = 'intake-draft'

function emptyDraft(): IntakeDraft {
  return { formData: {} }
}

function pickStep(draft: IntakeDraft, vibeAccepted: boolean): Step {
  if (draft.submittedAt) return 'confirmation'
  if (!vibeAccepted) return 'vibe'
  if (!draft.account?.email) return 'account'
  if (!draft.type) return 'type'
  return 'form'
}

export function Intake({ lang }: { lang: Lang }) {
  const t = DICT[lang]
  const [draft, setDraft] = useState<IntakeDraft>(
    () => loadDraft<IntakeDraft>(DRAFT_KEY) ?? emptyDraft(),
  )
  const [step, setStep] = useState<Step>(() =>
    pickStep(loadDraft<IntakeDraft>(DRAFT_KEY) ?? emptyDraft(), flagSet(VIBE_FLAG)),
  )

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

  const onSubmit = () => {
    const submittedAt = new Date().toISOString().slice(0, 10)
    const waitlist = capacity.atCap
    const next = { ...draft, submittedAt, waitlist }
    setDraft(next)
    setStep('confirmation')
  }

  const onStartOver = () => {
    clearDraft(DRAFT_KEY)
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

            <ProgressDots step={step} lang={lang} />

            {step === 'vibe' && <VibeGate lang={lang} onAccept={onAcceptVibe} />}

            {step === 'account' && (
              <AccountStep lang={lang} initial={draft.account ?? {}} onContinue={onAccount} />
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

function ProgressDots({ step, lang }: { step: Step; lang: Lang }) {
  const t = DICT[lang].intake.steps
  const currentIdx = STEPS.indexOf(step)
  return (
    <ol className="intake__progress">
      {STEPS.map((s, i) => (
        <li
          key={s}
          className={`intake__progress-item${i <= currentIdx ? ' intake__progress-item--done' : ''}${i === currentIdx ? ' intake__progress-item--current' : ''}`}
        >
          <span className="mono">
            0{i + 1} · {t[s]}
          </span>
        </li>
      ))}
    </ol>
  )
}
