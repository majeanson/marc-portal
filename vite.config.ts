import { execSync } from 'node:child_process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import checker from 'vite-plugin-checker'

function readGit(args: string, fallback: string): string {
  try {
    return execSync(`git ${args}`, { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    return fallback
  }
}

// Cloudflare Pages exposes the deployed commit via CF_PAGES_COMMIT_SHA; fall
// back to local git so `vite dev` still shows something useful.
const commitSha =
  process.env.CF_PAGES_COMMIT_SHA ?? readGit('rev-parse HEAD', 'unknown')
const commitDate = readGit(
  `log -1 --format=%cI ${commitSha === 'unknown' ? '' : commitSha}`.trim(),
  new Date().toISOString(),
)

export default defineConfig({
  define: {
    __COMMIT_HASH__: JSON.stringify(commitSha.slice(0, 7)),
    __COMMIT_DATE__: JSON.stringify(commitDate),
  },
  plugins: [
    react(),
    checker({
      typescript: true,
      eslint: {
        lintCommand: 'eslint .',
        useFlatConfig: true,
      },
      overlay: { initialIsOpen: false },
    }),
  ],
  server: {
    port: 5180,
    strictPort: false,
  },
})
