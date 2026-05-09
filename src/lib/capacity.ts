import type { Lang } from '../i18n'

/**
 * The bedrock 1-active + 1-triage cap. These mirror the server-side constants
 * in functions/_lib/sessions.ts. If you change either, change both.
 *
 * Soft-display fields (waitlist count, "next opening" estimate) used to live
 * in public/data/capacity.json; that fixture has been removed. The waitlist
 * count is no longer surfaced (we don't track it in D1); the next-opening
 * estimate is now a single rolling string per language, kept here so it can
 * be updated by editing source rather than via a JSON snapshot.
 */
export const ACTIVE_CAP = 1
export const TRIAGE_CAP = 1

const NEXT_OPENING: { fr: string; en: string } = {
  fr: '≈ prochainement',
  en: '≈ soon',
}

export function nextOpeningText(lang: Lang): string {
  return NEXT_OPENING[lang]
}
