// Test setup. Loads testing-library matchers and stubs a few Worker globals
// when running in happy-dom.

import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
})

// Node 25+ ships its own global `localStorage` (Web Storage), which shadows
// happy-dom's. Without --localstorage-file it is an empty object with no
// clear()/getItem(), so every test that touches storage fails on a newer
// Node than .nvmrc pins (seen on Node 26 against .nvmrc 24). Swap in a plain
// in-memory Storage whenever the one we were handed is unusable, so the
// suite doesn't depend on which Node a contributor (or a future .nvmrc bump)
// happens to run.
class MemoryStorage implements Storage {
  private data = new Map<string, string>()
  get length(): number {
    return this.data.size
  }
  clear(): void {
    this.data.clear()
  }
  getItem(key: string): string | null {
    return this.data.get(key) ?? null
  }
  key(index: number): string | null {
    return [...this.data.keys()][index] ?? null
  }
  removeItem(key: string): void {
    this.data.delete(key)
  }
  setItem(key: string, value: string): void {
    this.data.set(key, String(value))
  }
  // Storage allows `storage.foo = 'x'`; nothing in this codebase uses it.
  [name: string]: unknown
}

for (const target of [globalThis, globalThis.window].filter(Boolean)) {
  const current = Object.getOwnPropertyDescriptor(target, 'localStorage')
  let usable = false
  try {
    usable = typeof (target as { localStorage?: Storage }).localStorage?.clear === 'function'
  } catch {
    // Node's getter can throw without --localstorage-file; treat as unusable.
  }
  if (!usable && (current === undefined || current.configurable)) {
    Object.defineProperty(target, 'localStorage', {
      value: new MemoryStorage(),
      configurable: true,
      writable: true,
    })
  }
}
