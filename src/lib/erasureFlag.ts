/**
 * One-shot sessionStorage flag used by the erasure ritual at /au-revoir.
 *
 * Lives in its own module so the /me page can set the flag without
 * importing the lazy AuRevoir page bundle (which would pull AuRevoir
 * into the /me chunk and defeat the route-level code-split).
 *
 * Lifecycle:
 *   1. /me's "delete my account" handler calls markJustErased() *before*
 *      the navigation away.
 *   2. /au-revoir reads + clears the flag via consumeJustErasedFlag() at
 *      mount. Flag present → play the ritual. Absent → quiet direct-hit
 *      copy.
 * The flag intentionally lives in sessionStorage, not localStorage — a
 * deleted visitor opening a fresh tab tomorrow should not replay the
 * goodbye animation.
 */

const KEY = 'mp_just_erased'

export function markJustErased(): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(KEY, '1')
  } catch {
    // Storage blocked — /au-revoir falls back to direct-hit copy.
  }
}

export function consumeJustErasedFlag(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const present = window.sessionStorage.getItem(KEY) === '1'
    if (present) window.sessionStorage.removeItem(KEY)
    return present
  } catch {
    return false
  }
}
