import { useEffect, useState } from 'react'
import type { Lang } from '../i18n'
import { DICT } from '../i18n'
import { HeroShippedProject } from './HeroShippedProject'
import { useAuth } from '../lib/authContext'
import { getCapacityLive, listPublicProjects, type PublicProject } from '../lib/sessionsApi'

// Greeting that swaps with the visitor's local clock. Late-night gets a
// dry "encore là?" because Marc is a side-gig dev — most of the page's
// honest traffic happens after 22h anyway.
function pickSalut(lang: Lang): string {
  const h = new Date().getHours()
  if (h >= 22 || h < 5) return lang === 'fr' ? 'Encore là?' : 'Still up?'
  if (h < 11) return lang === 'fr' ? 'Bon matin.' : 'Good morning.'
  if (h < 18) return lang === 'fr' ? 'Salut.' : 'Hi.'
  return lang === 'fr' ? 'Bonsoir.' : 'Good evening.'
}

// In-hero ToC removed per §2.2 — duplicated by SectionRail (the sticky
// side rail on /). Anchor list now lives in SectionRail.tsx as the
// single source of truth.

export function Hero({ lang }: { lang: Lang }) {
  const t = DICT[lang].hero
  const { email, isAdmin } = useAuth()
  const langPrefix = lang === 'en' ? '/en' : ''
  const intakeHref = `${langPrefix}/intake`
  const sessionsHref = `${langPrefix}${isAdmin ? '/admin/inbox' : '/me'}`

  const [atCap, setAtCap] = useState<boolean>(false)
  // Projects list — drives the "shipped this year" mini counter AND the
  // hero thumbnail. Fetched once; the components that consume it filter
  // their own way. null = in-flight or error (hide both surfaces).
  const [projects, setProjects] = useState<PublicProject[] | null>(null)
  useEffect(() => {
    let cancelled = false
    getCapacityLive()
      .then((c) => {
        if (!cancelled) setAtCap(c.atCap)
      })
      .catch(() => {})
    listPublicProjects()
      .then((r) => {
        if (!cancelled) setProjects(r.projects)
      })
      .catch(() => {
        // Silent — hide both surfaces on network failure rather than
        // render a misleading 0.
      })
    return () => {
      cancelled = true
    }
  }, [])
  const ctaLabel = email ? t.ctaLoggedIn : atCap ? t.ctaWaitlist : t.cta

  // Real "shipped this year" count, derived client-side. Hidden when 0
  // (avoids reading as "this practice hasn't shipped anything"). A project
  // counts as "shipped" the moment it lands in the public gallery — that
  // is, when admin flips showcased_at. Fast enough for the 25-row list
  // we have today; revisit if the gallery grows past 100s.
  // Captured at mount via lazy init so render stays pure (react-hooks/purity).
  const [currentYear] = useState<number>(() => new Date().getFullYear())
  const shippedThisYear = (projects ?? []).filter(
    (p) => p.status === 'shipped' && new Date(p.showcasedAt * 1000).getFullYear() === currentYear,
  ).length

  // Re-picked every render — cheap (single Date.getHours()) and lets the
  // greeting follow a language switch without an extra effect.
  const salut = pickSalut(lang)

  return (
    <section className="section hero hero--editorial" id="hero" aria-labelledby="hero-title">
      <div className="hero__folio mono" aria-hidden="true">
        {t.folio}
      </div>

      {/* Echo of the OG card stamp — visitor sees the same VÉRIFIÉ mark
          they saw in the Slack/iMessage unfurl, so the landed page reads
          as "yes, same place." Decorative, no role, low-opacity so it
          never competes with the display headline. */}
      <svg className="hero__stamp" viewBox="0 0 260 100" aria-hidden="true" focusable="false">
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
            {lang === 'fr' ? 'VÉRIFIÉ' : 'VERIFIED'}
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
            QUÉBEC · ASYNC
          </text>
        </g>
      </svg>

      <div className="section__inner hero__inner">
        {/* Clock-aware greeting — opens the page like a real letter. Picked
            from the visitor's local clock, so late-night gets "Encore là?". */}
        <p className="hero__salut">{salut}</p>
        <h1 id="hero-title" className="hero__display">
          <span className="hero__display-line hero__display-line--pre">{t.display.pre}</span>
          <span className="hero__display-line hero__display-line--lead">{t.display.lead}</span>
          <span className="hero__display-line hero__display-line--emph">
            <span className="hero__display-emph-mark">{t.display.emphasis}</span>
          </span>
          <span className="hero__display-line hero__display-line--tail">{t.display.tail}</span>
        </h1>

        <p className="hero__lead hero__lead--primary">
          <strong>{t.body2}</strong>
        </p>

        <div className="hero__actions">
          <a className="hero__cta hero__cta--primary" href={intakeHref}>
            {ctaLabel}
          </a>
          <span
            className={`hero__slot-pill mono${atCap ? ' hero__slot-pill--full' : ' hero__slot-pill--open'}`}
            aria-live="polite"
          >
            {atCap
              ? lang === 'fr'
                ? 'plein — liste d’attente ouverte'
                : 'currently full — waitlist open'
              : lang === 'fr'
                ? '1 place ouverte'
                : '1 slot open'}
          </span>
          {email && (
            <a className="hero__sessions-link mono" href={sessionsHref}>
              {t.mySessionsLink}
            </a>
          )}
        </div>
        {shippedThisYear > 0 && (
          <p className="hero__shipped-counter mono">
            <span className="hero__shipped-counter-dot" aria-hidden="true" />
            {lang === 'fr'
              ? `${shippedThisYear} projet${shippedThisYear === 1 ? '' : 's'} livré${shippedThisYear === 1 ? '' : 's'} en ${currentYear}`
              : `${shippedThisYear} project${shippedThisYear === 1 ? '' : 's'} shipped in ${currentYear}`}
          </p>
        )}

        <div className="hero__bilingual mono">{t.bilingual}</div>

        {/* Signed sign-off — italic serif text with a hand-drawn flourish
            that draws itself on first paint. Reduced-motion users see the
            flourish already drawn. The SVG <text> is naturally announced
            by screenreaders, so no explicit aria-label needed. */}
        <div className="hero__signature">
          <svg viewBox="0 0 220 44" focusable="false">
            <text
              x="0"
              y="24"
              fontFamily="var(--sans), serif"
              fontStyle="italic"
              fontSize="22"
              fontWeight="500"
              fill="currentColor"
            >
              {t.signature}
            </text>
            <path
              className="hero__signature-flourish"
              d="M 4 36 Q 32 42 64 36 Q 100 30 138 38 Q 172 44 210 35"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              aria-hidden="true"
            />
          </svg>
        </div>
      </div>

      {/* Right-rail shipped-project preview. Becomes a stacked card on
          narrow viewports via CSS. Hides itself when no shipped project
          exists, so the hero collapses cleanly on cold-start. */}
      <HeroShippedProject projects={projects} lang={lang} />
    </section>
  )
}
