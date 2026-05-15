import { useNavigate, useLocation } from 'react-router-dom'
import type { Lang } from '../i18n'
import { DICT } from '../i18n'
import { useAuth } from '../lib/authContext'
import { ThemeToggle } from './ThemeToggle'

// Feature-detect View Transitions API for the language swap. Firefox lacks
// it today; on those browsers the navigate runs without the dissolve.
type DocumentWithViewTransition = Document & {
  startViewTransition?: (cb: () => void) => unknown
}

/**
 * Compute the target path on the *other* language for the current location.
 * Keeps the path stable across the swap so visitors land on the same page
 * (e.g. /projects ↔ /en/projects, not /projects → /en).
 */
function swapLangPath(pathname: string, search: string, hash: string, toEn: boolean): string {
  // Normalise the trailing slash so we don't end up with "/en/".
  const clean = pathname.replace(/\/+$/, '') || '/'
  const isOnEn = clean === '/en' || clean.startsWith('/en/')
  const base = isOnEn ? clean.replace(/^\/en/, '') || '/' : clean
  const next = toEn ? (base === '/' ? '/en' : `/en${base}`) : base
  return `${next}${search}${hash}`
}

export function Header({ lang }: { lang: Lang }) {
  const t = DICT[lang]
  const { email, isAdmin, realIsAdmin, previewAsUser, setPreviewAsUser, loading, logout } =
    useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const langPrefix = lang === 'en' ? '/en' : ''
  const sessionsHref = `${langPrefix}${isAdmin ? '/admin/inbox' : '/me'}`
  const loginHref = `${langPrefix}/login`

  const frHref = swapLangPath(location.pathname, location.search, location.hash, false)
  const enHref = swapLangPath(location.pathname, location.search, location.hash, true)

  function onLangSwitch(e: React.MouseEvent<HTMLAnchorElement>, to: 'fr' | 'en') {
    if (lang === to) {
      e.preventDefault()
      return
    }
    // Let cmd/ctrl/middle-click open in a new tab unhampered.
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
    e.preventDefault()
    // Remember the explicit choice for future visits — read by the locale
    // redirect in functions/_middleware.ts on `/` hits. 1-year horizon is
    // long enough that nobody re-toggles weekly; cleared on logout via the
    // browser if needed (not session-tied).
    document.cookie = `mp_lang=${to}; Path=/; Max-Age=31536000; SameSite=Lax`
    const href = to === 'en' ? enHref : frHref
    const doc = document as DocumentWithViewTransition
    if (typeof doc.startViewTransition === 'function') {
      doc.startViewTransition(() => navigate(href))
    } else {
      navigate(href)
    }
  }

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
          <nav className="site-header__sections" aria-label={t.nav.sections.projects}>
            <a href={`${langPrefix}/projects`} className="site-header__section-link">
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
      </header>
    </>
  )
}
