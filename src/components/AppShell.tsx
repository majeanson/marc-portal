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
 * Class names stay .snd-app-* for back-compat (renaming to .app-shell-* is
 * a future cosmetic pass, see feat-2026-023 known-limitations).
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
    <div className="snd-app">
      <header className="snd-app__head">
        <div className="snd-app__brand">
          <h1>{tenant?.displayName ?? 'App'}</h1>
        </div>
        <nav className="snd-app__nav">
          {isAdmin && (
            <Link to={`${langPrefix}/admin`} className="snd-app__nav-link">
              ⚙ {t.settings}
            </Link>
          )}
          {email && <span className="snd-app__user mono">{email}</span>}
          {realIsAdmin && (
            <button
              type="button"
              className={`snd-app__preview-toggle mono${previewAsUser ? ' snd-app__preview-toggle--on' : ''}`}
              onClick={() => setPreviewAsUser(!previewAsUser)}
              aria-pressed={previewAsUser}
            >
              {previewAsUser ? `← ${tNav.exitPreview}` : tNav.viewAsUser}
            </button>
          )}
        </nav>
      </header>

      <main id="main-content" className="snd-app__main">
        {children}
      </main>

      <Footer lang={lang} />
    </div>
  )
}
