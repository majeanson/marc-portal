import { useEffect, useState, type CSSProperties } from 'react'
import type { Lang } from '../i18n'
import { DICT } from '../i18n'

type Accent = 'sage' | 'violet'

const STORAGE_KEY = 'marc-portal:accent'

// Each accent's representative swatch colour (the day primary). Add an accent
// here + a token block in styles.css (:root[data-accent='x'] day + night) and
// it appears in the picker — nothing else to wire.
const ACCENTS: { key: Accent; swatch: string }[] = [
  { key: 'sage', swatch: '#3d6e4e' },
  { key: 'violet', swatch: '#6c45c9' },
]

function readSavedAccent(): Accent {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'sage' || saved === 'violet') return saved
  } catch {
    /* localStorage unavailable */
  }
  return 'sage'
}

function applyAccent(next: Accent) {
  // Sage is the :root default, so it clears the attribute rather than setting
  // data-accent='sage' — keeps the DOM honest about "default".
  if (next === 'sage') document.documentElement.removeAttribute('data-accent')
  else document.documentElement.setAttribute('data-accent', next)
}

// Feature-detect View Transitions (same as ThemeToggle) so the accent swap
// crossfades in Chromium and snaps elsewhere.
type DocumentWithViewTransition = Document & {
  startViewTransition?: (cb: () => void) => unknown
}

/**
 * The accent picker — the second theme axis, orthogonal to day/night. Sets
 * data-accent on <html> (sage = the :root default). Pairs with
 * public/theme-bootstrap.js, which paints the saved accent on first load so
 * there's no flash. Rendered as a row of crisp swatch keycaps next to the
 * day/night toggle, so the choice reads at a glance.
 */
export function AccentToggle({ lang }: { lang: Lang }) {
  const t = DICT[lang].accentToggle
  const [accent, setAccent] = useState<Accent>(() => readSavedAccent())

  useEffect(() => {
    applyAccent(accent)
  }, [accent])

  function pick(next: Accent) {
    if (next === accent) return
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* localStorage unavailable — still applies for this session */
    }
    const doc = document as DocumentWithViewTransition
    if (typeof doc.startViewTransition === 'function') {
      doc.startViewTransition(() => setAccent(next))
    } else {
      setAccent(next)
    }
  }

  return (
    <div className="accent-toggle" role="group" aria-label={t.label}>
      {ACCENTS.map((a) => (
        <button
          key={a.key}
          type="button"
          className={`accent-toggle__swatch${
            accent === a.key ? ' accent-toggle__swatch--active' : ''
          }`}
          style={{ '--swatch': a.swatch } as CSSProperties}
          onClick={() => pick(a.key)}
          aria-pressed={accent === a.key}
          aria-label={t[a.key]}
          title={t[a.key]}
        />
      ))}
    </div>
  )
}
