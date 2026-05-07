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
