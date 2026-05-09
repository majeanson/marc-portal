// Test setup. Loads testing-library matchers and stubs a few Worker globals
// when running in happy-dom.

import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
})
