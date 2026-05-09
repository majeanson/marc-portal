/**
 * localStorage-backed draft helper for the intake flow.
 * No backend yet — drafts persist on the device, anchored by formId (account-aware
 * once email is set: 'intake-' + email-hash). Safe-to-no-op if localStorage isn't
 * available (private browsing, blocked storage).
 */

const PREFIX = 'marc-portal:'

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(PREFIX + key)
  } catch {
    return null
  }
}

function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(PREFIX + key, value)
  } catch {
    // localStorage unavailable — silently no-op
  }
}

function safeRemove(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key)
  } catch {
    // no-op
  }
}

export function loadDraft<T>(key: string): T | null {
  const raw = safeGet(key)
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

/**
 * Load a draft only if its `savedAt` (ISO string) is within the last
 * `maxAgeMs`. If the stored value is older, the entry is cleared and null is
 * returned. Used by the pending-intake handoff so abandoned magic-link
 * flows don't auto-resurrect months later.
 */
export function loadDraftWithTTL<T extends { savedAt?: string }>(
  key: string,
  maxAgeMs: number,
): T | null {
  const v = loadDraft<T>(key)
  if (!v) return null
  const savedAt = v.savedAt ? Date.parse(v.savedAt) : NaN
  if (Number.isNaN(savedAt) || Date.now() - savedAt > maxAgeMs) {
    clearDraft(key)
    return null
  }
  return v
}

export function saveDraft<T>(key: string, data: T): void {
  safeSet(key, JSON.stringify(data))
}

export function clearDraft(key: string): void {
  safeRemove(key)
}

export function flagSet(key: string): boolean {
  return safeGet(key) === '1'
}

export function flagWrite(key: string, value: boolean): void {
  if (value) safeSet(key, '1')
  else safeRemove(key)
}
