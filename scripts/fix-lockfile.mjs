// One-shot script. Merges Linux-only optional-dep entries (@emnapi/core,
// @emnapi/runtime) from a prior lockfile into the current one. npm install
// on Windows will not add these because they are platform-conditional
// optionalDependencies; npm ci on Linux runners then refuses to start.
//
// Usage: node scripts/fix-lockfile.mjs <prev-lockfile-path>
// Idempotent. Exits 0 if no merge needed.

import { readFileSync, writeFileSync } from 'node:fs'
import { argv, exit } from 'node:process'

const NEEDED = ['node_modules/@emnapi/core', 'node_modules/@emnapi/runtime']

const prevPath = argv[2]
if (!prevPath) {
  console.error('usage: fix-lockfile.mjs <prev-lockfile-path>')
  exit(1)
}

const curr = JSON.parse(readFileSync('package-lock.json', 'utf8'))
const prev = JSON.parse(readFileSync(prevPath, 'utf8'))

let added = 0
for (const key of NEEDED) {
  if (curr.packages[key]) continue
  if (!prev.packages[key]) {
    console.error(`prev lockfile has no entry for ${key}`)
    exit(1)
  }
  curr.packages[key] = prev.packages[key]
  added++
}

if (added === 0) {
  console.log('lockfile already has all needed entries')
  exit(0)
}

// Resort the packages object alphabetically so the diff stays clean.
const sortedKeys = Object.keys(curr.packages).sort((a, b) => {
  if (a === '') return -1
  if (b === '') return 1
  return a.localeCompare(b)
})
const sortedPackages = {}
for (const k of sortedKeys) sortedPackages[k] = curr.packages[k]
curr.packages = sortedPackages

writeFileSync('package-lock.json', JSON.stringify(curr, null, 2) + '\n')
console.log(`merged ${added} entries into lockfile`)
