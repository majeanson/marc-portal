/**
 * AppShell — buyer-facing app chrome (head + main + footer).
 *
 * Used by every per-template page surface (SndApp, VolunteerApp, the next
 * template). Holds the parts that don't vary across templates:
 *   - tenant displayName as the brand title
 *   - "Settings" link to /admin and the signed-in user's email
 *   - max-width main wrapper
 *   - global Footer
 *
 * What varies per template lives in `children`. The shell is intentionally
 * thin — a render-prop-driven framework would over-couple templates that
 * may diverge later.
 *
 * Class names follow the .app-shell-* BEM pattern (renamed from .snd-app-*
 * during the 2026-05 standardization pass when the SND template was retired).
 */

import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { Lang } from '../i18n'
import { DICT } from '../i18n'
import { Footer } from './Footer'
import { useAuth } from '../lib/authContext'
import { useTenant } from '../lib/tenantContext'

const COPY = {
  fr: { settings: 'Réglages' },
  en: { settings: 'Settings' },
} as const

export function AppShell({ lang, children }: { lang: Lang; children: ReactNode }) {
  const t = COPY[lang]
  const tNav = DICT[lang].nav
  const { tenant } = useTenant()
  const { email, isAdmin, realIsAdmin, previewAsUser, setPreviewAsUser } = useAuth()
  const langPrefix = lang === 'en' ? '/en' : ''

  return (
    <div className="app-shell">
      <header className="app-shell__head">
        <div className="app-shell__brand">
          <h1>{tenant?.displayName ?? 'App'}</h1>
        </div>
        <nav className="app-shell__nav">
          {isAdmin && (
            <Link to={`${langPrefix}/admin`} className="app-shell__nav-link">
              ⚙ {t.settings}
            </Link>
          )}
          {email && <span className="app-shell__user mono">{email}</span>}
          {realIsAdmin && (
            <button
              type="button"
              className={`app-shell__preview-toggle mono${previewAsUser ? ' app-shell__preview-toggle--on' : ''}`}
              onClick={() => setPreviewAsUser(!previewAsUser)}
              aria-pressed={previewAsUser}
            >
              {previewAsUser ? `← ${tNav.exitPreview}` : tNav.viewAsUser}
            </button>
          )}
        </nav>
      </header>

      <main id="main-content" className="app-shell__main">
        {children}
      </main>

      <Footer lang={lang} />
    </div>
  )
}
