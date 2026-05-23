# Claude Code Guide — `portal/`

> Loaded automatically when Claude Code opens here. The parent
> `FULL_LIFE_AS_CODE/CLAUDE.md` covers the broader ecosystem; this file is
> scoped to `marc-portal` — the Vite SPA + Cloudflare Pages Functions app at
> [marcportal.com](https://marcportal.com).
>
> For human-facing docs, see `README.md` (quickstart), `RUNBOOK.md` (11pm
> incident triage), and `AUDIT.md` (working list of known gaps).

---

## What this app is

Marc's solo-practice client portal. **One active build + one in triage. No
exceptions.** That capacity rule is enforced server-side in
`functions/_lib/sessions.ts` (`countActiveAndTriage`, etc.) — and the atomic
check is folded into the `UPDATE … WHERE` of `PATCH /api/sessions/:id` so two
simultaneous promotions can't both win. If a feature seems to want to raise
the cap, stop.

Stack: React 19 + Vite (SPA) → Cloudflare Pages. Pages Functions back the
`/api/*` surface, talking to D1 (SQLite), R2 (attachment blobs, optional),
Workers AI (Whisper, optional), Resend (email), Stripe (payments). Sentry
on both halves. **Multi-tenant** at the host level — every Function request
passes through `functions/_middleware.ts`, which resolves `Host` → tenant
via the `tenant_domains` table and 404s unknown hosts.

Quebec context drives several non-obvious decisions: Loi 25 residency, FR-
first bilingual UI, Québécois register in copy, in-network transcription
instead of a third-party processor. Treat these as load-bearing, not
preferences.

---

## Three load-bearing patterns to internalize first

### 1. Auth: HMAC session cookie + double-submit CSRF

`functions/_lib/auth.ts`. Format: `base64url(payload).base64url(signature)`,
HMAC-SHA-256, payload is `{e: email, x: expSeconds}`. The companion
`mp_csrf` cookie is **NOT HttpOnly** by design — the SPA reads it via
`document.cookie` and echoes it as `X-CSRF-Token` (see `src/lib/api.ts`).
Server compares header to cookie (`verifyCsrf`).

- `SESSION_SECRET` is validated at every sign/verify by `requireSessionSecret`
  (must be ≥ 32 chars). Missing/short throws `SessionSecretMisconfiguredError`
  rather than silently signing with `"undefined"`. **Do not** weaken this
  guard.
- The CSRF gate is **centralized** in `_middleware.ts` — handlers don't each
  remember to check. State-changing `/api/*` requests fail with 403 unless
  they appear in `CSRF_EXEMPT_PATHS`. Current exempt set: `auth/logout`,
  `auth/request-link`, `admin/digest`, `payments/webhook` (Stripe-signed),
  `vouches` (anon submission, IP-rate-limited), `intake/transcribe` (same).
  **Adding a new POST endpoint that needs no cookie? Add it to the exempt
  set explicitly — don't try to bypass at the handler.**
- Convenience helpers: `requireSignedIn(request, secret)` returns `email | Response`
  in the same shape as the rest of the codebase's "guard or return early"
  pattern. Use it instead of duplicating cookie reads.

### 2. Tenancy: host-routed, with a graceful pre-migration fallback

`functions/_middleware.ts` runs on every Functions invocation:

1. Resolves `Host` → `Tenant` via `resolveTenant(ctx.env.DB, host)`.
2. On `"no such table"` (migration 0002 not yet applied to this env), it
   **lets the request through without a tenant attached**. Legacy handlers
   keep working; admin handlers that strictly require a tenant call
   `requireTenant` and 500 cleanly. This is what keeps a fresh deploy
   working during the migration window — preserve this behavior.
3. Unknown host (table exists, no match) → terse 404. No tenant info leaked.
4. `tenant.status === 'frozen'` → 503 "This app is currently paused."

The middleware **also** owns: the first-visit FR/EN redirect on bare `/`
(cookie → Accept-Language), the central CSRF gate, and the OG-tag rewrite
via `HTMLRewriter` (FR↔EN OG image swap, per-share dynamic card, per-page
hreflang injection). Bot scrapers don't run JS — this rewrite is the only
reason their cards are correct.

### 3. The capacity cap is structural, not advisory

`/api/capacity` is the single read-side source of truth — no static fixture
exists. The home counter, the intake gate, the operator hub all read it.
On the write side, every transition that would push past 1+1 is rejected
with 409 by an atomic SQL guard. When touching session lifecycle code:

- Don't add a code path that creates an `active` or `triage` row outside
  the existing transition guard.
- Don't replace the in-WHERE subselect with a read-then-write — that's the
  race that was closed in P1.7 (see `AUDIT.md`).

---

## Build pipeline (what each phase actually does)

`npm run build` runs three phases. Skipping any of them in a script will
ship a broken bundle:

| Phase | Script | Why |
| --- | --- | --- |
| **prebuild** | `build-sitemap`, `check-og-image`, `build-lac-meta`, `build-portal-stats`, `build-map-skeleton`, `build-atelier-gallery` | Generates static JSON the SPA imports at runtime. Skipping = stale `/meta`, stale `/carte`, stale OG hash check. |
| **build** | `tsc -b && vite build` | Project-references TS build, then Vite. |
| **postbuild** | `scripts/prerender.mjs` | Drives Playwright + Chromium to snapshot the homepage to static HTML. CI installs Chromium for this; locally it's skipped if Playwright isn't installed. |

Three additional things to know:

- **`createRoot`, not `hydrateRoot`.** See `src/main.tsx` — the prerender is
  a post-effect browser capture, never byte-matches React's first render.
  We get the FCP/SEO win from the prerender, then React renders fresh over
  it. Don't "fix" this back to hydration.
- **Self-hosted webfonts.** `scripts/fetch-webfonts.mjs` generates
  `public/fonts/webfonts.css`. No Google Fonts CDN — Loi 25, visitor IP
  never reaches Google. Don't add `<link>` references to third-party fonts.
- **Sentry DSN is hardcoded** in `src/lib/sentry.ts` and
  `functions/_lib/sentry.ts`. DSNs are public-by-design (they ship in every
  visitor's bundle anyway). Vite reads env at *build* time, wrangler.toml
  vars are *runtime* — hardcoding collapses both. Rotation = code change +
  push.

---

## D1 migrations — forward-only and filename-locked

Numbered `.sql` files in `functions/db/migrations/`. Wrangler tracks
applied state **by filename**. **Never rename a migration that has run** —
the next `db:migrate:prod` will try to re-apply it and fail with
duplicate-table/column.

- `npm run db:migrate:local` for dev.
- `npm run db:migrate:prod` to push manually; `deploy.yml` runs it
  automatically before every prod deploy (idempotent — wrangler no-ops
  already-applied migrations).
- Migrations must be small + additive. D1 has per-statement timeouts;
  long ALTERs aren't safe. There is no rollback path — ship a forward fix.
- When adding a migration, also extend `functions/db/migrations/README.md`'s
  table — that's the human index.

---

## CI workflows (quirks you need to know)

| Workflow | When | Quirk |
| --- | --- | --- |
| `check.yml` | every push | Typecheck + lint + format + test + build. No e2e. |
| `e2e.yml` | **PR only** | Runs on **`windows-latest`** because the baseline PNGs were rasterized there — a Linux runner diffs every screenshot on font anti-aliasing. ~30 min, 2× billing → PR-only. |
| `e2e-snapshots.yml` | manual | Regenerates the committed baselines on the runner (only safe way to keep them in sync with the gate). **Serialised via `concurrency` group with `cancel-in-progress: false`** — overlapping runs both rewrite the same binary PNGs and the second one's rebase explodes. Rebases before pushing to dodge the lighthouse auto-commit. |
| `e2e-backend.yml` | PR only | Real Pages Functions + ephemeral D1 (under `.wrangler-e2e/`) + **stubbed Stripe via sentinel `STRIPE_SECRET_KEY`** (see `functions/_lib/stripe.ts` → `E2E_STUB_API_KEY`). No Stripe creds needed in CI; no test-dashboard pollution. |
| `deploy.yml` | push to main | Applies D1 migrations → deploys → stamps each `*.feature.json` touched in the commit with the build URL, commits with `[skip ci]`, also stamps `session_advancements` rows in D1. |
| `lighthouse.yml` | `workflow_run: deploy completed` | 5 runs against the live site, records the median to `src/data/lighthouse-history.json`. Commits with `[skip ci]` (otherwise it'd recursively trigger deploy → lighthouse). |

**Direct pushes to `main` skip the e2e gate.** That's by design (cost) but
means a broken screenshot can ship if you bypass the PR flow. Open a PR or
`gh workflow run e2e.yml` when in doubt.

---

## SPA conventions

### Routing
`src/router.tsx`. FR and EN routes are registered **explicitly in parallel**
— no `/:lang?` param. Components receive `lang` as a prop. This is
deliberate; the duplication is the price of compile-time language coverage
and predictable redirects. Don't try to collapse it.

- **Hot path eager:** `Home`, `Intake`, `Login`, `MagicLinkSent`, `NotFound`,
  `RouteError`. Keep these eager.
- **Cold path lazy:** everything else (operator surfaces, demos,
  authenticated pages). Adding a new public marketing page? Lazy by default.

### i18n — three patterns, pick by rule

Documented in detail at the top of `src/i18n.ts`. TL;DR:

1. **`DICT[lang].section`** (in `src/i18n.ts`) — for shared chrome and the
   long marketing copy. `typeof FR` is the compile-time parity contract.
2. **Inline `const COPY = { fr, en } as const`** at the top of one
   component — for operator-only surfaces (Privacy, Pia, Handoff, Map,
   AdminHub, AdminRunbook). Avoids bulking up `i18n.ts` with strings
   nothing else uses.
3. **`Bi { fr; en }` on data items** — for lists of bilingual records
   (`trackA.ts`, `trackB.ts`, map nodes/groups).

**Anti-patterns:** inline ternaries (`{lang === 'fr' ? '…' : '…'}`),
mixing patterns in one file.

### Styling
Single `src/styles.css`, design-token-driven. Day palette =
`:root`; night = `:root[data-theme='night']`. `public/theme-bootstrap.js`
runs before React mounts to set `data-theme` from `localStorage` →
`prefers-color-scheme` — preserves the chosen surface across reloads
without flash. **No CSS-in-JS.** No Tailwind. No styled-components. The
boring-tech mandate is real.

### Auth + data on the client
- `src/lib/api.ts` wraps every `/api/*` fetch — handles CSRF echo,
  credentials, JSON error parsing. **Use it.** Don't call `fetch` directly
  for API endpoints.
- `AuthProvider` and `TenantProvider` (in `src/lib/`) wrap the router in
  `main.tsx`. They expose `useAuth()` / `useTenant()`. No external state
  lib by design.

### Components & co-located feature docs
- `src/pages/*.tsx` — top-level route components, one per page.
- `src/components/*.tsx` — shared UI. Use existing primitives
  (`SectionEyebrow`, `PageMast`, `FeatureDot`, etc.) before inventing new
  chrome.
- `*.feature.json` files (e.g. `src/pages/Home.feature.json`,
  `functions/api/capacity.feature.json`) are LAC feature docs. They live
  *next to the code they document*. `scripts/build-lac-meta.mjs` globs
  them at prebuild → `src/data/lac-features.json` → rendered by `/meta`.
  Touching a `*.feature.json` triggers an auto-stamp from `deploy.yml`.

---

## CF Pages env-var pattern (constraint, not preference)

This project uses **wrangler.toml-managed env vars**. That means:

- **Plaintext vars** (incl. `VITE_*`, Stripe price IDs, anything not
  secret) live in `wrangler.toml [vars]`. **Not in the dashboard.**
- **Encrypted secrets** (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
  `SESSION_SECRET`, `RESEND_API_KEY`, `CF_API_TOKEN`, `DIGEST_TOKEN`) are
  set via `wrangler secret put NAME`. The dashboard's "Variables and
  Secrets" UI can edit these but **not** plaintext vars in this mode.

When something silently doesn't reach the build, this is usually why.

For local dev, the same names live in `.dev.vars` (gitignored). See
`.dev.vars.example` for the shape.

---

## Files Claude must never read

These are gitignored for a reason. Reading them pulls live production
secrets into the conversation transcript, which is a leak even if nothing
gets written back to disk.

- **`.dev.vars`** — live Stripe TEST key, Resend API key,
  `SESSION_SECRET`, Stripe webhook secret. Use `.dev.vars.example`
  instead — it has the *shape* without the values.
- **`.env`, `.env.local`, `.env.*.local`** — same reason. None exist
  today but the rule applies to anything matching the pattern.
- **`wrangler secret` outputs** — if you run `wrangler secret list` or
  similar, treat the output as read-once: report counts, never echo
  values.
- **Anything inside `.wrangler/` or `.wrangler-e2e/`** — Miniflare's
  on-disk persist dirs may serialize bindings, including secrets.

When sweeping the codebase, **filter these out of any glob/grep result**
before reading. The shape and purpose of `.dev.vars` is documented in
`.dev.vars.example` and `wrangler.toml`'s comment block — that's the
information you actually need; the values are not.

If a secret *has* leaked into a session (Claude read the file, or it
appeared in tool output), say so plainly and recommend rotation rather
than continuing as if it didn't happen. Stripe test keys, Resend keys,
and `SESSION_SECRET` are all 2-minute regenerations from their
respective dashboards / `openssl rand -hex 32`.

---

## Graceful-degrade pattern (used everywhere — keep using it)

Optional bindings (`MEDIA` R2, `AI` Workers AI, `STRIPE_*`, `CF_API_TOKEN`)
follow the same pattern: when unset, the corresponding endpoint returns
`503` (or hides the UI) with a clear message; the rest of the app keeps
working. New optional bindings should:

1. Be `optional` in `functions/_lib/env.ts`'s `Env` interface.
2. Check `if (!env.XYZ) return serviceUnavailable('…')` at the handler entry.
3. Document the degraded behaviour in the `Env` field's comment and in
   `wrangler.toml`'s instructions block.

---

## House voice — copy

This site sells a *human* solo Québécois dev. Copy that pattern-matches
ChatGPT undercuts the pitch directly. Two layers to internalize: the FR
register, and the anti-AI tells (which apply to both languages).

### FR is Québécois, not France

The bilingual contract isn't FR/EN — it's `fr-CA`/`en-CA`. Pick local
register over generic French.

- **Lean in:** "fait que", "tannant", "céduler", "ben", "pis", "tu veux-tu",
  "à soir", "asteure" when the tone allows. The verb "céduler" exists in
  Quebec French; use it rather than "programmer un rendez-vous". A solo
  dev's portal reads like a person, not a product team's localization PO.
- **Drop:** "alors donc", "c'est dingue", "kiffer", "truc/machin" as
  filler, "courriel/mail" inconsistency (use **courriel** — Quebec
  standard), formal "vous" for visitor-facing copy unless the surface is
  literally a legal document (`/confidentialite`, `/pia`). First-person
  singular voice ("je", "moi", "j'ai") is the default — Marc speaks for
  himself.
- **Punctuation spacing:** Quebec/France French inserts a non-breaking
  space before `:`, `;`, `!`, `?`, `»` and after `«`. But the Vite build
  pipeline **strips literal U+00A0 / U+202F from string literals** — they
  collapse to a plain space in the bundle. Use the `frPunct()` helper
  (a nowrap `<span>`) instead of typing the NBSP directly. See project
  memory `project_build_strips_nbsp` and commit
  `fix(portal): render French punctuation spacing with a nowrap span`.
- **Parity is a contract, not a suggestion.** `typeof FR` in `i18n.ts`
  catches missing EN keys at compile time. For inline `COPY = { fr, en }`
  blocks, eyeball each addition — never ship one language ahead of the
  other. If the FR phrasing is idiomatic enough that the EN translation
  feels stilted, rewrite the EN to a different idiom rather than chasing
  word-for-word.
- **Don't translate; rewrite.** "J'aime ça simple." → "I like it small."
  not "I like it simple." The vibe survives; the noun changes. Commits
  like `i18n(fr): tighten Québécois register, drop France-y phrasing` are
  the model.

### Don't sound AI-generated (FR or EN)

This is the rule that fired today on the em-dash-on-hover button: a
decorative pattern that looked AI-y, even though it was just CSS. The
filter applies to copy, microcopy, comments, commit messages, *and*
visual treatments.

**Banned by default — needs an explicit reason if you reach for one:**

- **Em-dash density.** One " — " in a paragraph is fine. Setting off a
  clause this way in every UI string is the tell. Prefer periods, colons,
  subordination, parentheses, conjunctions. Commit
  `style(copy): replace em-dashes with lighter punctuation in i18n` is the
  precedent.
- **Negation-anaphora.** "Pas un X. Pas un Y. Un Z." / "Not X. Not Y. A Z."
  reads as a chatbot crescendo. Dissolve into one real sentence with
  texture.
- **Rule-of-three triads of parallel nouns** ("clarity, honesty,
  follow-through"). Three is fine; flat parallelism is the tell. Give
  each item its own verb, length, or angle so it reads uneven.
- **Hedging filler.** "I'd love to help you with…", "Let's dive into…",
  "It's worth noting that…", "This is a great question." Cut. The voice
  is direct.
- **Marketing superlatives** absent evidence. "World-class", "best-in-
  class", "industry-leading". A solo dev doesn't claim these and the
  visitor doesn't believe them.
- **Visual tells:** gradient-clipped text (`-webkit-text-fill-color:
  transparent`), uniform staggered slide-up reveals, rounded status-badge
  pills with a coloured dot, decorative horizontal strokes appended via
  `::after` (today's bug), big floating CTAs with shadow lifts. Reveals
  are opacity-only ("ink-in"); status is a mono ledger tag with a
  filled/hollow square; CTAs sit on the page.

When in doubt, the Québécois register is itself the strongest anti-
generic move. A line nobody outside Quebec would phrase that way is by
definition not chatbot output.

---

## House voice — code

Marc is one human reading code at 11pm. That constrains every choice.

### Comments explain *why*, not *what*

Read `functions/_middleware.ts`, `functions/_lib/auth.ts`, or
`wrangler.toml` — those are the house style. Every non-trivial block
carries a comment that:

1. States the *intent* (what failure mode this prevents, what trade-off it
   accepts).
2. Anticipates the next reader's question ("Why not X?" / "Why not the
   simpler thing?").
3. Points to evidence — a commit, an audit item, a Loi 25 reference, an
   external constraint.

Example, from `auth.ts`'s `requireSessionSecret`:

> Without this guard, `TextEncoder().encode(undefined)` produces the bytes
> for the literal string `"undefined"` — a publicly-known HMAC key that
> would silently downgrade every cookie to forgeable. Type signature of
> `string` doesn't catch this; only runtime does.

That's the bar. Not "validates the secret" — the *reason it exists*.

When you add a comment that just narrates the next line ("// loop over
items", "// return the result"), delete it. The variable name or the
function name should already say that.

### Names are plain. No enterprise nouns.

- `requireSignedIn`, `currentEmail`, `isActiveAtCap`, `verifyCsrf`,
  `resolveTenant`, `serviceUnavailable`. Verbs say what they do. Nouns are
  what the codebase actually has.
- **No** `Manager` / `Service` / `Provider` / `Helper` / `Util` suffixes
  unless the file genuinely is that thing (`AuthProvider` is a React
  context provider, which is what the suffix means in React land — fine).
- **No** abstract factories, dependency-injection containers, base
  classes "for future extensibility". A solo dev writes the concrete thing
  and refactors when the second caller actually appears.

### Use what's already there before inventing

Before writing a new helper, look:

- **HTTP responses** — `_lib/json.ts` has `ok`, `badRequest`, `unauthorized`,
  `forbidden`, `notFound`, `conflict`, `payloadTooLarge`,
  `unsupportedMediaType`, `serviceUnavailable`, `tooManyRequests`,
  `serverError`. Use them.
- **Auth gate** — `requireSignedIn(request, secret)` returns `email | Response`.
  Use the early-return shape, not a re-implemented cookie read.
- **Tenant gate** — `requireTenant(ctx)` (in `_lib/tenant.ts`). Same shape.
- **Client API** — `src/lib/api.ts` is the only path to `/api/*`. It
  handles CSRF, credentials, JSON-error parsing.
- **UI primitives** — `SectionEyebrow`, `PageMast`, `FeatureDot`,
  `CrossFeatureLink`, `FeatureContinue`, the home-section helpers in
  `lib/folios.ts` + `lib/features.ts`. The grep-before-build rule applies.

### No premature abstraction

A handler that needs to do three things does three things, in order, in
one file. Pull out a helper when you'd repeat it — not when you "might."
The codebase has very few files under `_lib/`; that's deliberate.

### Catch only where you can do something

`try/catch` to suppress is a smell. The middleware catches *and* reports
to Sentry *then* rethrows — that's the pattern when the right action is
"observe and let it propagate." If you're catching to log-and-continue,
explain in the comment why the operation is non-essential (see the
"magic-link cleanup errors don't fail the digest" comment for the model).

### Test at the right boundary

- **Vitest unit tests** (`*.test.ts`) for pure functions — date
  formatters, draft serialization, unread math, swap-lang-path.
- **Vitest + happy-dom** for components that have logic worth testing
  (`IntakeSummary.test.tsx`, `SessionStatusStrip.test.tsx`).
- **Vitest** for backend logic (`functions/_lib/*.test.ts` —
  advancements, ratelimit, sessions, vouches, attachments, auth).
- **Playwright (screenshot suite)** for visual regression and click
  coverage.
- **Playwright (backend suite)** for the integration loop — checkout →
  Stripe-stubbed webhook → D1 → `/me`. **Sentinel-stub the real service**
  (`E2E_STUB_API_KEY` in `functions/_lib/stripe.ts`) rather than mocking
  the SDK. The closer to production the test runs, the more bugs it
  catches.

Don't add a test that mocks everything the handler does — that test
asserts the handler exists, not that it works.

---

## Full solutions, no cut corners

When you add a feature, finish the whole loop. The cost of half-shipping
is paid by every future Claude session and by Marc at 11pm.

**A complete feature touches all of:**

1. **Schema** — D1 migration if state needs to persist. Numbered, additive,
   small. Update `functions/db/migrations/README.md`'s table.
2. **Server handler** — request validation, CSRF (unless explicitly
   exempt), auth/tenant gates as needed, real status codes
   (`badRequest`/`conflict`/`serviceUnavailable`), Sentry-friendly errors
   that don't swallow the cause.
3. **Optional-binding fallback** — if the feature needs a binding that
   might be unset (R2, AI, Stripe, CF API), match the existing
   graceful-degrade shape: 503 with a clear message, UI hides itself.
4. **Client UX** — loading state, error state, empty state, success state.
   All four. "Empty" is the one that gets cut; don't.
5. **i18n parity** — FR + EN written together. The Québécois rewrite, not
   a translation.
6. **Tests** — unit on the logic, integration on the boundary. Backend
   e2e if the feature crosses the checkout/webhook/DB boundary.
7. **Visual baseline regeneration** — if a screenshot-sensitive area
   changed: `gh workflow run e2e-snapshots.yml` from the PR, then commit
   the regenerated baselines. Don't merge a PR with the visual gate red
   on a change you made.
8. **`feature.json` doc** — co-located next to the code, walk it through
   the LAC lifecycle (`draft → active → frozen`). The `/meta` page picks
   it up automatically at next build.
9. **`RUNBOOK.md` entry** — if the feature has a failure mode that can
   surface at 11pm (email deliverability, payment webhook, schema drift,
   third-party outage), add a section.

**When something has to be deferred, write the deferral properly.**
`AUDIT.md` is the model — see how P1.3 (Resend outbox), P1.8 (napkin PNG
→ R2), P1.9 (iframe sandbox) are written. Each carries:

- The reason it's not done now (multi-step refactor, awaiting external,
  defense-in-depth already in place).
- The conditions that would re-open it ("when napkin volume hurts query
  times", "when DNS access is available").
- The interim mitigation if any (the 1 MB intake cap holding the line for
  the napkin issue).

A line in a TODO comment that says "// TODO: do this later" is not a
deferral, it's a debt accrued silently. If something is worth deferring,
it's worth writing the paragraph.

**Atomicity matters.** The capacity-cap race fix (`AUDIT.md` P1.7) is the
canonical example — the cap check used to be `SELECT count → if ok →
UPDATE`, which two concurrent PATCHes could both pass. Fix folded the
count into the UPDATE's WHERE as a subselect, so the UPDATE affects 0
rows when at cap and we return 409 from `result.meta.changes === 0`.
When you see read-then-write across a request boundary, look harder.

**Forward-only applies to copy and visuals too.** Don't merge a change
with "we'll iterate" as the closing argument. Iterate first, merge once.
The `chore(e2e): regenerate visual baselines` commits show what
"finished" looks like.

---

## What NOT to do (quick checklist — see sections above for the why)

- Don't `npm install` a state lib, CSS framework, or runtime style lib.
- Don't rename or reorder migration files.
- Don't put plaintext config in the Pages dashboard — edit
  `wrangler.toml [vars]`.
- Don't bypass `src/lib/api.ts` for `/api/*` calls (you'll lose CSRF).
- Don't widen the CSRF exempt list without an explicit comment justifying it.
- Don't add `<link>` to a third-party font CDN (Loi 25).
- Don't switch `createRoot` back to `hydrateRoot`.
- Don't write copy with em-dash per sentence, negation-anaphora, or
  marketing superlatives. See "House voice — copy".
- Don't add `Manager`/`Service`/`Helper` suffixes or abstract factories.
- Don't try/catch to suppress. Catch where you can do something specific.
- Don't add a TODO comment instead of an `AUDIT.md` entry with a rationale.
- Don't `git push --no-verify` unless the lockfile fix is already on
  origin (see RUNBOOK §4).
- **Don't read `.dev.vars`, `.env*`, or anything else gitignored as a
  secret file.** Use `.dev.vars.example` for shape. See "Files Claude
  must never read" above.

---

## When something breaks

`RUNBOOK.md` is the 11pm triage doc — magic-link emails not arriving, D1
500s, custom-domain 404s, lockfile CI failure, stale cache, cookie forgery,
triage piling up. It's keyed to symptoms first, fixes second. Read that
before guessing.

For the working list of known gaps + their priority/status, see `AUDIT.md`.
Items there are tagged P1/P2/P3 and ⬜🟡✅⏭❌⚠ — pick from open P1/P2
when freelancing for impact.
