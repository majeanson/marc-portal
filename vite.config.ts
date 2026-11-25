import { execSync } from 'node:child_process'
import { defineConfig, type Plugin } from 'vite'
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
const commitSha = process.env.CF_PAGES_COMMIT_SHA ?? readGit('rev-parse HEAD', 'unknown')
const commitDate = readGit(
  `log -1 --format=%cI ${commitSha === 'unknown' ? '' : commitSha}`.trim(),
  new Date().toISOString(),
)

// /version.json: the commit this bundle was built from, so DevHub can tell
// whether production serves the last deploy. A 'post' hook, and the last
// plugin, so it runs after anything that lists the bundle (a service
// worker's precache): the file must never be served from a cache.
function versionJson(): Plugin {
  return {
    name: 'version-json',
    apply: 'build',
    generateBundle: {
      order: 'post',
      handler() {
        let sha = process.env.GITHUB_SHA ?? ''
        if (!sha) {
          try {
            sha = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim()
          } catch {
            sha = 'unknown'
          }
        }
        this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ sha, builtAt: new Date().toISOString() }) })
      },
    },
  }
}

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
    versionJson(),
  ],
  server: {
    port: 5180,
    strictPort: false,
  },
})
