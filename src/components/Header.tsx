import type { Lang } from '../i18n'
import { DICT } from '../i18n'
import { useAuth } from '../lib/authContext'
import { useLangSwitch } from '../lib/useLangSwitch'
import { SessionSubHeader } from './SessionSubHeader'
import { ThemeToggle } from './ThemeToggle'

/**
 * variant:
 *   'full'    — default. Marketing nav (Projets / Comment ça marche / Prix /
 *               Je fais — Je fais pas / À propos). Used on home + every
 *               marketing-style page (handoff, vouches, tier0, etc.).
 *   'session' — drops the marketing nav and replaces it with a single
 *               "← Mes sessions" back link so the session detail page reads
 *               as a product surface, not a marketing one. Especially
 *               important on mobile where the 5-link nav otherwise wraps
 *               to a second row and pushes session content below the fold.
 */
export function Header({ lang, variant = 'full' }: { lang: Lang; variant?: 'full' | 'session' }) {
  const t = DICT[lang]
  const { email, isAdmin, realIsAdmin, previewAsUser, setPreviewAsUser, loading, logout } =
    useAuth()
  const langPrefix = lang === 'en' ? '/en' : ''
  const sessionsHref = `${langPrefix}${isAdmin ? '/admin/inbox' : '/me'}`
  const adminHref = `${langPrefix}/admin`
  const loginHref = `${langPrefix}/login`

  const { frHref, enHref, onLangSwitch } = useLangSwitch(lang)

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
          {/* Header nav: in 'full' mode it's anchor-only, every link points
              at a home section. In 'session' mode it collapses to a single
              "← back to sessions" link so the header stays out of the way
              on a product surface (especially mobile). */}
          {variant === 'session' ? (
            <nav className="site-header__sections site-header__sections--session" aria-label={t.nav.mySessions}>
              <a href={sessionsHref} className="site-header__section-link site-header__section-link--back">
                ← {t.nav.mySessions}
              </a>
            </nav>
          ) : (
            <nav className="site-header__sections" aria-label={t.nav.sections.projects}>
              <a href={`${langPrefix}/#featured`} className="site-header__section-link">
                {t.nav.sections.projects}
              </a>
              <a href={`${langPrefix}/#how`} className="site-header__section-link">
                {t.nav.sections.how}
              </a>
              <a href={`${langPrefix}/#pricing`} className="site-header__section-link">
                {t.nav.sections.pricing}
              </a>
              <a href={`${langPrefix}/#vibe`} className="site-header__section-link">
                {t.nav.sections.vibe}
              </a>
              <a href={`${langPrefix}/#about`} className="site-header__section-link">
                {t.nav.sections.about}
              </a>
            </nav>
          )}
          <div className="site-header__right">
            {!loading && (
              <div className="site-header__auth">
                {email ? (
                  <>
                    {isAdmin ? (
                      // Admin: Console link replaces "Mes sessions". The hub
                      // surfaces Inbox as its first tile, so the shortcut
                      // isn't lost.
                      <a href={adminHref} className="site-header__auth-link">
                        {t.nav.adminConsole}
                      </a>
                    ) : (
                      // Regular visitor: keep the entry to their /me page.
                      <a href={sessionsHref} className="site-header__auth-link">
                        {t.nav.mySessions}
                      </a>
                    )}
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
            <ThemeToggle lang={lang} />
            <nav className="lang" aria-label={t.langNavLabel}>
              <a
                href={frHref}
                onClick={(e) => onLangSwitch(e, 'fr')}
                className={lang === 'fr' ? 'active' : ''}
                hrefLang="fr-CA"
                aria-current={lang === 'fr' ? 'page' : undefined}
              >
                FR
              </a>
              <a
                href={enHref}
                onClick={(e) => onLangSwitch(e, 'en')}
                className={lang === 'en' ? 'active' : ''}
                hrefLang="en-CA"
                aria-current={lang === 'en' ? 'page' : undefined}
              >
                EN
              </a>
            </nav>
          </div>
        </div>
        {/* Session-page sub-header is rendered INSIDE the main <header> so
            both rows share a single sticky element and hide/show as one
            unit on scroll. Before, the sub-header was a separate sticky
            block at top:56px; on scroll-up the two bars sometimes came
            back at different rates and the visitor would see only the
            back-link row without the section tabs. */}
        {variant === 'session' && <SessionSubHeader lang={lang} />}
      </header>
    </>
  )
}
