/**
 * Single-track Runbook renderer. Shows one Track as a vertical timeline of
 * steps, with a summary/detail view toggle and a progress chip.
 *
 * Two visual modes:
 *   - summary: one row per step (number, title, time, checkbox, optional
 *     primary link). Fits the whole track on one screen for a 10-step list.
 *   - detail: the same row plus the expanded Why / How / Gotcha / Verify
 *     blocks. Each step can also be individually expanded in summary mode
 *     via a per-row chevron.
 *
 * Used by AdminRunbook (one tab per track) and the public Template page
 * (Track C only, with a sales-shaped intro card above).
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Lang } from '../i18n'
import { DICT } from '../i18n'
import type { Track, Step, Bi } from '../lib/runbook/types'
import { bi, biList } from '../lib/runbook/types'
import { useStepProgress, useCompletionCount, readStepProgress } from '../lib/runbook/useProgress'

type ViewMode = 'summary' | 'detail'

export interface RunbookProps {
  track: Track
  lang: Lang
  /** Initial view mode. Defaults to summary. */
  initialView?: ViewMode
  /**
   * When true, dependency callouts render in this track's rows. Used by the
   * standalone view (admin tab 2 = Track C) where dependencies are absolute.
   * The parallel view (A+B) renders dependency badges differently.
   */
  showDependencies?: boolean
}

export function Runbook({
  track,
  lang,
  initialView = 'summary',
  showDependencies = false,
}: RunbookProps) {
  const [view, setView] = useState<ViewMode>(initialView)
  const stepIds = track.steps.map((s) => s.id)
  const { done, total } = useCompletionCount(stepIds)

  return (
    <section className="runbook-track" aria-label={bi(track.title, lang)}>
      <header className="runbook-track__head">
        <div>
          <div className="section__eyebrow">{bi(track.eyebrow, lang)}</div>
          <h2 className="runbook-track__title">{bi(track.title, lang)}</h2>
          <p className="runbook-track__sub">{bi(track.sub, lang)}</p>
        </div>
        <div className="runbook-track__head-side">
          <ProgressChip done={done} total={total} lang={lang} />
          <ViewToggle view={view} setView={setView} lang={lang} />
        </div>
      </header>

      <ol className="runbook-steps">
        {track.steps.map((step) => (
          <RunbookStep
            key={step.id}
            step={step}
            lang={lang}
            forcedOpen={view === 'detail'}
            showDependencies={showDependencies}
          />
        ))}
      </ol>
    </section>
  )
}

function ProgressChip({ done, total, lang }: { done: number; total: number; lang: Lang }) {
  const label = DICT[lang].runbook.progress(done, total)
  return (
    <div className="runbook-chip mono" aria-live="polite">
      {label}
    </div>
  )
}

function ViewToggle({
  view,
  setView,
  lang,
}: {
  view: ViewMode
  setView: (v: ViewMode) => void
  lang: Lang
}) {
  const t = DICT[lang].runbook
  return (
    <div className="runbook-toggle" role="group" aria-label={t.viewLabel}>
      <button
        type="button"
        className={`runbook-toggle__btn${view === 'summary' ? ' runbook-toggle__btn--active' : ''}`}
        aria-pressed={view === 'summary'}
        onClick={() => setView('summary')}
      >
        {t.summary}
      </button>
      <button
        type="button"
        className={`runbook-toggle__btn${view === 'detail' ? ' runbook-toggle__btn--active' : ''}`}
        aria-pressed={view === 'detail'}
        onClick={() => setView('detail')}
      >
        {t.detail}
      </button>
    </div>
  )
}

interface StepRowProps {
  step: Step
  lang: Lang
  /** When the parent view is "detail", every row is open. */
  forcedOpen: boolean
  showDependencies: boolean
}

function RunbookStep({ step, lang, forcedOpen, showDependencies }: StepRowProps) {
  const t = DICT[lang].runbook
  const [open, setOpen] = useState(false)
  const isOpen = forcedOpen || open
  const [checked, toggle] = useStepProgress(step.id)
  const depBroken = showDependencies && step.dependsOn ? !readStepProgress(step.dependsOn) : false

  return (
    <li
      className={`surface runbook-step${checked ? ' runbook-step--done' : ''}${isOpen ? ' runbook-step--open' : ''}${depBroken ? ' runbook-step--dep-broken' : ''}`}
    >
      <div className="runbook-step__row">
        <label className="runbook-step__check">
          <input
            type="checkbox"
            checked={checked}
            onChange={toggle}
            aria-label={t.markDone(bi(step.title, lang))}
          />
        </label>
        <span className="runbook-step__num mono" aria-hidden="true">
          {step.num}
        </span>
        <div className="runbook-step__body">
          <div className="runbook-step__head">
            <h3 className="runbook-step__title">{bi(step.title, lang)}</h3>
            <div className="runbook-step__meta mono">
              <span>{step.time}</span>
              {step.tag && <span className="runbook-step__tag">{step.tag}</span>}
              {step.dependsOn && (
                <span
                  className={`runbook-step__dep${depBroken ? ' runbook-step__dep--broken' : ''}`}
                  title={t.dependsOn(step.dependsOn)}
                >
                  ↳ {step.dependsOn}
                </span>
              )}
            </div>
          </div>
          <p className="runbook-step__summary">{bi(step.summary, lang)}</p>
          {!forcedOpen && (
            <button
              type="button"
              className="runbook-step__expand"
              onClick={() => setOpen((p) => !p)}
              aria-expanded={isOpen}
            >
              {isOpen ? t.collapse : t.expand}
            </button>
          )}
        </div>
      </div>

      {isOpen && (
        <div className="runbook-step__detail">
          <DetailBlock label={t.why} kind="why" content={bi(step.why, lang)} />
          <DetailListBlock label={t.how} kind="how" items={biList(step.how, lang)} />
          <DetailListBlock label={t.gotcha} kind="gotcha" items={biList(step.gotcha, lang)} />
          <DetailBlock label={t.verify} kind="verify" content={bi(step.verify, lang)} />
          {step.link && <StepLink step={step} lang={lang} />}
        </div>
      )}
    </li>
  )
}

function DetailBlock({
  label,
  kind,
  content,
}: {
  label: string
  kind: 'why' | 'verify'
  content: string
}) {
  return (
    <div className={`runbook-detail runbook-detail--${kind}`}>
      <div className="runbook-detail__label mono">{label}</div>
      <p className="runbook-detail__body">{content}</p>
    </div>
  )
}

function DetailListBlock({
  label,
  kind,
  items,
}: {
  label: string
  kind: 'how' | 'gotcha'
  items: string[]
}) {
  if (items.length === 0) return null
  return (
    <div className={`runbook-detail runbook-detail--${kind}`}>
      <div className="runbook-detail__label mono">{label}</div>
      <ul className="runbook-detail__list">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  )
}

function StepLink({ step, lang }: { step: Step; lang: Lang }) {
  if (!step.link) return null
  const href = resolveHref(step.link.href, lang)
  const label = bi(step.link.label, lang)
  if (step.link.external) {
    return (
      <a className="runbook-step__link" href={href} target="_blank" rel="noreferrer">
        ↗ {label}
      </a>
    )
  }
  return (
    <Link className="runbook-step__link" to={href}>
      → {label}
    </Link>
  )
}

function resolveHref(href: Bi | string, lang: Lang): string {
  if (typeof href === 'string') return href
  return href[lang]
}
