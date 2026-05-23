import { useState } from 'react'
import type { Lang } from '../i18n'
import { useAuth } from '../lib/authContext'
import { useLangSwitch } from '../lib/useLangSwitch'

/**
 * One-time EN nudge banner. Shows on the FR home for visitors whose browser
 * reports `en-*` as their primary language. Two affordances: "English →"
 * routes through the same useLangSwitch the header switcher uses (sets the
 * `mp_lang=en` cookie so the next bare `/` visit lands on /en), and "Non,
 * je reste en français" dismisses the banner forever via localStorage.
 *
 * Why a banner instead of an automatic redirect: the FR-first contract is
 * the whole point of the practice. Auto-routing EN-browser visitors away
 * from FR hides the Québécois voice from anyone who happens to also speak
 * English. The nudge surfaces the EN path without removing the FR choice.
 *
 * Why client-side `navigator.language` and not a server-side cookie hint:
 * the only thing the middleware would have to do is sniff the same
 * Accept-Language header — same info, more moving parts. Bots and JS-off
 * visitors don't see the nudge, which is fine because they also can't
 * dismiss it; the nudge is a UX affordance, not a routing decision.
 */

const DISMISS_KEY = 'mp_en_nudge_dismissed'

const COPY = {
  prompt: 'Tu lis en anglais d’habitude?',
  yes: 'Voir en anglais →',
  no: 'Non, je reste en français',
} as const

export function EnglishNudge({ lang }: { lang: Lang }) {
  const { enHref, onLangSwitch } = useLangSwitch(lang)
  const { email, loading } = useAuth()

  // Read the dismissal flag once at mount; the only thing that flips it
  // back to true is calling dismiss() below. Reading from localStorage
  // every render would work but is wasteful — and using useEffect to
  // set state from "external" reads (navigator/localStorage) trips the
  // react-hooks/set-state-in-effect rule. The lazy initializer pattern
  // is the recommended escape hatch.
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    try {
      return window.localStorage.getItem(DISMISS_KEY) === '1'
    } catch {
      // Private browsing or storage disabled — show the nudge anyway.
      // Dismissal won't persist across sessions, which is an acceptable
      // degraded mode.
      return false
    }
  })

  // Visibility is a pure derivation of inputs — no useState/useEffect
  // pair, no flash on auth resolve.
  // 1. /en visitors are already where they want.
  // 2. Wait until auth resolves before showing — don't flash the nudge to
  //    a signed-in user who'll immediately get it hidden.
  // 3. Signed-in users have already picked a language via /api/me/prefs;
  //    the verifier wrote mp_lang for them. If they're on FR despite an
  //    EN browser, that's their explicit choice.
  // 4. Don't render server-side (no navigator); prerender outputs the FR
  //    home without a nudge, which is the safe default for crawlers.
  if (lang !== 'fr' || loading || email || dismissed) return null
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return null
  const navLang = (navigator.languages && navigator.languages[0]) || navigator.language || ''
  if (!navLang.toLowerCase().startsWith('en')) return null

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // See comment above — degraded mode is acceptable.
    }
    setDismissed(true)
  }

  return (
    <div className="en-nudge" role="region" aria-label="Language">
      <div className="en-nudge__inner">
        <span className="en-nudge__prompt">{COPY.prompt}</span>
        <a className="en-nudge__yes" href={enHref} onClick={(e) => onLangSwitch(e, 'en')}>
          {COPY.yes}
        </a>
        <button type="button" className="en-nudge__no" onClick={dismiss}>
          {COPY.no}
        </button>
      </div>
    </div>
  )
}
