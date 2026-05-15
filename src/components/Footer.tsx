import type { Lang } from '../i18n'
import { DICT } from '../i18n'
import { useAuth } from '../lib/authContext'

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

export function Footer({ lang }: { lang: Lang }) {
  const t = DICT[lang].footer
  // realIsAdmin (not isAdmin) — we want these ops links visible even when
  // an admin is in "view as user" preview mode. They're chrome for Marc,
  // not for the previewed user.
  const { realIsAdmin } = useAuth()
  const buildDate = formatBuildDate(__COMMIT_DATE__)
  const privacyHref = lang === 'fr' ? '/confidentialite' : '/en/privacy'
  const privacyLabel = lang === 'fr' ? 'Confidentialité' : 'Privacy'
  return (
    <footer className="site-footer">
      <div className="site-footer__flourish" aria-hidden="true" />
      <div className="site-footer__inner">
        <p className="site-footer__line">{t.contact}</p>
        <p className="site-footer__line">
          {t.legal} · <a href={privacyHref}>{privacyLabel}</a>
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
        </p>
        {realIsAdmin && (
          <p
            className="site-footer__line site-footer__ops mono"
            aria-label="Operator shortcuts"
          >
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
