import type { Lang } from '../i18n'
import { DICT } from '../i18n'

function formatBuildDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function Footer({ lang }: { lang: Lang }) {
  const t = DICT[lang].footer
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
      </div>
    </footer>
  )
}
