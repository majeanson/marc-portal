import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  esbuild: {
    // Use the automatic JSX runtime so test files don't need to import React
    // explicitly (matches the app's tsconfig).
    jsx: 'automatic',
  },
  test: {
    // happy-dom is faster than jsdom and supports the slim subset of DOM
    // we exercise (no canvas, no WebGL).
    environment: 'happy-dom',
    globals: false,
    include: ['src/**/*.test.{ts,tsx}', 'functions/**/*.test.ts'],
    setupFiles: ['./tests/setup.ts'],
  },
})
