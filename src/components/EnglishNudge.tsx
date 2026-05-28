import type { Lang } from '../i18n'
import { DICT } from '../i18n'
import { useLangSwitch } from '../lib/useLangSwitch'

/**
 * One-time EN nudge banner. Shows on the FR home for visitors whose browser
 * reports `en-*` as their primary language. Two affordances: "En anglais →"
 * routes through the same useLangSwitch the header switcher uses (sets the
 * `mp_lang=en` cookie so the next bare `/` visit lands on /en), and "Reste
 * en français" dismisses the banner forever via localStorage.
 *
 * Why a banner instead of an automatic redirect: the FR-first contract is
 * the whole point of the practice. Auto-routing EN-browser visitors away
 * from FR hides the Québécois voice from anyone who happens to also speak
 * English. The nudge surfaces the EN path without removing the FR choice.
 *
 * Visibility is decided BEFORE React mounts — see public/theme-bootstrap.js,
 * which sniffs navigator.languages, the dismiss flag, and the mp_csrf cookie
 * (sync "signed-in" sentinel) and sets html[data-lang-nudge="en"]. The
 * matching CSS rule (see .en-nudge in styles.css) hides the banner unless
 * that attribute is present. The previous design ran those checks in React,
 * which caused a banner-blink on first commit: prerender baked the banner
 * in, then `loading: true` on the AuthProvider briefly removed it, then
 * /api/me resolved and it came back. Gating in the inline bootstrap script
 * turns the decision into paint-time CSS — no flicker.
 *
 * The component still renders the banner DOM unconditionally on the FR home
 * so dismiss + click-through work once React mounts.
 */

const DISMISS_KEY = 'mp_en_nudge_dismissed'

export function EnglishNudge({ lang }: { lang: Lang }) {
  const { enHref, onLangSwitch } = useLangSwitch(lang)

  // /en visitors are already where they want — no banner DOM at all.
  if (lang !== 'fr') return null

  const t = DICT.fr.enNudge

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // Private browsing or storage disabled — dismissal won't persist
      // across sessions, which is an acceptable degraded mode.
    }
    // Drop the visibility attribute synchronously so the banner disappears
    // in the same frame as the click, without a React re-render.
    document.documentElement.removeAttribute('data-lang-nudge')
  }

  return (
    <div className="en-nudge" role="region" aria-label="Language">
      <div className="en-nudge__inner">
        <span className="en-nudge__prompt">{t.prompt}</span>
        <a className="en-nudge__yes" href={enHref} onClick={(e) => onLangSwitch(e, 'en')}>
          {t.yes}
        </a>
        <button type="button" className="en-nudge__no" onClick={dismiss}>
          {t.no}
        </button>
      </div>
    </div>
  )
}
