/**
 * Frontend bindings for /api/me/prefs. Source of truth on the server is
 * functions/_lib/userPrefs.ts — the lang preference is read by every
 * outbound email to decide FR vs EN copy.
 */

import { api } from './api'

export type PrefLang = 'fr' | 'en'

export interface PrefsResponse {
  lang: PrefLang
}

export async function getPrefs(): Promise<PrefsResponse> {
  return api<PrefsResponse>('/api/me/prefs')
}

export async function updatePrefs(lang: PrefLang): Promise<PrefsResponse> {
  return api<PrefsResponse>('/api/me/prefs', { method: 'PATCH', body: { lang } })
}
