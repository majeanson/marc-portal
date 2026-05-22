/**
 * Site search — ranks the {@link SEARCH_CORPUS} against a query.
 *
 * Accent-folded so `prive` matches `privé` and `francais` matches
 * `Français` — essential for a bilingual QC site. Matching is AND across
 * query words (every word must hit something) and is checked against both
 * languages, so an English query still finds a French-labelled node.
 *
 * An empty query is not "no results": it returns the highest-priority
 * destinations as suggestions, so the panel is useful the instant it opens.
 */

import { visibleEntries, type SearchEntry } from './corpus'

export interface SearchResult {
  entry: SearchEntry
  score: number
}

export interface SearchOutcome {
  results: SearchResult[]
  /** True when `results` are priority suggestions, not query matches. */
  suggested: boolean
}

const MAX_RESULTS = 12
const MAX_SUGGESTIONS = 6

// Unicode combining-diacritics block — stripped after an NFD decompose.
const DIACRITICS = /[̀-ͯ]/g

/** Lowercase, strip diacritics, trim. */
export function fold(s: string): string {
  return s.normalize('NFD').replace(DIACRITICS, '').toLowerCase().trim()
}

/** Score one folded query word against one folded field. 0 = no hit. */
function wordScore(word: string, hay: string): number {
  if (!hay) return 0
  const at = hay.indexOf(word)
  if (at === -1) return 0
  if (hay === word) return 100
  // Word-boundary start — begins the field or follows a non-alphanumeric.
  if (at === 0 || !/[a-z0-9]/.test(hay[at - 1])) return 70
  return 35
}

function scoreEntry(entry: SearchEntry, words: string[]): number {
  const labelFr = fold(entry.label.fr)
  const labelEn = fold(entry.label.en)
  const descFr = fold(entry.desc.fr)
  const descEn = fold(entry.desc.en)
  let total = 0
  for (const w of words) {
    const inLabel = Math.max(wordScore(w, labelFr), wordScore(w, labelEn))
    const inDesc = inLabel ? 0 : Math.max(wordScore(w, descFr), wordScore(w, descEn)) * 0.4
    const best = Math.max(inLabel, inDesc)
    if (best === 0) return 0 // AND semantics — every word must land somewhere
    total += best
  }
  // Priority nudges ties without overpowering a genuine text win.
  return total + entry.priority * 0.25
}

export function runSearch(query: string, opts: { isAdmin?: boolean } = {}): SearchOutcome {
  const corpus = visibleEntries(!!opts.isAdmin)
  const words = fold(query).split(/\s+/).filter(Boolean)

  if (words.length === 0) {
    const results = [...corpus]
      .sort((a, b) => b.priority - a.priority)
      .slice(0, MAX_SUGGESTIONS)
      .map((entry) => ({ entry, score: entry.priority }))
    return { results, suggested: true }
  }

  const results: SearchResult[] = []
  for (const entry of corpus) {
    const score = scoreEntry(entry, words)
    if (score > 0) results.push({ entry, score })
  }
  results.sort((a, b) => b.score - a.score || b.entry.priority - a.entry.priority)
  return { results: results.slice(0, MAX_RESULTS), suggested: false }
}
