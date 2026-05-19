/**
 * localStorage-backed step progress + decision answers for the Runbook.
 *
 * Why localStorage (not D1): the runbook is a per-operator memo, not data
 * that needs to survive a device swap. Browser-scoped is the right scope —
 * each new dev or template buyer starts with a fresh checklist when they
 * land on the page from their own machine. If we ever need cross-device
 * sync we can swap the backing store without touching renderers.
 *
 * Storage keys are namespaced under "runbook:" so a future "clear runbook
 * progress" button can match-and-delete cleanly. Each progress-checkbox key
 * is the step's stable id (e.g. "A-07"); each decision-answer key is the
 * decision's stable id prefixed with "decision:" (e.g. "decision:D-pricing").
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

function readString(id: string): string {
  try {
    return window.localStorage.getItem(storageKey(id)) ?? ''
  } catch {
    return ''
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

function writeString(id: string, value: string): void {
  try {
    if (value) window.localStorage.setItem(storageKey(id), value)
    else window.localStorage.removeItem(storageKey(id))
  } catch {
    // Same posture as writeBool.
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
 * Free-text answer for a decision card. Same persistence posture as the
 * step checkbox. Returns `[value, setValue]`.
 */
export function useDecisionAnswer(decisionId: string): [string, (v: string) => void] {
  const key = `decision:${decisionId}`
  const [value, setValue] = useState<string>(() => readString(key))

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === storageKey(key)) {
        setValue(e.newValue ?? '')
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [key])

  const update = useCallback(
    (v: string) => {
      setValue(v)
      writeString(key, v)
    },
    [key],
  )

  return [value, update]
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
