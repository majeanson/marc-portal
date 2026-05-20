import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright config — E2E + visual-regression for the portal.
 *
 * Runs against the production build (`vite preview`), not the dev server,
 * so screenshots match what ships and the vite-plugin-checker overlay can
 * never leak into a baseline.
 *
 * Three viewport "projects" — a narrow phone width and a narrow desktop
 * width (the two sizes where responsive bugs have shown up) plus a
 * comfortable wide desktop. All use Desktop Chrome at devicePixelRatio 1
 * so baselines stay byte-stable across machines.
 *
 * Baselines live in e2e/__screenshots__/<viewport>/ and ARE committed —
 * they double as the screenshot gallery for layout review.
 */

const PORT = 4173
const BASE_URL = `http://localhost:${PORT}`
const isCI = !!process.env.CI

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  // Capped at 2 everywhere: with one shared preview server, the default
  // (CPU-count) worker pool overwhelms the machine doing full-page
  // screenshots + axe scans in parallel, causing timeout flake.
  workers: 2,
  reporter: isCI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  // Group committed baselines by viewport, e.g. e2e/__screenshots__/phone/home.png.
  snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}/{arg}{ext}',
  use: {
    baseURL: BASE_URL,
    reducedMotion: 'reduce',
    trace: 'on-first-retry',
  },
  expect: {
    // 5s (the default) is too tight to capture + diff a ~12,600px full-page
    // screenshot on a loaded runner — the home page timed out.
    timeout: 20_000,
    // animations: 'disabled' fast-forwards CSS animation/transition to the
    // end; maxDiffPixelRatio absorbs sub-pixel anti-aliasing drift between
    // the machine that generated the baseline and the CI runner.
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      maxDiffPixelRatio: 0.02,
    },
  },
  projects: [
    {
      name: 'phone',
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } },
    },
    {
      name: 'narrow',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1000, height: 900 } },
    },
    {
      name: 'wide',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      // Dark theme — screenshots only. Dark-mode bugs are colour/contrast,
      // not layout, so one viewport is enough signal. colorScheme: 'dark'
      // makes both theme-bootstrap.js and React pick the night theme.
      name: 'dark',
      testMatch: /screenshots\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        colorScheme: 'dark',
      },
    },
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: BASE_URL,
    reuseExistingServer: !isCI,
    timeout: 180_000,
  },
})
