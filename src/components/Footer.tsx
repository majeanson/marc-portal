import { useEffect, useState } from 'react'
import type { Lang } from '../i18n'
import { DICT } from '../i18n'
import { useAuth } from '../lib/authContext'
import { useLangSwitch } from '../lib/useLangSwitch'

// CF resolves `:account` to the user's actual account ID on login, so we
// don't need to hardcode it. Sentry's `/issues/` redirects to the default
// org for the signed-in user. Both URLs degrade gracefully (land on the
// dashboard root) when the slug doesn't match.
const CF_PAGES_URL = 'https://dash.cloudflare.com/?to=/:account/pages/view/marc-portal'
const SENTRY_URL = 'https://sentry.io/issues/'

function formatBuildDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Current Quebec wall-clock time, formatted per language. FR: `23h47`
 *  (24h, the way most Quebecers write time). EN: `11:47 PM` (12h, the way
 *  most anglo Canadians write it). Always America/Toronto regardless of
 *  the visitor's actual timezone — the line says "heure du Québec", so
 *  showing Tokyo time would be a lie. */
function formatQuebecTime(lang: Lang, now: Date): string {
  if (lang === 'fr') {
    const parts = new Intl.DateTimeFormat('fr-CA', {
      timeZone: 'America/Toronto',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now)
    const hour = parts.find((p) => p.type === 'hour')?.value ?? '00'
    const minute = parts.find((p) => p.type === 'minute')?.value ?? '00'
    return `${hour}h${minute}`
  }
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
    .format(now)
    .replace(/[\u202F\u00A0]/g, ' ') // normalize Intl-emitted NNBSP/NBSP for clean copy + screenreaders
}

/** Re-render every minute on the minute so the displayed time stays fresh.
 *  Aligns the first tick to the next minute boundary so we don't drift by
 *  ~60s for a visitor who reloaded mid-minute. */
function useNowEveryMinute(): Date {
  const [now, setNow] = useState<Date>(() => new Date())
  useEffect(() => {
    let intervalId: number | undefined
    const msToNextMinute = 60_000 - (Date.now() % 60_000)
    const timeoutId = window.setTimeout(() => {
      setNow(new Date())
      intervalId = window.setInterval(() => setNow(new Date()), 60_000)
    }, msToNextMinute)
    return () => {
      window.clearTimeout(timeoutId)
      if (intervalId !== undefined) window.clearInterval(intervalId)
    }
  }, [])
  return now
}

export function Footer({ lang }: { lang: Lang }) {
  const t = DICT[lang].footer
  // realIsAdmin (not isAdmin) — we want these ops links visible even when
  // an admin is in "view as user" preview mode. They're chrome for Marc,
  // not for the previewed user.
  const { realIsAdmin } = useAuth()
  const buildDate = formatBuildDate(__COMMIT_DATE__)
  const now = useNowEveryMinute()
  const qcTime = formatQuebecTime(lang, now)
  const qcTimeLabel = lang === 'fr' ? 'Heure du Québec' : 'Quebec time'
  const { frHref, enHref, onLangSwitch } = useLangSwitch(lang)
  const otherLangHref = lang === 'fr' ? enHref : frHref
  const otherLangCode = lang === 'fr' ? 'en' : 'fr'
  const otherLangLabel = lang === 'fr' ? 'EN' : 'FR'
  const privacyHref = lang === 'fr' ? '/confidentialite' : '/en/privacy'
  const privacyLabel = lang === 'fr' ? 'Confidentialité' : 'Privacy'
  const piaHref = lang === 'fr' ? '/pia' : '/en/pia'
  // The PIA is load-bearing for Loi 25 art. 3.3 / 17 compliance — must be
  // reachable without expanding the privacy page body. CAI inspectors look
  // for a footer link.
  const piaLabel = lang === 'fr' ? 'Comment je protège tes données' : 'How I protect your data'
  const handoffHref = lang === 'fr' ? '/handoff' : '/en/handoff'
  const handoffLabel = lang === 'fr' ? 'Comment ça finit' : 'How it ends'
  const metaHref = lang === 'fr' ? '/meta' : '/en/meta'
  const metaLabel = lang === 'fr' ? 'Sous le capot' : 'Under the hood'
  const vouchesHref = lang === 'fr' ? '/vouches' : '/en/vouches'
  const vouchesLabel = lang === 'fr' ? 'Témoignages' : 'Vouches'
  return (
    <footer className="site-footer">
      <div className="site-footer__flourish" aria-hidden="true" />
      <div className="site-footer__inner">
        <p className="site-footer__line">{t.contact}</p>
        <p className="site-footer__line">
          {t.legal} · <a href={privacyHref}>{privacyLabel}</a> · <a href={piaHref}>{piaLabel}</a> ·{' '}
          <a href={handoffHref}>{handoffLabel}</a> · <a href={metaHref}>{metaLabel}</a> ·{' '}
          <a href={vouchesHref}>{vouchesLabel}</a>
        </p>
        <p className="site-footer__line site-footer__line--meta">
          <span>{t.copyright}</span>
          <span className="site-footer__dot" aria-hidden="true">
            ·
          </span>
          <span
            className="site-footer__build"
            title={`commit ${__COMMIT_HASH__} · ${__COMMIT_DATE__}`}
          >
            build {buildDate} · {__COMMIT_HASH__}
          </span>
          <span className="site-footer__dot" aria-hidden="true">
            ·
          </span>
          {/* Live Quebec wall clock — updates every minute. A small handmade
              touch that says "this site is tended to, not just shipped". */}
          <span className="site-footer__qctime" aria-label={`${qcTimeLabel} — ${qcTime}`}>
            <span className="site-footer__qctime-label">{qcTimeLabel}</span>{' '}
            <span className="site-footer__qctime-value mono">{qcTime}</span>
          </span>
        </p>
        {/* Footer lang-switch — rendered as a hand-drawn arrow rather than a
            plain link. Reuses useLangSwitch so it sets the same mp_lang
            cookie + View-Transition the header switch uses. */}
        <p className="site-footer__line site-footer__lang-line">
          <a
            href={otherLangHref}
            onClick={(e) => onLangSwitch(e, otherLangCode)}
            className="site-footer__lang"
            aria-label={lang === 'fr' ? 'Read this site in English' : 'Lire ce site en français'}
          >
            <svg
              className="site-footer__lang-arrow"
              viewBox="0 0 60 18"
              aria-hidden="true"
              focusable="false"
            >
              <path
                d="M 4 9 Q 18 6 32 10 Q 42 12 52 9"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
              <path
                d="M 46 4 L 54 9 L 46 14"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="site-footer__lang-label mono">{otherLangLabel}</span>
          </a>
        </p>
        {realIsAdmin && (
          <p className="site-footer__line site-footer__ops mono" aria-label="Operator shortcuts">
            <a
              href={CF_PAGES_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="site-footer__ops-link"
            >
              CF Pages ↗
            </a>
            <span className="site-footer__dot" aria-hidden="true">
              ·
            </span>
            <a
              href={SENTRY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="site-footer__ops-link"
            >
              Sentry ↗
            </a>
          </p>
        )}
      </div>
    </footer>
  )
}
