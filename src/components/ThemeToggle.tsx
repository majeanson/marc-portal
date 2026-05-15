import { useEffect, useState } from 'react'
import type { Lang } from '../i18n'
import { DICT } from '../i18n'

type Theme = 'day' | 'night'

const STORAGE_KEY = 'marc-portal:theme'

function readTheme(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'day' || saved === 'night') return saved
  } catch {
    /* localStorage unavailable */
  }
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'night' : 'day'
  }
  return 'day'
}

/**
 * Header-mounted day/night switch. Mirrors the theme bootstrap in
 * public/theme-bootstrap.js — that script paints the right theme on first
 * load, this toggle takes over once React is alive. Writes `marc-portal:theme`
 * so the bootstrap can recover the choice on next load.
 */
export function ThemeToggle({ lang }: { lang: Lang }) {
  const t = DICT[lang].themeToggle
  const [theme, setTheme] = useState<Theme>(() => readTheme())

  // Keep the html attribute in sync with state (covers both initial mount
  // and toggle clicks). The bootstrap script handled the *very* first paint.
  useEffect(() => {
    if (theme === 'night') document.documentElement.setAttribute('data-theme', 'night')
    else document.documentElement.removeAttribute('data-theme')
  }, [theme])

  function toggle() {
    const next: Theme = theme === 'night' ? 'day' : 'night'
    setTheme(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* localStorage unavailable — toggle still works for this session */
    }
  }

  const isNight = theme === 'night'
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-pressed={isNight}
      aria-label={isNight ? t.switchToDay : t.switchToNight}
      title={isNight ? t.switchToDay : t.switchToNight}
    >
      <span className="theme-toggle__glyph" aria-hidden="true">
        {isNight ? '☾' : '☀'}
      </span>
    </button>
  )
}
