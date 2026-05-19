/**
 * /admin/runbook — the operator-side runbook surface.
 *
 * Three tabs:
 *   1. Dev + User — Track A + Track B in parallel (dependency mapping live)
 *   2. Template-as-product — Track C standalone (mirror of /template content)
 *   3. Decisions — strategic questions before selling the template
 *
 * Active tab is reflected in the URL via ?tab= so direct-linking works
 * ("/admin/runbook?tab=decisions") and back/forward navigation respects it.
 *
 * Track C on this page links out to the public /template version so the
 * operator can see the buyer-facing rendering at a glance.
 */

import { useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import type { Lang } from '../i18n'
import { RunbookParallel } from '../components/RunbookParallel'
import { Runbook } from '../components/Runbook'
import { RunbookDecisions } from '../components/RunbookDecisions'
import { trackC } from '../lib/runbook/trackC'
import { clearAllProgress } from '../lib/runbook/useProgress'

type Tab = 'parallel' | 'template' | 'decisions'

const TABS: { key: Tab; label: { fr: string; en: string } }[] = [
  { key: 'parallel', label: { fr: 'Dev + Visiteur', en: 'Dev + User' } },
  { key: 'template', label: { fr: 'Template à vendre', en: 'Template-as-product' } },
  { key: 'decisions', label: { fr: 'Décisions', en: 'Decisions' } },
]

const COPY = {
  fr: {
    eyebrow: 'runbook',
    title: 'Runbook opérateur',
    sub: 'Trois pistes. Reprise par un nouveau dev, parcours visiteur, et ce qu’il faut décider avant de vendre le template.',
    reset: 'Réinitialiser ma progression',
    resetConfirm: 'Effacer tous les cochés et toutes les réponses de décisions ?',
    publicLink: 'Voir Track C public sur /template',
  },
  en: {
    eyebrow: 'runbook',
    title: 'Operator runbook',
    sub: 'Three tracks. A new dev taking over, the user journey under them, and what you owe yourself before selling the template.',
    reset: 'Reset my progress',
    resetConfirm: 'Erase every check and every decision answer?',
    publicLink: 'See public Track C at /template',
  },
} as const

export function AdminRunbook({ lang }: { lang: Lang }) {
  const t = COPY[lang]
  const [params, setParams] = useSearchParams()
  const rawTab = params.get('tab') ?? 'parallel'
  const activeTab: Tab = isTab(rawTab) ? rawTab : 'parallel'

  useEffect(() => {
    document.title = `${t.title} — Marc`
  }, [t])

  function selectTab(tab: Tab) {
    const next = new URLSearchParams(params)
    if (tab === 'parallel') next.delete('tab')
    else next.set('tab', tab)
    setParams(next, { replace: false })
  }

  function onReset() {
    if (!window.confirm(t.resetConfirm)) return
    clearAllProgress()
    // Reload so every subscribed component re-reads from storage.
    window.location.reload()
  }

  const templateHref = lang === 'en' ? '/en/template' : '/template'

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

      <div className="admin-runbook__tabs" role="tablist" aria-label={t.title}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            id={`runbook-tab-${tab.key}`}
            aria-selected={activeTab === tab.key}
            aria-controls={`runbook-panel-${tab.key}`}
            tabIndex={activeTab === tab.key ? 0 : -1}
            className={`admin-runbook__tab${activeTab === tab.key ? ' admin-runbook__tab--active' : ''}`}
            onClick={() => selectTab(tab.key)}
          >
            {tab.label[lang]}
          </button>
        ))}
      </div>

      <div
        className="admin-runbook__panel"
        role="tabpanel"
        id={`runbook-panel-${activeTab}`}
        aria-labelledby={`runbook-tab-${activeTab}`}
      >
        {activeTab === 'parallel' && <RunbookParallel lang={lang} />}

        {activeTab === 'template' && (
          <>
            <div className="admin-runbook__public-link">
              <Link to={templateHref} target="_blank" rel="noreferrer">
                ↗ {t.publicLink}
              </Link>
            </div>
            <Runbook track={trackC} lang={lang} initialView="summary" />
          </>
        )}

        {activeTab === 'decisions' && <RunbookDecisions lang={lang} />}
      </div>
    </article>
  )
}

function isTab(value: string): value is Tab {
  return value === 'parallel' || value === 'template' || value === 'decisions'
}
