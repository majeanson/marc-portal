import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Vitest 4 switched its transformer to oxc; the old `esbuild: { jsx: 'automatic' }`
// block printed a "esbuild options will be ignored" warning at start-up.
// Dropped here because @vitejs/plugin-react already gives us the automatic
// JSX runtime — tests don't need to import React explicitly.

export default defineConfig({
  plugins: [react()],
  // Mirror the build-time defines from vite.config.ts so components that
  // reference them (e.g. Footer's __COMMIT_DATE__) render in tests.
  define: {
    __COMMIT_HASH__: JSON.stringify('test'),
    __COMMIT_DATE__: JSON.stringify('2026-01-01T00:00:00Z'),
  },
  test: {
    // happy-dom is faster than jsdom and supports the slim subset of DOM
    // we exercise (no canvas, no WebGL).
    environment: 'happy-dom',
    // The default 'threads' pool keeps one shared heap across the worker's
    // files; on the larger payments + i18n suites that heap grows until the
    // run OOMs. 'forks' gives each worker its own process, so memory is
    // reclaimed between files — slightly slower, but the run stays green.
    pool: 'forks',
    globals: false,
    include: ['src/**/*.test.{ts,tsx}', 'functions/**/*.test.ts'],
    setupFiles: ['./tests/setup.ts'],
  },
})
