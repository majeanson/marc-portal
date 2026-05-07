#!/usr/bin/env node
/**
 * Auto-stamp the most recent un-stamped revision in each feature.json file
 * touched by the deployed commit, with the git short SHA and the Cloudflare
 * Pages deployment URL.
 *
 * Wired into .github/workflows/deploy.yml after the wrangler deploy step:
 *   node scripts/stamp-revisions.mjs <full-sha> <deployment-url>
 *
 * The convention is "every new revision gets stamped, exactly once, the first
 * time the deploy that contains it runs through CI". So we only touch the
 * latest revision (newest by file order) that lacks a `commit` field.
 *
 * Exits 0 on success (including no-op cases — nothing changed, or all
 * revisions already stamped). Exits non-zero only on hard parse/IO errors.
 */
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const portalRoot = dirname(dirname(__filename))

const [, , fullSha, rawBuildUrl] = process.argv
if (!fullSha || !rawBuildUrl) {
  console.error('Usage: stamp-revisions.mjs <full-commit-sha> <deployment-url>')
  process.exit(2)
}

// Strip a trailing slash so the iframe builder gets a clean origin.
const buildUrl = rawBuildUrl.replace(/\/+$/, '')
const shortSha = fullSha.slice(0, 7)

// Files modified by THIS commit. Anything else is irrelevant — we don't
// retroactively stamp older revisions, even if they're missing a commit.
let changedRaw
try {
  changedRaw = execSync(`git diff-tree --no-commit-id --name-only -r ${fullSha}`, {
    encoding: 'utf8',
  })
} catch (err) {
  console.error('git diff-tree failed:', err.message)
  process.exit(1)
}

const candidates = changedRaw
  .split('\n')
  .map((s) => s.trim())
  .filter((s) => s.endsWith('feature.json'))
  .map((rel) => join(portalRoot, rel.replace(/^portal\//, '')))
  .filter((abs) => {
    try {
      return statSync(abs).isFile()
    } catch {
      return false
    }
  })

if (candidates.length === 0) {
  console.log('No feature.json files changed in this commit. Nothing to stamp.')
  process.exit(0)
}

let stamped = 0

for (const file of candidates) {
  let json
  try {
    json = JSON.parse(readFileSync(file, 'utf8'))
  } catch (err) {
    console.error(`Failed to parse ${file}:`, err.message)
    process.exit(1)
  }

  const revisions = json.revisions
  if (!Array.isArray(revisions) || revisions.length === 0) {
    console.log(`${file}: no revisions array, skipping.`)
    continue
  }

  // Walk from newest (last in file) to oldest, stamp the first unstamped one.
  // Revision order in the file is the canonical "newest at the end" pattern
  // already used by lac-mcp, so this matches what a human reader sees.
  let target = null
  for (let i = revisions.length - 1; i >= 0; i--) {
    if (!revisions[i].commit) {
      target = revisions[i]
      break
    }
  }

  if (!target) {
    console.log(`${file}: every revision already stamped, skipping.`)
    continue
  }

  target.commit = shortSha
  target.buildUrl = buildUrl
  writeFileSync(file, JSON.stringify(json, null, 2) + '\n', 'utf8')
  stamped++
  console.log(`${file}: stamped revision dated ${target.date} → ${shortSha} + ${buildUrl}`)
}

console.log(`Stamped ${stamped} feature.json file(s).`)
