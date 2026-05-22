/**
 * Site search — a ⌘K / `/` panel that finds any destination on the site.
 *
 * The corpus is the /carte atlas (see src/lib/search): every page, section
 * and service the map knows about, ranked by a priority weight so the
 * panel leads with what matters (intake, pricing, projects) — and, with an
 * empty query, shows those top destinations as suggestions straight away.
 *
 * Each result navigates to the destination; its secondary "on the map"
 * link hands off to /carte focused on that node, so a quick lookup can
 * expand into spatial exploration.
 *
 * The component renders its own trigger button (placed in the Header) plus
 * the modal, portalled to <body> so no header stacking context can clip
 * it. Closed by default — it adds nothing to the page at rest.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import type { Lang } from '../i18n'
import { useAuth } from '../lib/authContext'
import { runSearch, type SearchResult } from '../lib/search/search'
import type { NodeKind } from '../lib/map/types'

const COPY = {
  fr: {
    triggerLabel: 'Rechercher dans le site',
    placeholder: 'Cherche une page, une section, un service…',
    dialogLabel: 'Recherche',
    suggested: 'Pour commencer',
    matches: 'Résultats',
    onMap: 'sur la carte ↗',
    close: 'fermer',
    hint: '↑↓ naviguer · ↵ ouvrir · ⌘↵ voir sur la carte · échap fermer',
    empty: (q: string) => `Rien trouvé pour « ${q} ».`,
    kinds: {
      page: 'page',
      section: 'section',
      service: 'service',
      endpoint: 'API',
      table: 'donnée',
      binding: 'config',
      'admin-tile': 'admin',
    } as Record<NodeKind, string>,
  },
  en: {
    triggerLabel: 'Search the site',
    placeholder: 'Find a page, a section, a service…',
    dialogLabel: 'Search',
    suggested: 'Start here',
    matches: 'Results',
    onMap: 'on the map ↗',
    close: 'close',
    hint: '↑↓ move · ↵ open · ⌘↵ see on the map · esc close',
    empty: (q: string) => `Nothing found for “${q}”.`,
    kinds: {
      page: 'page',
      section: 'section',
      service: 'service',
      endpoint: 'API',
      table: 'data',
      binding: 'config',
      'admin-tile': 'admin',
    } as Record<NodeKind, string>,
  },
} as const

/** Which atlas layer best shows a node of this kind. */
function mapLayerFor(kind: NodeKind): string {
  if (kind === 'page' || kind === 'section') return 'pages'
  if (kind === 'admin-tile') return 'admin'
  return 'data'
}

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

function SearchGlyph() {
  return (
    <svg
      className="site-search__glyph"
      viewBox="0 0 20 20"
      width="18"
      height="18"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="9" cy="9" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
      <line
        x1="13.5"
        y1="13.5"
        x2="18"
        y2="18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function SiteSearch({ lang }: { lang: Lang }) {
  const t = COPY[lang]
  const { isAdmin } = useAuth()
  const navigate = useNavigate()

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  // -1 = the input has focus; 0..n-1 = that result row has focus.
  const [active, setActive] = useState(-1)

  const triggerRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const rowRefs = useRef<(HTMLAnchorElement | null)[]>([])

  const outcome = useMemo(() => runSearch(query, { isAdmin }), [query, isAdmin])
  const results = outcome.results

  // Opening always starts fresh — empty query, cursor on the input.
  const openSearch = useCallback(() => {
    setQuery('')
    setActive(-1)
    setOpen(true)
  }, [])
  const close = useCallback(() => setOpen(false), [])

  // Global shortcuts: ⌘K / Ctrl+K, and a bare `/` (the latter only when the
  // visitor isn't already typing into a field somewhere).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        openSearch()
      } else if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (isTypingTarget(e.target)) return
        e.preventDefault()
        openSearch()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openSearch])

  // While open: lock background scroll; restore focus to the trigger on close.
  useEffect(() => {
    if (!open) return
    const trigger = triggerRef.current
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
      trigger?.focus()
    }
  }, [open])

  // Roving focus — follows the active index between the input and the rows.
  useEffect(() => {
    if (!open) return
    const id = requestAnimationFrame(() => {
      if (active < 0) inputRef.current?.focus()
      else rowRefs.current[active]?.focus()
    })
    return () => cancelAnimationFrame(id)
  }, [open, active])

  const navigateTo = useCallback(
    (href: string, external: boolean) => {
      setOpen(false)
      if (external) window.open(href, '_blank', 'noopener,noreferrer')
      else navigate(href)
    },
    [navigate],
  )

  const destinationOf = useCallback(
    (r: SearchResult): { href: string; external: boolean } | null => {
      const h = r.entry.href
      if (!h) return null
      const href = typeof h === 'string' ? h : h[lang]
      if (!href) return null
      const external = r.entry.hrefExternal ?? /^https?:\/\//.test(href)
      return { href, external }
    },
    [lang],
  )

  const mapHrefOf = useCallback(
    (r: SearchResult): string => {
      const base = lang === 'en' ? '/en/map' : '/carte'
      return `${base}?layer=${mapLayerFor(r.entry.kind)}&node=${encodeURIComponent(r.entry.id)}`
    },
    [lang],
  )

  const openResult = useCallback(
    (r: SearchResult, onMap: boolean) => {
      if (onMap) {
        navigateTo(mapHrefOf(r), false)
        return
      }
      const dest = destinationOf(r)
      if (dest) navigateTo(dest.href, dest.external)
      else navigateTo(mapHrefOf(r), false)
    },
    [destinationOf, mapHrefOf, navigateTo],
  )

  const onPanelKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      close()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, -1))
    } else if (e.key === 'Enter' && active >= 0) {
      const r = results[active]
      if (r) {
        e.preventDefault()
        openResult(r, e.metaKey || e.ctrlKey)
      }
    } else if (e.key === 'Tab') {
      // Minimal focus trap — the modal portals over the page, so Tab must
      // cycle within the panel rather than fall through to the document.
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button, input, [tabindex]:not([tabindex="-1"])',
      )
      if (!focusable || focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="site-search__trigger"
        aria-label={t.triggerLabel}
        aria-keyshortcuts="Control+K Meta+K"
        onClick={openSearch}
      >
        <SearchGlyph />
        <span className="site-search__trigger-hint mono" aria-hidden="true">
          ⌘K
        </span>
      </button>

      {open &&
        createPortal(
          <div
            className="site-search"
            role="presentation"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) close()
            }}
          >
            {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- a modal dialog legitimately owns its Escape / arrow-key / focus-trap handling */}
            <div
              ref={panelRef}
              className="site-search__panel"
              role="dialog"
              aria-modal="true"
              aria-label={t.dialogLabel}
              onKeyDown={onPanelKeyDown}
            >
              <div className="site-search__bar">
                <SearchGlyph />
                <input
                  ref={inputRef}
                  type="search"
                  className="site-search__input"
                  placeholder={t.placeholder}
                  aria-label={t.placeholder}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value)
                    setActive(-1)
                  }}
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  type="button"
                  className="site-search__close mono"
                  onClick={close}
                  aria-label={t.close}
                >
                  {t.close}
                </button>
              </div>

              <div className="site-search__body">
                {results.length === 0 ? (
                  <p className="site-search__empty">{t.empty(query.trim())}</p>
                ) : (
                  <>
                    <p className="site-search__section mono">
                      {outcome.suggested ? t.suggested : t.matches}
                    </p>
                    <ul className="site-search__results">
                      {results.map((r, i) => {
                        const dest = destinationOf(r)
                        const desc = r.entry.desc[lang]
                        return (
                          <li
                            key={r.entry.id}
                            className={`site-search__result${i === active ? ' is-active' : ''}`}
                          >
                            <a
                              ref={(el) => {
                                rowRefs.current[i] = el
                              }}
                              className="site-search__result-main"
                              href={dest ? dest.href : mapHrefOf(r)}
                              onFocus={() => setActive(i)}
                              onClick={(e) => {
                                e.preventDefault()
                                openResult(r, false)
                              }}
                            >
                              <span className="site-search__result-kind mono">
                                {t.kinds[r.entry.kind] ?? r.entry.kind}
                              </span>
                              <span className="site-search__result-text">
                                <span className="site-search__result-label">
                                  {r.entry.label[lang]}
                                </span>
                                {desc && <span className="site-search__result-desc">{desc}</span>}
                              </span>
                            </a>
                            <a
                              className="site-search__on-map mono"
                              href={mapHrefOf(r)}
                              onClick={(e) => {
                                e.preventDefault()
                                openResult(r, true)
                              }}
                            >
                              {t.onMap}
                            </a>
                          </li>
                        )
                      })}
                    </ul>
                  </>
                )}
              </div>

              <p className="site-search__hint mono">{t.hint}</p>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
