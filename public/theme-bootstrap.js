// Runs before React mounts so html[data-theme] is set on first paint —
// avoids the flash-of-cream when a returning night-mode visitor reloads.
// Also primes meta[name=theme-color] so the mobile address-bar tint matches
// the chosen surface (cream in day, ink in night).
// Reads `marc-portal:theme` from localStorage, falls back to OS scheme.
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
})()
