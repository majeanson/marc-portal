/**
 * /admin/today — single-glance operator dashboard.
 *
 * Answers "what do I need to do today?" without making Marc click through
 * five admin surfaces to reconstruct state. Each section corresponds to a
 * specific failure mode the daily digest, the inbox or the custodian board
 * surface on their own — here they're collapsed onto one page so the
 * triage decision ("what's most urgent right now?") happens by eye.
 *
 * Single round-trip: everything below the header reads from one
 * /api/admin/today payload, computed server-side from sessions + messages +
 * payments + email signals.
 *
 * Routing: mounted inside the Admin shell (Admin.tsx <Outlet/>), so the
 * operator sidebar (Console / Showcase / Audit / Runbook / Today) renders
 * around it.
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Lang } from '../i18n'
import {
  getToday,
  type CustodianAlertsEntry,
  type NextAction,
  type OverduePaymentEntry,
  type SlaBreachEntry,
  type SystemHealthEntry,
  type TodayResponse,
  type TodaySessionEntry,
  type UnansweredMessageEntry,
} from '../lib/todayApi'
import { formatCadCents, formatRelativeWindow } from '../lib/format'

// Operator-only surface — inline COPY block per the i18n convention.
// FR is Québécois register (not France), matching the rest of the admin
// surfaces (see CLAUDE.md "House voice — copy").
const COPY = {
  fr: {
    eyebrow: 'console',
    title: 'Aujourd’hui',
    sub: 'Tout ce qui demande ton attention, en une page. Capacité, sessions vivantes, paiements en retard, messages en attente, santé du système, dépositaires.',
    loading: 'Chargement…',
    failed: 'Impossible de charger le tableau. Recharger ?',
    refresh: 'Recharger',
    refreshed: (s: string) => `Mis à jour ${s}`,

    capacityHeading: 'Capacité',
    capacityActive: 'Actif',
    capacityTriage: 'Triage',
    capacityNote:
      'Plafond : 1 actif + 1 en triage. Le serveur refuse toute promotion qui dépasserait.',

    sessionsHeading: 'Sessions vivantes',
    sessionsEmpty: 'Aucune session vivante. Pas de feu, profite.',
    open: 'Ouvrir →',
    waitingFor: 'Visiteur en attente',
    lastReply: 'Dernier mot',
    paid: 'payée',
    pending: 'à payer',
    failed_: 'échouée',
    notePrefix: 'Note',

    overdueHeading: 'Paiements en retard',
    overdueIntro:
      'Tranche de construction non payée depuis plus de 7 jours. Un mot rapide au visiteur règle souvent la chose.',
    overdueEmpty: 'Aucun retard.',

    slaHeading: 'SLA dépassé',
    slaIntro:
      'Brouillon ou triage de plus de 72 h. C’est la promesse faite dans la copie de l’intake.',
    slaEmpty: 'Tout est dans les temps.',

    unansweredHeading: 'Messages sans réponse',
    unansweredIntro: 'Le visiteur a écrit, tu n’as pas encore répondu.',
    unansweredEmpty: 'Boîte vide.',

    healthHeading: 'Santé du système',
    healthOutbox: 'Outbox',
    healthOutboxPending: 'en attente',
    healthOutboxStuck: 'bloquées',
    healthEmail: 'Courriel (7 j)',
    healthBounces: 'bounces',
    healthComplaints: 'plaintes',
    healthAlerts: 'Alertes opérateur ouvertes',
    healthAllGood: 'Rien à signaler.',
    digestStaleHeading: 'Cron quotidien — silencieux',
    digestStaleNever:
      'Le digest quotidien n’a jamais signalé son passage. Vérifie cron-job.org : le job est-il toujours actif ?',
    digestStaleAgo: (s: string) =>
      `Le digest quotidien n’a pas signalé son passage depuis ${s}. Cron-job.org est probablement en panne ou désactivé.`,

    custodianHeading: 'Dépositaires',
    custodianPastDueHeading: 'Paiement en retard',
    custodianRecentHeading: 'Basculés récemment vers « tout à toi »',
    custodianPastDueEmpty: 'Aucun.',
    custodianRecentEmpty: 'Aucun depuis 30 j.',

    severity: {
      urgent: 'urgent',
      warn: 'attention',
      info: 'à savoir',
      muted: 'ok',
    } as const,
    statusLabel: {
      draft: 'brouillon',
      triage: 'triage',
      active: 'actif',
      shipped: 'livré',
      rejected: 'refusé',
    } as const,
    days: (n: number) => `${n} j`,
    hours: (n: number) => `${n} h`,
  },
  en: {
    eyebrow: 'console',
    title: 'Today',
    sub: 'Everything waiting on you, in one view. Capacity, live sessions, overdue payments, unanswered messages, system health, custodians.',
    loading: 'Loading…',
    failed: 'Could not load the dashboard. Try again?',
    refresh: 'Reload',
    refreshed: (s: string) => `Updated ${s}`,

    capacityHeading: 'Capacity',
    capacityActive: 'Active',
    capacityTriage: 'Triage',
    capacityNote:
      'Cap: 1 active + 1 in triage. The server rejects any promotion that would overflow.',

    sessionsHeading: 'Live sessions',
    sessionsEmpty: 'No live sessions. Quiet day.',
    open: 'Open →',
    waitingFor: 'Visitor waiting',
    lastReply: 'Last reply',
    paid: 'paid',
    pending: 'to pay',
    failed_: 'failed',
    notePrefix: 'Note',

    overdueHeading: 'Overdue payments',
    overdueIntro:
      'Build installment unpaid for over 7 days. A quick note to the visitor usually sorts it.',
    overdueEmpty: 'None overdue.',

    slaHeading: 'SLA breached',
    slaIntro: 'Draft or triage older than 72 h — the promise made in the intake copy.',
    slaEmpty: 'Everything within SLA.',

    unansweredHeading: 'Unanswered messages',
    unansweredIntro: 'The visitor wrote, you haven’t replied yet.',
    unansweredEmpty: 'Inbox is clear.',

    healthHeading: 'System health',
    healthOutbox: 'Outbox',
    healthOutboxPending: 'pending',
    healthOutboxStuck: 'stuck',
    healthEmail: 'Email (7 d)',
    healthBounces: 'bounces',
    healthComplaints: 'complaints',
    healthAlerts: 'Open operator alerts',
    healthAllGood: 'All quiet.',
    digestStaleHeading: 'Daily cron — silent',
    digestStaleNever:
      'The daily digest has never reported a run. Check cron-job.org — is the job still active?',
    digestStaleAgo: (s: string) =>
      `The daily digest hasn't reported a run for ${s}. Cron-job.org is probably down or disabled.`,

    custodianHeading: 'Custodians',
    custodianPastDueHeading: 'Past due',
    custodianRecentHeading: 'Recently switched to "all yours"',
    custodianPastDueEmpty: 'None.',
    custodianRecentEmpty: 'None in last 30 d.',

    severity: {
      urgent: 'urgent',
      warn: 'heads-up',
      info: 'fyi',
      muted: 'ok',
    } as const,
    statusLabel: {
      draft: 'draft',
      triage: 'triage',
      active: 'active',
      shipped: 'shipped',
      rejected: 'declined',
    } as const,
    days: (n: number) => `${n} d`,
    hours: (n: number) => `${n} h`,
  },
} as const

type CopyT = (typeof COPY)[Lang]

function formatAge(seconds: number, t: CopyT): string {
  if (seconds < 0) seconds = 0
  if (seconds < 3600) return `${Math.max(1, Math.round(seconds / 60))} min`
  if (seconds < 24 * 3600) return t.hours(Math.round(seconds / 3600))
  return t.days(Math.round(seconds / (24 * 3600)))
}

function formatStamp(unix: number, lang: Lang): string {
  return new Date(unix * 1000).toLocaleString(lang === 'fr' ? 'fr-CA' : 'en-CA', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

export function AdminToday({ lang }: { lang: Lang }) {
  const t = COPY[lang]
  const langPrefix = lang === 'en' ? '/en' : ''
  const [data, setData] = useState<TodayResponse | null>(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    setError(false)
    try {
      const r = await getToday()
      setData(r)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    document.title = `${t.title} — Marc`
  }, [t])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await getToday()
        if (!cancelled) setData(r)
      } catch {
        if (!cancelled) setError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Tab-visible refresh — a stale dashboard at 11pm is the wrong promise.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  return (
    <article className="admin-today">
      <header className="admin-page__head">
        <div className="section__eyebrow">{t.eyebrow}</div>
        <h1>{t.title}</h1>
        <p>{t.sub}</p>
        <div className="admin-page__head-actions">
          <button
            type="button"
            className="link-btn mono"
            onClick={() => void load()}
            disabled={loading}
          >
            {loading ? t.loading : `↺ ${t.refresh}`}
          </button>
          {data && (
            <span className="mono admin-today__stamp">
              {t.refreshed(formatStamp(data.generatedAtS, lang))}
            </span>
          )}
        </div>
      </header>

      {error && (
        <div className="admin-today__error" role="alert">
          <p>{t.failed}</p>
          <button type="button" className="link-btn mono" onClick={() => void load()}>
            {t.refresh}
          </button>
        </div>
      )}

      {!data && loading && !error && (
        <p className="admin-today__loading mono" aria-busy="true">
          {t.loading}
        </p>
      )}

      {data && (
        <>
          <CapacityPanel lang={lang} t={t} health={data.systemHealth} />
          <LiveSessionsPanel
            lang={lang}
            t={t}
            entries={data.sessions}
            langPrefix={langPrefix}
            nowMs={data.generatedAtS * 1000}
          />
          <OverduePaymentsPanel
            lang={lang}
            t={t}
            rows={data.overduePayments}
            langPrefix={langPrefix}
          />
          <SlaBreachesPanel t={t} rows={data.slaBreaches} langPrefix={langPrefix} />
          <UnansweredPanel t={t} rows={data.unansweredMessages} langPrefix={langPrefix} />
          <SystemHealthPanel
            t={t}
            health={data.systemHealth}
            lang={lang}
            nowMs={data.generatedAtS * 1000}
          />
          <CustodianPanel t={t} alerts={data.custodianAlerts} langPrefix={langPrefix} />
        </>
      )}
    </article>
  )
}

// ─── Panels ─────────────────────────────────────────────────────────────

function CapacityPanel({ lang, t, health }: { lang: Lang; t: CopyT; health: SystemHealthEntry }) {
  const { active, triage, activeCap, triageCap } = health.capacity
  return (
    <section className="surface admin-today__panel">
      <h2 className="admin-today__panel-title mono">{t.capacityHeading}</h2>
      <div className="admin-today__capacity">
        <CapacityCell label={t.capacityActive} n={active} cap={activeCap} lang={lang} />
        <CapacityCell label={t.capacityTriage} n={triage} cap={triageCap} lang={lang} />
      </div>
      <p className="admin-today__panel-note">{t.capacityNote}</p>
    </section>
  )
}

function CapacityCell({
  label,
  n,
  cap,
  lang,
}: {
  label: string
  n: number
  cap: number
  lang: Lang
}) {
  const full = n >= cap
  return (
    <div className={`surface admin-today__cap-cell${full ? ' admin-today__cap-cell--full' : ''}`}>
      <div className="mono admin-today__cap-label">{label}</div>
      <div className="admin-today__cap-figure">
        {n}
        <span className="admin-today__cap-cap" aria-label={lang === 'en' ? 'of' : 'sur'}>
          /{cap}
        </span>
      </div>
    </div>
  )
}

function LiveSessionsPanel({
  lang,
  t,
  entries,
  langPrefix,
  nowMs,
}: {
  lang: Lang
  t: CopyT
  entries: TodaySessionEntry[]
  langPrefix: string
  nowMs: number
}) {
  return (
    <section className="surface admin-today__panel">
      <h2 className="admin-today__panel-title mono">
        {t.sessionsHeading} <span className="admin-today__count">({entries.length})</span>
      </h2>
      {entries.length === 0 ? (
        <p className="admin-today__empty">{t.sessionsEmpty}</p>
      ) : (
        <ul className="admin-today__sessions">
          {entries.map((e) => (
            <SessionRow
              key={e.session.id}
              entry={e}
              lang={lang}
              t={t}
              langPrefix={langPrefix}
              nowMs={nowMs}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function SessionRow({
  entry,
  lang,
  t,
  langPrefix,
  nowMs,
}: {
  entry: TodaySessionEntry
  lang: Lang
  t: CopyT
  langPrefix: string
  nowMs: number
}) {
  const { session: s, nextAction, lastVisitorMessageAt, lastMarcMessageAt } = entry
  const href = `${langPrefix}/session/${s.id}`
  const statusLabel = t.statusLabel[s.status]
  const lastMsg =
    lastVisitorMessageAt && (lastMarcMessageAt === null || lastMarcMessageAt < lastVisitorMessageAt)
      ? {
          label: t.waitingFor,
          atS: lastVisitorMessageAt,
          urgent: true,
        }
      : lastMarcMessageAt
        ? { label: t.lastReply, atS: lastMarcMessageAt, urgent: false }
        : null
  return (
    <li className={`surface admin-today__session admin-today__session--${nextAction.severity}`}>
      <Link to={href} className="admin-today__session-link">
        <div className="admin-today__session-head">
          <span className="mono admin-today__session-status">{statusLabel}</span>
          <NextActionPill action={nextAction} lang={lang} />
        </div>
        <div className="admin-today__session-email mono">{s.email}</div>
        <p className="admin-today__session-hint">
          {lang === 'fr' ? nextAction.hint_fr : nextAction.hint_en}
        </p>
        <div className="admin-today__session-meta">
          {lastMsg && (
            <span
              className={`mono${lastMsg.urgent ? ' admin-today__session-waiting' : ''}`}
              title={formatStamp(lastMsg.atS, lang)}
            >
              {lastMsg.label}: {formatRelativeWindow(lastMsg.atS * 1000 - nowMs, lang)}
            </span>
          )}
          {(entry.paidBuildLegs > 0 || entry.pendingBuildLegs > 0 || entry.failedBuildLegs > 0) && (
            <span className="mono admin-today__session-pay">
              {entry.paidBuildLegs > 0 && (
                <span className="admin-today__pay-tag admin-today__pay-tag--paid">
                  {entry.paidBuildLegs} {t.paid}
                </span>
              )}
              {entry.pendingBuildLegs > 0 && (
                <span className="admin-today__pay-tag admin-today__pay-tag--pending">
                  {entry.pendingBuildLegs} {t.pending}
                </span>
              )}
              {entry.failedBuildLegs > 0 && (
                <span className="admin-today__pay-tag admin-today__pay-tag--failed">
                  {entry.failedBuildLegs} {t.failed_}
                </span>
              )}
            </span>
          )}
          <span className="admin-today__session-open mono">{t.open}</span>
        </div>
        {entry.noteSnippet && (
          <p className="admin-today__session-note">
            <span className="mono admin-today__session-note-tag">{t.notePrefix}</span>{' '}
            {entry.noteSnippet}
          </p>
        )}
      </Link>
    </li>
  )
}

function NextActionPill({ action, lang }: { action: NextAction; lang: Lang }) {
  const label = lang === 'fr' ? action.label_fr : action.label_en
  return (
    <span className={`admin-today__action-pill admin-today__action-pill--${action.severity} mono`}>
      {label}
    </span>
  )
}

function OverduePaymentsPanel({
  lang,
  t,
  rows,
  langPrefix,
}: {
  lang: Lang
  t: CopyT
  rows: OverduePaymentEntry[]
  langPrefix: string
}) {
  return (
    <section className="surface admin-today__panel">
      <h2 className="admin-today__panel-title mono">
        {t.overdueHeading} <span className="admin-today__count">({rows.length})</span>
      </h2>
      <p className="admin-today__panel-note">{t.overdueIntro}</p>
      {rows.length === 0 ? (
        <p className="admin-today__empty">{t.overdueEmpty}</p>
      ) : (
        <ul className="admin-today__rows">
          {rows.map((r) => (
            <li
              key={`${r.sessionId}-${r.installmentLabel ?? 'one'}`}
              className="surface admin-today__row"
            >
              <Link to={`${langPrefix}/session/${r.sessionId}`} className="admin-today__row-link">
                <span className="mono admin-today__row-email">{r.email}</span>
                <span className="mono admin-today__row-amount">
                  {formatCadCents(r.amountCents, lang)}
                  {r.installmentLabel && <> · {r.installmentLabel}</>}
                </span>
                <span className="mono admin-today__row-age">{formatAge(r.ageSeconds, t)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function SlaBreachesPanel({
  t,
  rows,
  langPrefix,
}: {
  t: CopyT
  rows: SlaBreachEntry[]
  langPrefix: string
}) {
  return (
    <section className="surface admin-today__panel">
      <h2 className="admin-today__panel-title mono">
        {t.slaHeading} <span className="admin-today__count">({rows.length})</span>
      </h2>
      <p className="admin-today__panel-note">{t.slaIntro}</p>
      {rows.length === 0 ? (
        <p className="admin-today__empty">{t.slaEmpty}</p>
      ) : (
        <ul className="admin-today__rows">
          {rows.map((r) => (
            <li key={r.sessionId} className="surface admin-today__row admin-today__row--urgent">
              <Link
                to={`${langPrefix}/admin/inbox/${r.sessionId}`}
                className="admin-today__row-link"
              >
                <span className="mono admin-today__row-email">{r.email}</span>
                <span className="mono admin-today__row-tag">{t.statusLabel[r.status]}</span>
                <span className="mono admin-today__row-age">{formatAge(r.ageSeconds, t)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function UnansweredPanel({
  t,
  rows,
  langPrefix,
}: {
  t: CopyT
  rows: UnansweredMessageEntry[]
  langPrefix: string
}) {
  return (
    <section className="surface admin-today__panel">
      <h2 className="admin-today__panel-title mono">
        {t.unansweredHeading} <span className="admin-today__count">({rows.length})</span>
      </h2>
      <p className="admin-today__panel-note">{t.unansweredIntro}</p>
      {rows.length === 0 ? (
        <p className="admin-today__empty">{t.unansweredEmpty}</p>
      ) : (
        <ul className="admin-today__rows">
          {rows.map((r) => (
            <li key={r.sessionId} className="surface admin-today__row admin-today__row--urgent">
              <Link to={`${langPrefix}/session/${r.sessionId}`} className="admin-today__row-link">
                <span className="mono admin-today__row-email">{r.email}</span>
                <span className="mono admin-today__row-age">{formatAge(r.ageSeconds, t)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function SystemHealthPanel({
  t,
  health,
  lang,
  nowMs,
}: {
  t: CopyT
  health: SystemHealthEntry
  lang: Lang
  nowMs: number
}) {
  // digestStale takes a metric slot like the others (instead of a banner)
  // so the panel keeps its single rhythm — every signal lives in the same
  // grid, urgent ones flagged with the existing --urgent variant.
  const allClear =
    health.outboxPending === 0 &&
    health.outboxStuck === 0 &&
    health.emailBouncesLast7d === 0 &&
    health.emailComplaintsLast7d === 0 &&
    health.openAdminAlerts === 0 &&
    !health.digestStale
  return (
    <section className="surface admin-today__panel">
      <h2 className="admin-today__panel-title mono">{t.healthHeading}</h2>
      {allClear ? (
        <p className="admin-today__empty">{t.healthAllGood}</p>
      ) : (
        <ul className="admin-today__metrics">
          {health.digestStale && (
            <li className="surface admin-today__metric admin-today__metric--urgent">
              <div className="mono admin-today__metric-label">{t.digestStaleHeading}</div>
              <div className="admin-today__metric-figure">
                {health.lastDigestAtS === null
                  ? t.digestStaleNever
                  : t.digestStaleAgo(
                      formatRelativeWindow(health.lastDigestAtS * 1000 - nowMs, lang),
                    )}
              </div>
            </li>
          )}
          {(health.outboxPending > 0 || health.outboxStuck > 0) && (
            <li className="surface admin-today__metric">
              <div className="mono admin-today__metric-label">{t.healthOutbox}</div>
              <div className="admin-today__metric-figure">
                {health.outboxPending}
                <span className="admin-today__metric-sub mono">{t.healthOutboxPending}</span>
                {health.outboxStuck > 0 && (
                  <>
                    {' · '}
                    <span className="admin-today__metric-stuck">{health.outboxStuck}</span>{' '}
                    <span className="admin-today__metric-sub mono">{t.healthOutboxStuck}</span>
                  </>
                )}
              </div>
            </li>
          )}
          {(health.emailBouncesLast7d > 0 || health.emailComplaintsLast7d > 0) && (
            <li className="surface admin-today__metric">
              <div className="mono admin-today__metric-label">{t.healthEmail}</div>
              <div className="admin-today__metric-figure">
                {health.emailBouncesLast7d}{' '}
                <span className="admin-today__metric-sub mono">{t.healthBounces}</span>
                {health.emailComplaintsLast7d > 0 && (
                  <>
                    {' · '}
                    {health.emailComplaintsLast7d}{' '}
                    <span className="admin-today__metric-sub mono">{t.healthComplaints}</span>
                  </>
                )}
              </div>
            </li>
          )}
          {health.openAdminAlerts > 0 && (
            <li className="surface admin-today__metric admin-today__metric--urgent">
              <div className="mono admin-today__metric-label">{t.healthAlerts}</div>
              <div className="admin-today__metric-figure">{health.openAdminAlerts}</div>
            </li>
          )}
        </ul>
      )}
    </section>
  )
}

function CustodianPanel({
  t,
  alerts,
  langPrefix,
}: {
  t: CopyT
  alerts: CustodianAlertsEntry
  langPrefix: string
}) {
  return (
    <section className="surface admin-today__panel">
      <h2 className="admin-today__panel-title mono">{t.custodianHeading}</h2>
      <div className="admin-today__custodian-grid">
        <div className="admin-today__custodian-col">
          <div className="mono admin-today__custodian-heading">
            {t.custodianPastDueHeading} ({alerts.pastDue.length})
          </div>
          {alerts.pastDue.length === 0 ? (
            <p className="admin-today__empty">{t.custodianPastDueEmpty}</p>
          ) : (
            <ul className="admin-today__rows">
              {alerts.pastDue.map((r) => (
                <li key={r.sessionId} className="surface admin-today__row admin-today__row--urgent">
                  <Link
                    to={`${langPrefix}/session/${r.sessionId}`}
                    className="admin-today__row-link"
                  >
                    <span className="mono admin-today__row-email">{r.email}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="admin-today__custodian-col">
          <div className="mono admin-today__custodian-heading">
            {t.custodianRecentHeading} ({alerts.recentSwitches.length})
          </div>
          {alerts.recentSwitches.length === 0 ? (
            <p className="admin-today__empty">{t.custodianRecentEmpty}</p>
          ) : (
            <ul className="admin-today__rows">
              {alerts.recentSwitches.map((r) => (
                <li key={r.sessionId} className="surface admin-today__row">
                  <Link
                    to={`${langPrefix}/session/${r.sessionId}`}
                    className="admin-today__row-link"
                  >
                    <span className="mono admin-today__row-email">{r.email}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}
