/**
 * Frontend bindings for /api/me/prefs. Source of truth on the server is
 * functions/_lib/userPrefs.ts — the lang preference is read by every
 * outbound email to decide FR vs EN copy, and the magic-link verifier
 * sets the mp_lang cookie from it so future bare-`/` visits land in the
 * right language.
 */

import { api } from './api'

export type PrefLang = 'fr' | 'en'

export interface PrefsResponse {
  lang: PrefLang
  firstName: string | null
}

export async function getPrefs(): Promise<PrefsResponse> {
  return api<PrefsResponse>('/api/me/prefs')
}

export async function updateLang(lang: PrefLang): Promise<PrefsResponse> {
  return api<PrefsResponse>('/api/me/prefs', { method: 'PATCH', body: { lang } })
}

/**
 * Pass `null` to clear the stored name; pass a string to set it. The
 * server trims and enforces 1–80 chars.
 */
export async function updateFirstName(firstName: string | null): Promise<PrefsResponse> {
  return api<PrefsResponse>('/api/me/prefs', { method: 'PATCH', body: { firstName } })
}

/** Back-compat alias — old callers passed lang positionally. */
export const updatePrefs = updateLang
