import { useNavigate, useLocation } from 'react-router-dom'
import type { Lang } from '../i18n'
import { swapLangPath } from './swapLangPath'

// Feature-detect View Transitions API for the language swap. Firefox lacks
// it today; on those browsers the navigate runs without the dissolve.
type DocumentWithViewTransition = Document & {
  startViewTransition?: (cb: () => void) => unknown
}

interface LangSwitch {
  frHref: string
  enHref: string
  onLangSwitch: (e: React.MouseEvent<HTMLAnchorElement>, to: Lang) => void
}

/**
 * Shared FR ↔ EN switch logic. Computes the equivalent path on the other
 * language, sets the `mp_lang` cookie so the middleware respects the
 * visitor's explicit choice on future `/` hits, and runs the navigation
 * through the View Transitions API when available (dissolve effect).
 *
 * Used by both Header and Footer so the two surfaces can never drift.
 */
export function useLangSwitch(lang: Lang): LangSwitch {
  const navigate = useNavigate()
  const location = useLocation()

  const frHref = swapLangPath(location.pathname, location.search, location.hash, false)
  const enHref = swapLangPath(location.pathname, location.search, location.hash, true)

  const onLangSwitch = (e: React.MouseEvent<HTMLAnchorElement>, to: Lang) => {
    if (lang === to) {
      e.preventDefault()
      return
    }
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
    e.preventDefault()
    document.cookie = `mp_lang=${to}; Path=/; Max-Age=31536000; SameSite=Lax`
    const href = to === 'en' ? enHref : frHref
    const doc = document as DocumentWithViewTransition
    if (typeof doc.startViewTransition === 'function') {
      doc.startViewTransition(() => navigate(href))
    } else {
      navigate(href)
    }
  }

  return { frHref, enHref, onLangSwitch }
}
