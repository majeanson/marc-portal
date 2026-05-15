import { useEffect, useState } from 'react'
import type { Lang } from '../i18n'
import { DICT } from '../i18n'

type Theme = 'day' | 'night'

const STORAGE_KEY = 'marc-portal:theme'
const META_COLOR_BY_THEME: Record<Theme, string> = {
  day: '#f6f1e6',
  night: '#181613',
}

function readSavedTheme(): Theme | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'day' || saved === 'night') return saved
  } catch {
    /* localStorage unavailable */
  }
  return null
}

function readSystemTheme(): Theme {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'night' : 'day'
  }
  return 'day'
}

function readTheme(): Theme {
  return readSavedTheme() ?? readSystemTheme()
}

function applyTheme(next: Theme) {
  if (next === 'night') document.documentElement.setAttribute('data-theme', 'night')
  else document.documentElement.removeAttribute('data-theme')
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', META_COLOR_BY_THEME[next])
}

// Feature-detect View Transitions API. Firefox lacks it today; on those
// browsers the swap is instantaneous (no flash, just snap).
type DocumentWithViewTransition = Document & {
  startViewTransition?: (cb: () => void) => unknown
}

/**
 * Header-mounted day/night switch. Pairs with public/theme-bootstrap.js which
 * paints the right theme on first load. Once React is alive, this toggle
 * takes over: it wraps the swap in document.startViewTransition() for a
 * cinematic crossfade in Chromium, listens to OS theme changes (only honored
 * when the visitor hasn't made an explicit choice yet), and keeps
 * meta[name=theme-color] in sync so the mobile address bar matches.
 */
export function ThemeToggle({ lang }: { lang: Lang }) {
  const t = DICT[lang].themeToggle
  const [theme, setTheme] = useState<Theme>(() => readTheme())

  // Keep DOM + meta-color synced on every theme change.
  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  // Track OS preference changes. Only react if the visitor hasn't made an
  // explicit choice yet — otherwise we'd stomp their toggle when they
  // changed OS appearance mid-session.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (e: MediaQueryListEvent) => {
      if (readSavedTheme() !== null) return
      setTheme(e.matches ? 'night' : 'day')
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  function toggle() {
    const next: Theme = theme === 'night' ? 'day' : 'night'
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* localStorage unavailable — toggle still works for this session */
    }
    const doc = document as DocumentWithViewTransition
    if (typeof doc.startViewTransition === 'function') {
      doc.startViewTransition(() => setTheme(next))
    } else {
      setTheme(next)
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
