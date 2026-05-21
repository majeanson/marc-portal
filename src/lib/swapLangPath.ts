/**
 * Compute the URL on the *other* language for the current location, keeping
 * the visitor on the same conceptual page. Used by the FR ↔ EN switch in
 * the site header.
 *
 * Most routes share their slug across languages (e.g. `/projects` ↔
 * `/en/projects`), so a naive prefix swap works. A handful don't:
 *
 *   FR `/parcours`        ↔  EN `/en/journey`
 *   FR `/confidentialite` ↔  EN `/en/privacy`
 *   FR `/carte`           ↔  EN `/en/map`
 *
 * Those live in `TRANSLATED_PATHS` (FR → EN). When swapping, we look up the
 * current base in the appropriate direction before re-prefixing — otherwise
 * the visitor lands on `/en/parcours` (404) or `/journey` (404).
 *
 * `search` (query string) and `hash` are preserved as-is.
 */
const TRANSLATED_PATHS: Record<string, string> = {
  '/parcours': '/journey',
  '/confidentialite': '/privacy',
  '/carte': '/map',
}

export function swapLangPath(
  pathname: string,
  search: string,
  hash: string,
  toEn: boolean,
): string {
  // Normalise the trailing slash so we don't end up with "/en/".
  const clean = pathname.replace(/\/+$/, '') || '/'
  const isOnEn = clean === '/en' || clean.startsWith('/en/')
  // Strip /en if present — now `base` is the path in its "no-prefix" shape,
  // which is the FR slug when the visitor is on FR, or the EN slug when on
  // EN. The translation step below handles either direction.
  const base = isOnEn ? clean.replace(/^\/en/, '') || '/' : clean

  // Translate the slug if needed.
  //   toEn → look up FR key, return EN value.
  //   ← FR → look up EN value, return FR key (reverse).
  // If no translation is registered for this path, leave it alone.
  let translated: string
  if (toEn) {
    translated = TRANSLATED_PATHS[base] ?? base
  } else {
    const reverse = Object.entries(TRANSLATED_PATHS).find(([, en]) => en === base)
    translated = reverse ? reverse[0] : base
  }

  const next = toEn ? (translated === '/' ? '/en' : `/en${translated}`) : translated
  return `${next}${search}${hash}`
}
