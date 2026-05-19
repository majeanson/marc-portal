/**
 * /admin/runbook — operator's two-track runbook.
 *
 * Renders Track A (dev handoff) and Track B (user journey) side-by-side
 * via <RunbookParallel/>. Track B steps with a `dependsOn` link to Track A
 * get a red flag when their prerequisite is unchecked, making silent
 * handoff gaps visible.
 *
 * Per-step progress is browser-local (localStorage). The reset button
 * wipes every check in one shot.
 */

import { useEffect } from 'react'
import type { Lang } from '../i18n'
import { RunbookParallel } from '../components/RunbookParallel'
import { clearAllProgress } from '../lib/runbook/useProgress'

const COPY = {
  fr: {
    eyebrow: 'runbook',
    title: 'Runbook opérateur',
    sub: 'Deux pistes parallèles : un nouveau dev qui reprend le portail (A), et un visiteur qui traverse l’app sous sa direction (B). Coche en A → débloque B. Rangée rouge = bris silencieux à venir.',
    reset: 'Réinitialiser ma progression',
    resetConfirm: 'Effacer tous les cochés ?',
  },
  en: {
    eyebrow: 'runbook',
    title: 'Operator runbook',
    sub: 'Two parallel tracks: a new dev taking over the portal (A), and a visitor walking through under them (B). Check off in A → unblock B. Red row = silent breakage waiting to happen.',
    reset: 'Reset my progress',
    resetConfirm: 'Erase every check?',
  },
} as const

export function AdminRunbook({ lang }: { lang: Lang }) {
  const t = COPY[lang]

  useEffect(() => {
    document.title = `${t.title} — Marc`
  }, [t])

  function onReset() {
    if (!window.confirm(t.resetConfirm)) return
    clearAllProgress()
    window.location.reload()
  }

  return (
    <article className="admin-runbook">
      <header className="admin-page__head admin-runbook__head">
        <div>
          <div className="section__eyebrow">{t.eyebrow}</div>
          <h1>{t.title}</h1>
          <p>{t.sub}</p>
        </div>
        <button type="button" className="runbook-reset mono" onClick={onReset}>
          ↺ {t.reset}
        </button>
      </header>

      <RunbookParallel lang={lang} />
    </article>
  )
}
