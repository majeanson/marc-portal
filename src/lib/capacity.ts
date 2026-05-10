import type { Lang } from '../i18n'

/**
 * The bedrock 1-active + 1-triage cap. These mirror the server-side constants
 * in functions/_lib/sessions.ts. If you change either, change both.
 */
export const ACTIVE_CAP = 1
export const TRIAGE_CAP = 1

/**
 * State-aware "prochain départ" text. Replaces the old hardcoded
 * "≈ prochainement" placeholder so the homepage stat reflects D1 reality.
 */
export function nextDepartureText(active: number, lang: Lang): string {
  if (active === 0) return lang === 'fr' ? 'ouvert maintenant' : 'open now'
  return lang === 'fr' ? 'après la livraison en cours' : 'after current ships'
}
