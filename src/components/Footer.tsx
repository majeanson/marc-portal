import type { Lang } from '../i18n'
import { DICT } from '../i18n'

export function Footer({ lang }: { lang: Lang }) {
  const t = DICT[lang].footer
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <span>{t.contact}</span>
        <span>{t.legal}</span>
        <span>{t.copyright}</span>
      </div>
    </footer>
  )
}
