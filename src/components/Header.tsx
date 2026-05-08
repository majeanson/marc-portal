import type { Lang } from '../i18n'
import { DICT } from '../i18n'
import { useAuth } from '../lib/authContext'

export function Header({ lang }: { lang: Lang }) {
  const t = DICT[lang]
  const { email, isAdmin, realIsAdmin, previewAsUser, setPreviewAsUser, loading, logout } =
    useAuth()
  const langPrefix = lang === 'en' ? '/en' : ''
  const sessionsHref = `${langPrefix}${isAdmin ? '/admin/inbox' : '/me'}`
  const loginHref = `${langPrefix}/login`

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
          <div className="site-header__right">
            {!loading && (
              <div className="site-header__auth">
                {email ? (
                  <>
                    <a href={sessionsHref} className="site-header__auth-link">
                      {t.nav.mySessions}
                    </a>
                    <button
                      type="button"
                      className="site-header__auth-link site-header__auth-link--btn"
                      onClick={() => {
                        void logout()
                      }}
                    >
                      {t.nav.signOut}
                    </button>
                  </>
                ) : (
                  <a href={loginHref} className="site-header__auth-link">
                    {t.nav.signIn}
                  </a>
                )}
                {realIsAdmin && (
                  <button
                    type="button"
                    className={`site-header__preview-toggle mono${previewAsUser ? ' site-header__preview-toggle--on' : ''}`}
                    onClick={() => setPreviewAsUser(!previewAsUser)}
                    aria-pressed={previewAsUser}
                  >
                    {previewAsUser ? `← ${t.nav.exitPreview}` : t.nav.viewAsUser}
                  </button>
                )}
              </div>
            )}
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
        </div>
      </header>
    </>
  )
}
