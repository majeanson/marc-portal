import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Lang } from '../i18n'
import { DICT } from '../i18n'
import { useAuth } from '../lib/authContext'
import { useLangSwitch } from '../lib/useLangSwitch'
import { HOME_SECTION_FEATURE } from '../lib/features'
import { FeatureDot } from './FeatureDot'
import { SessionSubHeader } from './SessionSubHeader'
import { SiteSearch } from './SiteSearch'
import { ThemeToggle } from './ThemeToggle'
import { AccentToggle } from './AccentToggle'

/** Marketing nav links — `id` is the home-section anchor (also the
 *  HOME_SECTION_FEATURE key, so each link borrows the section's feature
 *  colour), `labelKey` indexes into DICT.nav.sections. Sections with no
 *  clean feature equivalent (#how, #about) render a neutral hollow dot
 *  so the visual rhythm holds. */
const NAV_LINKS = [
  { id: 'featured', labelKey: 'projects' },
  { id: 'how', labelKey: 'how' },
  { id: 'about', labelKey: 'about' },
  { id: 'vibe', labelKey: 'vibe' },
  { id: 'pricing', labelKey: 'pricing' },
] as const satisfies readonly {
  id: string
  labelKey: keyof (typeof DICT)['fr']['nav']['sections']
}[]

/**
 * variant:
 *   'full'    — default. Used on home + every marketing-style page (handoff,
 *               vouches, tier0, etc.).
 *   'session' — adds a single "← Mes sessions" back link next to the brand
 *               so the session detail page reads as a product surface.
 *
 * The bar itself stays sparse by design: brand, search, one auth entry, and
 * a Menu disclosure. Everything secondary (section anchors, sign-out, the
 * admin preview toggle, lang/theme/accent preferences) lives inside the
 * menu panel. The previous all-in-a-row header needed a 1280px ceiling, a
 * two-row wrap below 1180px and a swipable strip on phones just to fit —
 * one small menu removes all three contraptions at every width.
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

  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  // Dismissal wiring: Escape closes and hands focus back to the trigger
  // (keyboard visitors shouldn't be dropped at <body>); any pointerdown
  // outside the menu closes it without swallowing that click's real target.
  useEffect(() => {
    if (!menuOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setMenuOpen(false)
      triggerRef.current?.focus()
    }
    const onPointerDown = (e: PointerEvent) => {
      if (menuRef.current && e.target instanceof Node && !menuRef.current.contains(e.target)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [menuOpen])

  const closeMenu = () => setMenuOpen(false)

  return (
    <>
      <a className="skip-link" href="#main-content">
        {t.skipToContent}
      </a>
      <header className="site-header">
        <div className="site-header__inner">
          <Link
            to={lang === 'fr' ? '/' : '/en'}
            className="brand"
            aria-label="Marc Portal — accueil"
          >
            marc<span className="dot">.</span>portal
          </Link>
          {variant === 'session' && (
            <nav
              className="site-header__sections site-header__sections--session"
              aria-label={t.nav.mySessions}
            >
              <Link
                to={sessionsHref}
                className="site-header__section-link site-header__section-link--back"
              >
                ← {t.nav.mySessions}
              </Link>
            </nav>
          )}
          <div className="site-header__right">
            <SiteSearch lang={lang} />
            {!loading && (
              <div className="site-header__auth">
                {email ? (
                  isAdmin ? (
                    // Admin: Console link replaces "Mes sessions". The hub
                    // surfaces Inbox as its first tile, so the shortcut
                    // isn't lost.
                    <Link to={adminHref} className="site-header__auth-link">
                      {t.nav.adminConsole}
                    </Link>
                  ) : (
                    // Regular visitor: keep the entry to their /me page.
                    <Link to={sessionsHref} className="site-header__auth-link">
                      {t.nav.mySessions}
                    </Link>
                  )
                ) : (
                  <Link to={loginHref} className="site-header__auth-link">
                    {t.nav.signIn}
                  </Link>
                )}
              </div>
            )}
            <div className="site-menu" ref={menuRef}>
              <button
                ref={triggerRef}
                type="button"
                className={`site-menu__trigger${menuOpen ? ' site-menu__trigger--open' : ''}`}
                aria-expanded={menuOpen}
                aria-controls="site-menu-panel"
                onClick={() => setMenuOpen((open) => !open)}
              >
                {t.nav.menu}
              </button>
              {menuOpen && (
                <div className="site-menu__panel" id="site-menu-panel">
                  <nav className="site-menu__sections" aria-label={t.nav.sections.projects}>
                    {NAV_LINKS.map(({ id, labelKey }) => {
                      const feature = HOME_SECTION_FEATURE[id]
                      const label = t.nav.sections[labelKey]
                      return (
                        <span key={id} className="site-menu__section" data-feature={feature}>
                          {/* Dot is a separate target — clicks land on /carte
                              filtered to this feature, mirroring the
                              SectionRail + Footer pattern. That's a route
                              change, so the header remounts and the menu
                              closes on its own; only the same-page anchor
                              below needs the explicit close. */}
                          <FeatureDot
                            feature={feature}
                            lang={lang}
                            size="sm"
                            className="site-menu__section-dot"
                          />
                          <Link
                            to={`${langPrefix}/#${id}`}
                            className="site-menu__section-link"
                            onClick={closeMenu}
                          >
                            {label}
                          </Link>
                        </span>
                      )
                    })}
                  </nav>
                  {email && (
                    <div className="site-menu__account">
                      <button
                        type="button"
                        className="site-menu__signout"
                        onClick={() => {
                          closeMenu()
                          void logout()
                        }}
                      >
                        {t.nav.signOut}
                      </button>
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
                  <div className="site-menu__prefs">
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
                    <ThemeToggle lang={lang} />
                    <AccentToggle lang={lang} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        {/* Session-page sub-header is rendered INSIDE the main <header> so
            both rows share a single sticky element and hide/show as one
            unit on scroll. Before, the sub-header was a separate sticky
            block at top:56px; on scroll-up the two bars sometimes came
            back at different rates and the visitor would see only the
            back-link row without the section tabs. */}
        {variant === 'session' && <SessionSubHeader />}
      </header>
    </>
  )
}
