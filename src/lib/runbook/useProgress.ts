/**
 * localStorage-backed step progress for the Runbook.
 *
 * Why localStorage (not D1): the runbook is a per-operator memo, not data
 * that needs to survive a device swap. Browser-scoped is the right scope —
 * checking off "Get access" in one place doesn't need to follow you to
 * another machine. If we ever need cross-device sync we can swap the backing
 * store without touching renderers.
 *
 * Storage keys are namespaced under "runbook:" so the "reset progress"
 * button can match-and-delete cleanly. Each progress-checkbox key is the
 * step's stable id (e.g. "A-07").
 */

import { useCallback, useEffect, useState } from 'react'

const STORAGE_PREFIX = 'runbook:'

function storageKey(id: string): string {
  return `${STORAGE_PREFIX}${id}`
}

/**
 * Read a boolean from localStorage. Returns false when storage is unavailable
 * (private mode in some browsers) or the key is missing.
 */
function readBool(id: string): boolean {
  try {
    return window.localStorage.getItem(storageKey(id)) === '1'
  } catch {
    return false
  }
}

function writeBool(id: string, value: boolean): void {
  try {
    if (value) window.localStorage.setItem(storageKey(id), '1')
    else window.localStorage.removeItem(storageKey(id))
  } catch {
    // Storage unavailable — fail silently. The in-memory state still tracks
    // the toggle within the session, so the page remains usable.
  }
}

/**
 * Checkbox state for a single step. Returns `[checked, toggle]`. The toggle
 * persists immediately — there's no save button. A `storage` event listener
 * keeps multiple tabs in sync (e.g. operator with two tabs open on the same
 * runbook).
 */
export function useStepProgress(stepId: string): [boolean, () => void] {
  const [checked, setChecked] = useState<boolean>(() => readBool(stepId))

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === storageKey(stepId)) {
        setChecked(e.newValue === '1')
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [stepId])

  const toggle = useCallback(() => {
    setChecked((prev) => {
      const next = !prev
      writeBool(stepId, next)
      return next
    })
  }, [stepId])

  return [checked, toggle]
}

/**
 * Aggregate read — returns the count of completed step ids inside `stepIds`.
 * Used by the track-header progress chip ("4 of 10 done"). Re-checks on
 * every render via reading from storage; cheap because each read is one
 * localStorage hit.
 */
export function useCompletionCount(stepIds: string[]): { done: number; total: number } {
  const [done, setDone] = useState<number>(() => stepIds.filter(readBool).length)

  useEffect(() => {
    function recompute() {
      setDone(stepIds.filter(readBool).length)
    }
    function onStorage(e: StorageEvent) {
      if (e.key && e.key.startsWith(STORAGE_PREFIX)) recompute()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [stepIds])

  return { done, total: stepIds.length }
}

/**
 * Clear every key under the runbook namespace. Wired to the "reset progress"
 * button. Reload after calling so all subscribed components re-read.
 */
export function clearAllProgress(): void {
  try {
    const toRemove: string[] = []
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i)
      if (k && k.startsWith(STORAGE_PREFIX)) toRemove.push(k)
    }
    toRemove.forEach((k) => window.localStorage.removeItem(k))
  } catch {
    // No-op when storage is unavailable.
  }
}

/**
 * Imperative check (no React subscription) — for use inside render functions
 * that need to read a step's state without re-rendering on every change
 * (e.g. the parallel view computing which Track-B steps are flagged).
 *
 * Components that need reactivity should use useStepProgress instead.
 */
export function readStepProgress(stepId: string): boolean {
  return readBool(stepId)
}
