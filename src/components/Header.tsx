import type { Lang } from '../i18n'
import { DICT } from '../i18n'

export function Header({ lang }: { lang: Lang }) {
  const t = DICT[lang]
  return (
    <>
      <a className="skip-link" href="#main-content">
        {t.skipToContent}
      </a>
      <header className="site-header">
        <div className="site-header__inner">
          <a
            href={lang === 'fr' ? '/' : '/en'}
            className="brand"
            aria-label="Marc Portal — accueil"
          >
            marc<span className="dot">.</span>portal
          </a>
          <nav className="lang" aria-label={t.langNavLabel}>
            <a
              href="/"
              className={lang === 'fr' ? 'active' : ''}
              hrefLang="fr-CA"
              aria-current={lang === 'fr' ? 'page' : undefined}
            >
              FR
            </a>
            <a
              href="/en"
              className={lang === 'en' ? 'active' : ''}
              hrefLang="en-CA"
              aria-current={lang === 'en' ? 'page' : undefined}
            >
              EN
            </a>
          </nav>
        </div>
      </header>
    </>
  )
}
