/**
 * Admin custodians dashboard. Surfaces the subscription state across all
 * sessions in one scannable list — active subs (MRR + next-renewal cues),
 * past-due (Stripe failed, needs operator attention), and the history of
 * switched/canceled. Reads /api/sessions (admin sees all) and buckets
 * client-side. No new endpoint needed.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Lang } from '../i18n'
import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import { useAuth } from '../lib/authContext'
import { listSessions, type SessionRow } from '../lib/sessionsApi'
import { getSchemaForType, localized, type ProblemType } from '../lib/intakeSchemas'
import { formatDate, formatCadCents } from '../lib/format'
import { CUSTODIAN_CENTS } from '../lib/pricing'

const COPY = {
  fr: {
    eyebrow: 'admin',
    title: 'Dépositaires',
    intro:
      'Tous les abonnements « Je m’en occupe », groupés par état. La logique de bascule (renouvellement, échec carte, annulation) est gérée par Stripe — ce tableau lit l’état mis à jour par les webhooks. La dernière section liste les visiteurs qui ont explicitement coché « Tout à toi » à la livraison (opt-out du dépositaire).',
    loading: 'Chargement…',
    loadError: 'Impossible de charger les dépositaires. Réessaie.',
    retry: 'Réessayer',
    forbidden: 'Réservé à l’admin.',
    backToInbox: '← Retour à l’inbox',
    sectionActive: 'Actifs',
    sectionPastDue: 'Paiement en retard',
    sectionEnded: 'Abonnement terminé',
    sectionAllYours: '« Tout à toi » confirmé',
    sectionEmpty: 'Aucun.',
    countLabel: (n: number) => `${n} session${n === 1 ? '' : 's'}`,
    mrrLabel: 'MRR équivalent',
    mrrNote: (w: number, c: number) => `(${w} Watch · ${c} Care ÷ 12)`,
    untitled: 'Session sans intake',
    open: 'Ouvrir →',
    ackedOnLabel: 'confirmé le',
    statusLabels: {
      active: 'actif',
      past_due: 'en retard',
      canceled: 'annulé',
      switched_to_tout_a_toi: 'basculé Tout à toi',
      all_yours_acked: 'opt-out confirmé',
    } as const,
  },
  en: {
    eyebrow: 'admin',
    title: 'Custodians',
    intro:
      'Every "I handle it" subscription, grouped by state. The transition logic (renewal, card failure, cancellation) lives in Stripe — this board reads the state the webhooks keep updated. The last section lists visitors who explicitly ticked "All yours" at delivery (custodian opt-out).',
    loading: 'Loading…',
    loadError: 'Could not load custodians. Try again.',
    retry: 'Retry',
    forbidden: 'Admin only.',
    backToInbox: '← Back to inbox',
    sectionActive: 'Active',
    sectionPastDue: 'Payment past due',
    sectionEnded: 'Subscription ended',
    sectionAllYours: '"All yours" confirmed',
    sectionEmpty: 'None.',
    countLabel: (n: number) => `${n} session${n === 1 ? '' : 's'}`,
    mrrLabel: 'MRR equivalent',
    mrrNote: (w: number, c: number) => `(${w} Watch · ${c} Care ÷ 12)`,
    untitled: 'Session without intake',
    open: 'Open →',
    ackedOnLabel: 'confirmed on',
    statusLabels: {
      active: 'active',
      past_due: 'past due',
      canceled: 'canceled',
      switched_to_tout_a_toi: 'switched to All yours',
      all_yours_acked: 'opt-out confirmed',
    } as const,
  },
} as const

interface IntakePreview {
  type: ProblemType
  submittedAt?: string
}

function previewFromIntake(raw: string | null): IntakePreview | null {
  if (!raw) return null
  try {
    const obj = JSON.parse(raw) as { type?: unknown; submittedAt?: unknown }
    if (typeof obj.type === 'string') {
      return {
        type: obj.type as ProblemType,
        submittedAt: typeof obj.submittedAt === 'string' ? obj.submittedAt : undefined,
      }
    }
  } catch {
    // fall through
  }
  return null
}

export function AdminCustodians({ lang }: { lang: Lang }) {
  const t = COPY[lang]
  const navigate = useNavigate()
  const { email, isAdmin, loading: authLoading } = useAuth()
  const [sessions, setSessions] = useState<SessionRow[] | null>(null)
  // A failed fetch must not render as four empty buckets + $0 MRR — that reads
  // as "no custodians" and hides a backend problem. Surface it as an error.
  const [loadError, setLoadError] = useState(false)
  const langPrefix = lang === 'en' ? '/en' : ''

  useEffect(() => {
    document.title = `${t.title} — Marc`
  }, [t])

  const reload = useCallback(async () => {
    try {
      const r = await listSessions()
      setSessions(r.sessions)
      setLoadError(false)
    } catch {
      setLoadError(true)
    }
  }, [])

  useEffect(() => {
    if (authLoading) return
    if (!email) {
      navigate(`${langPrefix}/login`)
      return
    }
    if (!isAdmin) return
    let cancelled = false
    ;(async () => {
      try {
        const r = await listSessions()
        if (cancelled) return
        setSessions(r.sessions)
        setLoadError(false)
      } catch {
        if (!cancelled) setLoadError(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [authLoading, email, isAdmin, navigate, langPrefix])

  const buckets = useMemo(() => {
    const active: SessionRow[] = []
    const pastDue: SessionRow[] = []
    const ended: SessionRow[] = []
    const allYoursAcked: SessionRow[] = []
    for (const s of sessions ?? []) {
      if (s.custodian_status === 'active') active.push(s)
      else if (s.custodian_status === 'past_due') pastDue.push(s)
      else if (s.custodian_status === 'canceled' || s.custodian_status === 'switched_to_tout_a_toi')
        ended.push(s)
      else if (s.all_yours_acknowledged_at !== null) {
        // Explicitly opted out of custodian at delivery, no sub history.
        // Tracked separately so Marc can see who's self-managing.
        allYoursAcked.push(s)
      }
    }
    // Most-recently-updated first inside each bucket. The all-yours bucket
    // sorts by ack timestamp instead (more meaningful than updated_at here).
    const cmp = (a: SessionRow, b: SessionRow) => b.updated_at - a.updated_at
    active.sort(cmp)
    pastDue.sort(cmp)
    ended.sort(cmp)
    allYoursAcked.sort(
      (a, b) => (b.all_yours_acknowledged_at ?? 0) - (a.all_yours_acknowledged_at ?? 0),
    )
    return { active, pastDue, ended, allYoursAcked }
  }, [sessions])

  // Exact MRR — each active sub's plan is on the session row (custodian_plan,
  // written by the checkout webhook). Subs predating that column read as null
  // and fall outside both counts; the note's Watch/Care tally makes any gap
  // visible against the active section's own count.
  const watchCount = buckets.active.filter((s) => s.custodian_plan === 'watch').length
  const careCount = buckets.active.filter((s) => s.custodian_plan === 'care').length
  const mrrCents = Math.round(
    (watchCount * CUSTODIAN_CENTS.watch + careCount * CUSTODIAN_CENTS.care) / 12,
  )

  if (authLoading) {
    return (
      <div className="app">
        <Header lang={lang} />
        <main id="main-content">
          <article className="section intake session-frame">
            <div className="section__inner">
              <p className="session-frame__pending">{t.loading}</p>
            </div>
          </article>
        </main>
        <Footer lang={lang} />
      </div>
    )
  }

  if (!email || !isAdmin) {
    return (
      <div className="app">
        <Header lang={lang} />
        <main id="main-content">
          <article className="section intake session-frame">
            <div className="section__inner">
              <div className="intake__step">
                <div className="section__eyebrow">{t.eyebrow}</div>
                <h1 className="session-frame__title">{t.forbidden}</h1>
              </div>
            </div>
          </article>
        </main>
        <Footer lang={lang} />
      </div>
    )
  }

  return (
    <div className="app">
      <Header lang={lang} />
      <main id="main-content">
        <article className="section intake session-frame">
          <div className="section__inner">
            <a className="showcase-page__back" href={`${langPrefix}/admin/inbox`}>
              {t.backToInbox}
            </a>
            <header className="session-frame__header">
              <div className="section__eyebrow">{t.eyebrow}</div>
              <h1 className="session-frame__title">{t.title}</h1>
              <p>{t.intro}</p>
              {!loadError && (
                <p className="mono admin-custodians__mrr">
                  {t.mrrLabel}: {formatCadCents(mrrCents, lang)} {t.mrrNote(watchCount, careCount)}
                </p>
              )}
            </header>

            {loadError ? (
              <p role="alert" className="form__error">
                {t.loadError}{' '}
                <button type="button" className="link-btn mono" onClick={reload}>
                  {t.retry}
                </button>
              </p>
            ) : sessions === null ? (
              <p className="session-frame__pending">{t.loading}</p>
            ) : (
              <>
                <Bucket
                  title={t.sectionPastDue}
                  rows={buckets.pastDue}
                  lang={lang}
                  langPrefix={langPrefix}
                  copy={t}
                  tone="urgent"
                />
                <Bucket
                  title={t.sectionActive}
                  rows={buckets.active}
                  lang={lang}
                  langPrefix={langPrefix}
                  copy={t}
                  tone="ok"
                />
                <Bucket
                  title={t.sectionEnded}
                  rows={buckets.ended}
                  lang={lang}
                  langPrefix={langPrefix}
                  copy={t}
                  tone="muted"
                />
                <Bucket
                  title={t.sectionAllYours}
                  rows={buckets.allYoursAcked}
                  lang={lang}
                  langPrefix={langPrefix}
                  copy={t}
                  tone="muted"
                  variant="all_yours_acked"
                />
              </>
            )}
          </div>
        </article>
      </main>
      <Footer lang={lang} />
    </div>
  )
}

function Bucket({
  title,
  rows,
  lang,
  langPrefix,
  copy,
  tone,
  variant = 'custodian',
}: {
  title: string
  rows: SessionRow[]
  lang: Lang
  langPrefix: string
  copy: (typeof COPY)[Lang]
  tone: 'urgent' | 'ok' | 'muted'
  /** 'custodian' (default) reads the custodian_status field for the pill;
   *  'all_yours_acked' shows the ack timestamp and the "opt-out confirmed"
   *  pill instead. Same row layout otherwise. */
  variant?: 'custodian' | 'all_yours_acked'
}) {
  return (
    <section className={`admin-custodians__bucket admin-custodians__bucket--${tone}`}>
      <h2 className="mono admin-custodians__bucket-heading">
        {title} <span className="admin-custodians__bucket-count">({rows.length})</span>
      </h2>
      {rows.length === 0 ? (
        <p className="me-portal__no-matches">{copy.sectionEmpty}</p>
      ) : (
        <ul className="me-portal__cards">
          {rows.map((s) => (
            <CustodianRow
              key={s.id}
              session={s}
              lang={lang}
              langPrefix={langPrefix}
              copy={copy}
              variant={variant}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function CustodianRow({
  session,
  lang,
  langPrefix,
  copy,
  variant,
}: {
  session: SessionRow
  lang: Lang
  langPrefix: string
  copy: (typeof COPY)[Lang]
  variant: 'custodian' | 'all_yours_acked'
}) {
  const preview = previewFromIntake(session.intake_json)
  const title = preview ? localized(getSchemaForType(preview.type).title, lang) : copy.untitled
  const stateRaw =
    variant === 'all_yours_acked'
      ? ('all_yours_acked' as const)
      : ((session.custodian_status ?? 'none') as keyof typeof copy.statusLabels)
  const stateLabel = (copy.statusLabels as Record<string, string>)[stateRaw] ?? stateRaw
  const ackedDateStr =
    variant === 'all_yours_acked' && session.all_yours_acknowledged_at != null
      ? formatDate(
          new Date(session.all_yours_acknowledged_at * 1000).toISOString().slice(0, 10),
          lang,
        )
      : null
  return (
    <li className="me-portal__card">
      <a
        href={`${langPrefix}/session/${session.id}`}
        className="me-portal__card-link"
        aria-label={title}
      >
        <div className="me-portal__card-main">
          <div className="me-portal__card-meta">
            <span className="mono admin-inbox__email">{session.email}</span>
            <span className="me-portal__id mono">{session.id.slice(0, 8)}</span>
            <span className="mono me-portal__date">
              {ackedDateStr
                ? `${copy.ackedOnLabel} ${ackedDateStr}`
                : formatDate(new Date(session.updated_at * 1000).toISOString().slice(0, 10), lang)}
            </span>
          </div>
          <h3 className="me-portal__card-title">{title}</h3>
        </div>
        <div className="me-portal__card-side">
          <span className="mono session-frame__status-pill">{stateLabel}</span>
          <span className="me-portal__open mono">{copy.open}</span>
        </div>
      </a>
    </li>
  )
}

// Format helpers live in lib/format — formatCadCents is shared with
// PaymentActions and SessionTierStrip so every CAD figure renders alike.
