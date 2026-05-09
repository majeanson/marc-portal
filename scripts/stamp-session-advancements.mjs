#!/usr/bin/env node
/**
 * Auto-stamp every un-stamped row in `session_advancements` with the just-
 * deployed Cloudflare Pages URL and the git short SHA. Mirrors the per-
 * feature stamp-revisions.mjs pipeline but for D1-backed session advancements:
 * admin posts an advancement, deploy ships, this script writes the build_url
 * + commit_sha so the visitor's session page can iframe the deploy.
 *
 * Wired into .github/workflows/deploy.yml after the wrangler-action deploy:
 *   node scripts/stamp-session-advancements.mjs <full-sha> <deployment-url>
 *
 * Semantics: stamp ALL rows where build_url IS NULL. If multiple
 * advancements were posted between deploys, they all reference the same
 * (current) deploy URL — which is correct: that deploy contains them all.
 *
 * Auth: relies on $CLOUDFLARE_API_TOKEN + $CLOUDFLARE_ACCOUNT_ID env vars
 * (already present in the deploy workflow). Calls `npx wrangler d1 execute
 * --remote` to run the UPDATE.
 *
 * Exits 0 on success (including "nothing to stamp"), non-zero on hard
 * wrangler/process errors.
 */
import { execSync } from 'node:child_process'

const [, , fullSha, rawBuildUrl] = process.argv
if (!fullSha || !rawBuildUrl) {
  console.error('Usage: stamp-session-advancements.mjs <full-commit-sha> <deployment-url>')
  process.exit(2)
}

// Strip a trailing slash so callers can append a path cleanly.
const buildUrl = rawBuildUrl.replace(/\/+$/, '')
const shortSha = fullSha.slice(0, 7)

// SQL injection isn't a concern here: both inputs come from CI (github.sha,
// wrangler-action output) and are well-formed. We still single-quote them
// inside the SQL and escape any embedded single quotes defensively.
const safeBuildUrl = buildUrl.replace(/'/g, "''")
const safeSha = shortSha.replace(/'/g, "''")
const nowExpr = `CAST(strftime('%s', 'now') AS INTEGER)`

const sql = `UPDATE session_advancements
  SET build_url = '${safeBuildUrl}',
      commit_sha = '${safeSha}',
      updated_at = ${nowExpr}
  WHERE build_url IS NULL;`

console.log('Running stamp SQL:')
console.log(sql)

try {
  // --json keeps the output parseable in case we want to count rows later.
  const out = execSync(
    `npx --yes wrangler d1 execute marc-portal-db --remote --command ${JSON.stringify(sql)} --json`,
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] },
  )
  // wrangler emits a JSON array; the meta on each statement carries
  // `changes`. Print it for the deploy log so the operator can confirm.
  try {
    const parsed = JSON.parse(out)
    const changes = Array.isArray(parsed)
      ? parsed.reduce((n, r) => n + (r?.meta?.changes ?? 0), 0)
      : 0
    console.log(`Stamped ${changes} advancement row(s).`)
  } catch {
    // wrangler output format may have shifted — just dump it.
    console.log(out)
  }
} catch (err) {
  console.error('wrangler d1 execute failed:', err.message ?? err)
  process.exit(1)
}
