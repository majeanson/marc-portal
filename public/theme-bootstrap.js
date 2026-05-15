// Runs before React mounts so html[data-theme] is set on first paint —
// avoids the flash-of-cream when a returning night-mode visitor reloads.
// Reads `marc-portal:theme` from localStorage, falls back to OS scheme.
;(function () {
  try {
    var saved = localStorage.getItem('marc-portal:theme')
    var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    var theme = saved === 'day' || saved === 'night' ? saved : prefersDark ? 'night' : 'day'
    if (theme === 'night') document.documentElement.setAttribute('data-theme', 'night')
  } catch (e) {
    /* localStorage unavailable in some embedded contexts — silently fall back */
  }
})()
