// Post-deploy production smoke. Walks the public surfaces a first visitor
// touches and exits non-zero on anything that looks wrong. Built for the
// "I just pushed — did I break the public site?" moment after a deploy
// completes, when the e2e backend suite (PR-only) didn't run and the
// visual e2e (PR-only) didn't run either.
//
// What this catches:
//   - 5xx on /, /fr, /en (the SPA shell stopped serving)
//   - schema drift after a migration (any /api/* endpoint that reads from a
//     freshly-altered table will surface a 500 here)
//   - DNS / custom-domain regression (every hit is against the prod host)
//   - SEO scaffolding missing (robots.txt, sitemap.xml, OG meta on /)
//   - magic-link request path going from 200 → 5xx (the request-link
//     handler is the first thing a real visitor exercises)
//
// What this does NOT catch:
//   - actual Resend delivery — we POST to /api/auth/request-link but
//     deliberately use a +prod-smoke@ tag so any email that escapes is
//     directed to Marc's inbox-with-filter, never to a real recipient.
//   - end-to-end checkout — Stripe in production would create a real
//     intent, so we don't poke /api/payments/checkout. The backend e2e
//     suite (e2e:backend) covers that loop against the harness.
//
// Usage:
//   node scripts/prod-smoke.mjs                   # default host
//   node scripts/prod-smoke.mjs --host=https://x  # override host
//   node scripts/prod-smoke.mjs --skip-email      # don't POST request-link
//
// Exit codes:
//   0 — every check passed
//   1 — at least one check failed (the script prints a summary table)
//   2 — usage / argument error

import { argv, exit } from 'node:process'

const DEFAULT_HOST = 'https://marcportal.com'
// Tag the request-link probe so any email that's somehow not suppressed
// lands somewhere Marc can route into a "prod smoke" folder. The address
// itself is hard-suppressed by Resend after the first bounce, but we keep
// the deliberate tag so the trail is visible.
const SMOKE_EMAIL_BASE = 'marc.jeanson92+prod-smoke@gmail.com'

function parseArgs() {
  let host = DEFAULT_HOST
  let skipEmail = false
  for (const a of argv.slice(2)) {
    if (a.startsWith('--host=')) host = a.slice('--host='.length)
    else if (a === '--skip-email') skipEmail = true
    else if (a === '--help' || a === '-h') {
      console.log(
        'Usage: node scripts/prod-smoke.mjs [--host=https://marcportal.com] [--skip-email]',
      )
      exit(0)
    } else {
      console.error(`prod-smoke: unknown arg "${a}"`)
      exit(2)
    }
  }
  return { host: host.replace(/\/+$/, ''), skipEmail }
}

const { host, skipEmail } = parseArgs()

const results = []
function record(name, ok, detail) {
  results.push({ name, ok, detail })
  const tag = ok ? 'ok' : 'FAIL'
  // Console output is the user-facing UX of this script — keep each line
  // grep-friendly: "ok GET / 200 (123ms)".
  console.log(`${tag.padEnd(4)} ${name}${detail ? ' — ' + detail : ''}`)
}

async function check(name, url, opts) {
  const expectStatus = opts?.expectStatus ?? 200
  const expectIncludes = opts?.expectIncludes
  const init = opts?.init ?? {}
  // Follow redirects by default — public surfaces like /en may serve a CF
  // Pages 308 to /en/ that we don't want to spuriously fail on. Specs that
  // assert a specific redirect (the verify spec uses redirect: 'manual') do
  // it explicitly in their `init`.
  const redirectMode = init.redirect ?? 'follow'
  const started = Date.now()
  try {
    const res = await fetch(url, { ...init, redirect: redirectMode })
    const ms = Date.now() - started
    const statusOk = Array.isArray(expectStatus)
      ? expectStatus.includes(res.status)
      : res.status === expectStatus

    if (!statusOk) {
      record(name, false, `status ${res.status} (expected ${expectStatus}) [${ms}ms]`)
      return null
    }
    if (expectIncludes) {
      const body = await res.text()
      if (!body.includes(expectIncludes)) {
        record(name, false, `body missing "${expectIncludes}" [${ms}ms]`)
        return null
      }
      record(name, true, `${res.status} [${ms}ms]`)
      return body
    }
    record(name, true, `${res.status} [${ms}ms]`)
    return res
  } catch (err) {
    const ms = Date.now() - started
    record(name, false, `${err.message ?? err} [${ms}ms]`)
    return null
  }
}

console.log(`prod-smoke: probing ${host}`)
console.log('─'.repeat(60))

// 1. Public surfaces — the SPA shell + the FR/EN entry points.
await check('GET /', `${host}/`)
await check('GET /fr', `${host}/fr`)
await check('GET /en', `${host}/en`)

// 2. SEO scaffolding — what scrapers fetch first. A broken sitemap or
//    missing robots makes the launch look amateurish to a search engine
//    on its first crawl.
await check('GET /robots.txt', `${host}/robots.txt`, {
  expectIncludes: 'User-agent',
})
await check('GET /sitemap.xml', `${host}/sitemap.xml`, {
  expectIncludes: '<urlset',
})
// OG meta — confirm the home page carries an og:image tag (the middleware
// rewrite injects this; if it stopped firing, social shares break silently).
await check('OG meta on /', `${host}/`, {
  expectIncludes: 'og:image',
})

// 3. Privacy / legal — Loi 25 obligation surfaces. A 500 here is both a
//    compliance issue and a trust signal to a first visitor reading the
//    privacy page before they decide to engage.
await check('GET /confidentialite (FR)', `${host}/confidentialite`)
await check('GET /en/privacy (EN)', `${host}/en/privacy`)

// 4. API health — covers D1 reachability + the handler itself.
await check('GET /api/health', `${host}/api/health`, {
  expectIncludes: '"ok":true',
})

// 5. /api/capacity — the home counter reads this. A 500 here = the bedrock
//    cap can't render anywhere on the SPA. The shape is small + stable.
await check('GET /api/capacity', `${host}/api/capacity`, {
  expectIncludes: '"activeCap"',
})

// 6. Magic-link request path. POST that exercises Resend (configured) and
//    the magic_link_tokens table. The endpoint always returns 200 by design
//    — a 5xx means D1 schema drift or middleware breakage.
if (!skipEmail) {
  // Per-run salt so successive smokes don't collide on the per-email
  // rate-limit window (5/h). Doesn't affect the assertion — we only check
  // status.
  const tag = `${Date.now().toString(36)}.${Math.random().toString(36).slice(2, 6)}`
  const probeEmail = SMOKE_EMAIL_BASE.replace('+prod-smoke@', `+prod-smoke.${tag}@`)
  await check('POST /api/auth/request-link', `${host}/api/auth/request-link`, {
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: probeEmail, lang: 'fr' }),
    },
    expectIncludes: '"sent":true',
  })
} else {
  console.log('ok   POST /api/auth/request-link — skipped (--skip-email)')
}

console.log('─'.repeat(60))
const failed = results.filter((r) => !r.ok)
if (failed.length > 0) {
  console.error(`prod-smoke: ${failed.length} check(s) failed`)
  for (const r of failed) console.error(`  ✗ ${r.name}: ${r.detail}`)
  exit(1)
}
console.log(`prod-smoke: all ${results.length} checks passed`)
exit(0)
