// Build src/data/map-skeleton.json from the live source: router, Pages
// Functions, D1 migrations, wrangler.toml. The /carte + /en/map page
// imports the skeleton at build time and merges it with src/lib/map/
// curated.ts to produce the rendered atlas.
//
// Why a build script instead of import.meta.glob: (a) functions/ + wrangler.toml
// live outside Vite's resolved tree; (b) the skeleton is committed so PR
// diffs surface architectural drift (a new admin endpoint shows up as +1
// line in this JSON, immediately visible in review).
//
// No generatedAt timestamp — same reason build-sitemap.mjs dropped <lastmod>:
// otherwise the file would re-mutate on every build and CI's `git diff
// --quiet` check would always flag it as dirty.

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const portalRoot = dirname(dirname(__filename))

// ─── 1. Routes (src/router.tsx) ──────────────────────────────────────────────
//
// The router is hand-written + stable in shape. Regex over text beats pulling
// in a TS-AST dep. We collect every <Route ... element={... <Component lang=
// "fr|en"...} /> and resolve relative/index children against the most recent
// admin shell of the same lang. Dual-context routes (e.g. /admin/inbox/:id
// reuses SessionPage) are kept as raw entries so the merge step in
// src/lib/map/data.ts can decide how to collapse — keeping intelligence in
// TS rather than this script.

function parseRoutes() {
  // Strip JSX block comments first — they otherwise leak example paths into
  // the route table (e.g. a comment that mentions `<Route path="/:lang?/admin">`
  // would be matched as a real route).
  const src = readFileSync(join(portalRoot, 'src', 'router.tsx'), 'utf8').replace(
    /\{\/\*[\s\S]*?\*\/\}/g,
    '',
  )
  const routeRe = /<Route\b([\s\S]*?)element=\{([\s\S]*?)\}/g
  const compRe = /<(\w+)\s+lang="(fr|en)"/
  const raw = []
  let m
  while ((m = routeRe.exec(src))) {
    const attrs = m[1]
    const element = m[2]
    const compMatch = compRe.exec(element)
    if (!compMatch) continue // RootLayout, NotFound, RouteError — no lang prop
    const path = /\bpath="([^"]+)"/.exec(attrs)?.[1] ?? null
    const isIndex = /\bindex\b/.test(attrs)
    raw.push({
      path,
      isIndex,
      component: compMatch[1],
      lang: compMatch[2],
    })
  }

  return raw.map((r) => {
    let absPath
    if (r.path && r.path.startsWith('/')) {
      absPath = r.path
    } else {
      // Index or relative child — only the /admin and /en/admin shells nest.
      const parentShell = r.lang === 'en' ? '/en/admin' : '/admin'
      absPath = r.path ? `${parentShell}/${r.path}` : parentShell
    }
    return {
      path: absPath,
      component: r.component,
      lang: r.lang,
      dynamic: absPath.includes(':'),
      inAdminShell:
        absPath === '/admin' ||
        absPath === '/en/admin' ||
        absPath.startsWith('/admin/') ||
        absPath.startsWith('/en/admin/'),
    }
  })
}

// ─── 2. Endpoints (functions/api/**) ─────────────────────────────────────────
//
// Filesystem walk. Skip *.test.ts, _lib/, _middleware.ts. Method comes from
// onRequestGet/Post/Put/Delete/Patch exports; if only bare onRequest is found,
// tag as "ANY". adminOnly is true when path starts with /api/admin/ OR the
// file calls isAdmin(env,...). The isAdmin probe matches the project's
// existing gate pattern (see functions/_lib/env.ts).

function walkApi(dir) {
  const out = []
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir)) {
    if (name === '_lib') continue
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) {
      out.push(...walkApi(full))
    } else if (name.endsWith('.ts') && !name.endsWith('.test.ts') && !name.startsWith('_')) {
      out.push(full)
    }
  }
  return out
}

function parseEndpoints() {
  const apiRoot = join(portalRoot, 'functions', 'api')
  const files = walkApi(apiRoot)
  const endpoints = []
  for (const file of files) {
    const rel = relative(apiRoot, file).replace(/\\/g, '/')
    let url =
      '/api/' +
      rel
        .replace(/\.ts$/, '')
        .replace(/\/index$/, '')
        .replace(/\[(\w+)\]/g, ':$1')
    if (url.endsWith('/')) url = url.slice(0, -1)

    const content = readFileSync(file, 'utf8')
    const methods = []
    for (const verb of ['Get', 'Post', 'Put', 'Delete', 'Patch']) {
      if (new RegExp(`onRequest${verb}\\b`).test(content)) methods.push(verb.toUpperCase())
    }
    if (methods.length === 0 && /\bonRequest\b/.test(content)) methods.push('ANY')

    const adminOnly = url.startsWith('/api/admin/')

    endpoints.push({
      id:
        'api.' +
        rel
          .replace(/\.ts$/, '')
          .replace(/\//g, '.')
          .replace(/\[(\w+)\]/g, '$1'),
      path: url,
      methods,
      adminOnly,
      file: 'functions/api/' + rel,
    })
  }
  endpoints.sort((a, b) => a.id.localeCompare(b.id))
  return endpoints
}

// ─── 3. Tables (functions/db/migrations/*.sql) ───────────────────────────────
//
// Regex over CREATE TABLE statements; first migration to declare a table wins
// (subsequent ALTERs aren't tracked here — they don't add nodes).

function parseTables() {
  const migDir = join(portalRoot, 'functions', 'db', 'migrations')
  if (!existsSync(migDir)) return []
  const files = readdirSync(migDir)
    .filter((n) => n.endsWith('.sql'))
    .sort()
  const seen = new Map()
  for (const f of files) {
    const sql = readFileSync(join(migDir, f), 'utf8')
    const re = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/gi
    let m
    while ((m = re.exec(sql))) {
      if (!seen.has(m[1])) seen.set(m[1], f)
    }
  }
  return [...seen.entries()]
    .map(([name, firstMigration]) => ({ id: `table.${name}`, name, firstMigration }))
    .sort((a, b) => a.id.localeCompare(b.id))
}

// ─── 4. Bindings (wrangler.toml) ─────────────────────────────────────────────
//
// Tiny single-purpose TOML reader — strips # line comments, picks out
// [[d1_databases]], [[r2_buckets]], and the [vars] block. We don't need
// full TOML semantics; the file's shape is known and tested in CI.

function parseBindings() {
  const tomlPath = join(portalRoot, 'wrangler.toml')
  if (!existsSync(tomlPath)) return []
  const raw = readFileSync(tomlPath, 'utf8')
  // Strip whole-line comments. Inline # inside a string would corrupt this,
  // but wrangler.toml never does that.
  const code = raw
    .split('\n')
    .map((l) => (l.trim().startsWith('#') ? '' : l))
    .join('\n')

  const out = []

  function eachBlock(pattern, kind, nameKey) {
    const re = new RegExp(`\\[\\[${pattern}\\]\\]([\\s\\S]*?)(?=\\n\\[|$)`, 'g')
    let m
    while ((m = re.exec(code))) {
      const block = m[1]
      const binding = /binding\s*=\s*"([^"]+)"/.exec(block)?.[1]
      const name = new RegExp(`${nameKey}\\s*=\\s*"([^"]+)"`).exec(block)?.[1]
      if (binding) out.push({ id: `binding.${binding}`, kind, binding, name: name || null })
    }
  }
  eachBlock('d1_databases', 'd1', 'database_name')
  eachBlock('r2_buckets', 'r2', 'bucket_name')

  // [vars] — single block of KEY = "value" lines until the next section.
  const varsMatch = /\[vars\]\s*\n([\s\S]*?)(?=\n\[|$)/.exec(code)
  if (varsMatch) {
    const lineRe = /^\s*(\w+)\s*=\s*"([^"]*)"/gm
    let m
    while ((m = lineRe.exec(varsMatch[1]))) {
      out.push({ id: `binding.${m[1]}`, kind: 'var', binding: m[1] })
    }
  }

  out.sort((a, b) => a.id.localeCompare(b.id))
  return out
}

// ─── Emit ────────────────────────────────────────────────────────────────────

const routes = parseRoutes()
const endpoints = parseEndpoints()
const tables = parseTables()
const bindings = parseBindings()

const outDir = join(portalRoot, 'src', 'data')
const outPath = join(outDir, 'map-skeleton.json')
mkdirSync(outDir, { recursive: true })
writeFileSync(outPath, JSON.stringify({ routes, endpoints, tables, bindings }, null, 2) + '\n')

const uniqueComponents = new Set(routes.map((r) => r.component)).size
console.log(
  `build-map-skeleton: ${routes.length} routes (${uniqueComponents} components), ${endpoints.length} endpoints, ${tables.length} tables, ${bindings.length} bindings → src/data/map-skeleton.json`,
)
