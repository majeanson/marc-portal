// Runs before React mounts so html[data-theme] is set on first paint —
// avoids the flash-of-cream when a returning night-mode visitor reloads.
// Also primes meta[name=theme-color] so the mobile address-bar tint matches
// the chosen surface (cream in day, ink in night).
// Reads `marc-portal:theme` from localStorage, falls back to OS scheme.
//
// Also decides up-front whether the EN-nudge banner (rendered on the FR home
// by <EnglishNudge>) should be visible. Without this, the prerender baked
// the banner into / (Playwright's navigator.language is en-US), and React's
// first commit then briefly removed it while AuthProvider's `loading` was
// true — a banner-blink that read as "the page just changed something about
// the language." Settling the decision here turns it into a paint-time CSS
// query: <html data-lang-nudge="en"> shows the banner, anything else hides
// it. See src/components/EnglishNudge.tsx for the matching component.
;(function () {
  try {
    var saved = localStorage.getItem('marc-portal:theme')
    var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    var theme = saved === 'day' || saved === 'night' ? saved : prefersDark ? 'night' : 'day'
    if (theme === 'night') document.documentElement.setAttribute('data-theme', 'night')
    var meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', theme === 'night' ? '#181613' : '#f6f1e6')
  } catch (e) {
    /* localStorage unavailable in some embedded contexts — silently fall back */
  }
  try {
    var html = document.documentElement
    var dismissed = localStorage.getItem('mp_en_nudge_dismissed') === '1'
    var firstLang = (navigator.languages && navigator.languages[0]) || navigator.language || ''
    var isEn = /^en/i.test(firstLang)
    // mp_csrf is set as long as the session lives and is NOT HttpOnly by
    // design (double-submit CSRF) — so its presence is a reliable sync
    // "signed-in" sentinel without waiting on /api/me to resolve.
    var signedIn = /(?:^|;\s*)mp_csrf=/.test(document.cookie)
    if (isEn && !dismissed && !signedIn) {
      html.setAttribute('data-lang-nudge', 'en')
    } else {
      // The prerendered HTML may already carry data-lang-nudge="en" because
      // Playwright reports en-US — remove it for FR/signed-in/dismissed
      // visitors before the body paints.
      html.removeAttribute('data-lang-nudge')
    }
  } catch (e) {
    /* navigator / cookie unavailable — fall back to React-driven render */
  }
})()
