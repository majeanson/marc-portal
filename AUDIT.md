# Audit — Corner Cuts & Gaps

> Started: 2026-05-15. Working file. Each item is atomic and self-contained so
> a future resumer can pick up cold without re-reading the source audit.
>
> Status legend: ⬜ todo · 🟡 in progress · ✅ done · ⏭ deferred (intentional) ·
> ❌ won't do · ⚠ blocked (external dep)
>
> Priority legend:
> - **P1** — load-bearing or one-foot-of-rope-from-a-prod-incident; do first.
> - **P2** — meaningful gap, but not actively bleeding.
> - **P3** — polish, cleanup, future-friendly.
>
> When working an item: flip it to 🟡, link the commit when done, flip to ✅.

---

## P1 — High impact, do first

### Email / deliverability
- ⬜ **P1.1** — Verify a custom Resend sender domain; replace `onboarding@resend.dev`
  in `functions/_lib/email.ts:6` (and `functions/api/admin/digest.ts:19`). Until
  this lands, magic links land in Gmail/Outlook spam. Runbook §1 acknowledges
  this as the #1 prod incident. ⚠ Needs DNS access on Marc's domain — user
  action required first (SPF/DKIM/Return-Path).
- ⬜ **P1.2** — Wire Resend bounce + complaint webhooks. Hard-bouncing addresses
  should be flagged in D1 and skipped on future sends. Otherwise the digest cron
  keeps emailing dead addresses forever.
- ⬜ **P1.3** — Surface Resend send failures somewhere. Today `send()` returns
  `false`, only `console.error`. No retry, no dead-letter, no alarm. Pick one:
  store failed sends in an `email_outbox` table for manual retry, OR wire to
  the same alerting path as P3.x observability.

### Auth / session safety
- ✅ **P1.4** — CSRF double-submit cookie. Server (`functions/_lib/auth.ts`)
  mints `mp_csrf` (non-HttpOnly) alongside the session cookie at magic-link
  verify; self-heals on `GET /api/me` for sessions issued before the rollout.
  Middleware (`functions/_middleware.ts`) gates every state-changing /api/*
  request with `requireCsrf` — header must match cookie. Exempt:
  `/api/auth/logout` (forced-logout is a nuisance, not a compromise),
  `/api/auth/request-link` (no cookie yet on first visit), `/api/admin/digest`
  (out-of-band auth via X-Digest-Token). SPA `api()` wrapper reads the cookie
  and echoes it as `X-CSRF-Token`; `attachmentsApi` now routes through the
  wrapper. 6 new tests cover the verifier.
- ✅ **P1.5** — Per-IP rate limit on `/api/auth/request-link`. Split the old
  "5/h per email OR ip" into two independent ceilings: 5/h per email +
  20/h per IP. Catches the rotating-email-same-IP attack. New test
  `auth-handlers.test.ts` exercises it.
- ✅ **P1.6** — Magic-link token cleanup piggybacks the daily digest cron
  (`POST /api/admin/digest`): rows older than 24h are pruned before the
  inbox-nudge logic runs. Errors don't fail the digest (best-effort).
- ✅ **P1.7** — Capacity-cap race closed. The dangerous race was in
  `PATCH /api/sessions/:id { status }` — not the POST. POST creates `draft`
  rows that don't count against the cap; the real cap violation could only
  happen when two simultaneous PATCHes promoted two rows into `triage` or
  `active`. Fix folds the count check into the UPDATE's WHERE clause as a
  subselect, so the UPDATE affects 0 rows when at cap and we return 409 from
  `result.meta.changes === 0`. Atomic in SQLite. Mock updated, tests pass.

### Napkin PNG schema bomb
- ⬜ **P1.8** — Move napkin PNG out of `intake_json` (data-URL inside JSON column)
  into an R2 attachment. A 500 KB sketch base64-encodes to ~666 KB and rides
  along on every `SELECT` that includes `intake_json` — `/api/sessions` list,
  `/api/admin/digest` (which pulls `intake_json` for triage rows it only needs
  text from), session detail load. Approach:
    1. Upload napkin to R2 on submit (or via existing attachment endpoint),
       store `r2_key` + `text` inside `intake_json` instead of the PNG bytes.
    2. SessionPage renders the napkin via a signed-URL fetch, not inline.
    3. Migrate existing rows: scan `intake_json` for `napkin.png` starting with
       `data:image/`, write to R2, replace with `{ r2_key, text }`. Backup
       D1 first.
  ⚠ Decide: do we ship this now, or accept that the dataset is tiny and defer
  until row sizes actually hurt? Today there are probably <10 napkin rows total.

### Iframe sandbox
- ⏭ **P1.9** — Drop `allow-same-origin` from iframe sandboxes. **Deferred with
  rationale.** Every iframe embed today is cross-origin (snd-demo.pages.dev,
  jaffre.vercel.app, retrodio.vercel.app, etc.); the browser's same-origin
  policy already prevents the embed from reading the marc-portal parent. The
  `allow-same-origin` flag is dangerous only when the iframe URL is on the
  SAME origin as the parent — not the case here. Revisit if showcases ever
  move to `*.marc-portal.pages.dev` (CSP `frame-src` allows it today, but no
  build currently uses it).
  Files reviewed: `ProjectCardPreview.tsx:96`, `TimeTravelScrubber.tsx:126`,
  `SessionAdvancements.tsx:405`, `PublicAdvancements.tsx:133`,
  `engagement/EngagementPreview.tsx:25`.

---

## P2 — Meaningful gaps

### Auth
- ⏭ **P2.1** — Centralize `isAdmin` email-lowercase normalization. **Deferred.**
  The current implementation in `functions/_lib/env.ts:27` already
  `.trim().toLowerCase()`s both the haystack and the needle, and CF Pages env
  vars don't reload mid-process. The concern I raised was speculative; no
  actual bug exists. Revisit if a second normalization site appears.
- ⬜ **P2.2** — Logout doesn't invalidate the cookie server-side (HMAC is
  stateless). For real revocation, add a `revoked_sessions` table or a
  `min_issued_at` per-user column and check it in `verifySessionCookie`. Today
  the only way to revoke all sessions is rotating `SESSION_SECRET`.

### Sessions / data
- ⬜ **P2.3** — `status_history` is a JSON column in TEXT. Can't query
  "everything that changed status this week" without scanning every row. If we
  ever want admin-side analytics, lift to a `session_events` table.
- ⬜ **P2.4** — `intake_json` is opaque TEXT — no indexed columns for `type`,
  `submittedAt`, etc. Inbox filtering by type means full scan. Acceptable at
  10s-of-rows scale; ugly at 1000s. Add denormalized columns when count grows.
- ⬜ **P2.5** — No `featured_position` / sort-order column on `sessions`.
  `/projects` is just `ORDER BY showcased_at DESC`. Marc can't pin a project to
  the top of the gallery.
- ✅ **P2.6** — Already-shipped (verified). Endpoint lives at
  `functions/api/sessions/[id]/attachments/[attId].ts`. Auth-gated (visitor-self
  or admin), images served `inline`, others as `attachment`, RFC 5987 UTF-8
  filename encoding, `cache-control: private, no-store`.

### OG / sharing
- ⏭ **P2.7** — workers-og font divergence. **Deferred** until a real-world
  divergence shows up — committing a TTF + plumbing it through satori adds
  ~150 KB of static asset and a fetch on every render for cosmetic gain.
  Document the known fallback (system serif on cold V8 isolates) in the OG
  function's comment when it bites.
- ⏭ **P2.8** — OG fallback caching. **Deferred — already mitigated.** The
  fallback redirect already sets `Cache-Control: public, max-age=60` (60s,
  not 24h), so a fix propagates in a minute. Inlining the static PNG bytes
  from inside the function would add latency for marginal gain.
- ✅ **P2.9** — HTMLRewriter skips `/api/*` and `/og/*` paths (cheap pathname
  check at the top of `rewriteOgTags`). Other HTML responses still get
  rewritten — handlers that return HTML errors won't be touched.
- ✅ **P2.10** — `og:url` is now rewritten by the middleware to the absolute
  URL of the current page (helps Slack/LinkedIn cache disambiguate). Added
  `<meta property="og:url">` placeholder to `index.html` so the rewriter has
  something to attach to. Note: `og:title` / `og:description` per-route is
  still client-side via `useEffect` (lower-stakes — bots already get a
  reasonable card with home title + per-page image).

### Routing / SPA
- ✅ **P2.11** — `src/pages/NotFound.tsx` renders a proper 404 with the path
  the visitor hit, links to home + intake. Wired as `<Route path="*">`
  replacing the previous silent home-redirect.
- ✅ **P2.12** — `src/pages/RouteError.tsx` is the root `errorElement` on the
  layout route. Surfaces "something went sideways" + Refresh button. Reuses
  the 404 copy for ErrorResponse-style 404s so the experience is consistent.
- ✅ **P2.13** — `RouteFallback` component (in `router.tsx`) renders three
  shimmer bars during lazy chunk fetch. Reduced-motion stops the animation.
- ⏭ **P2.14** — Route dedup. **Deferred.** Touching every route entry to
  parametrize `lang` is non-trivial (the `lang` prop is consumed inside
  components and the FR↔EN swap logic in Header depends on the exact path
  shape). The current duplication is real cost, but a partial refactor risks
  breaking the view-transition language swap. Worth doing when the next
  route surface is added (forcing the question fresh), not as drive-by work.

### Attachments
- ✅ **P2.15** — Magic-byte validation in `functions/_lib/attachments.ts`:
  before streaming to R2, the first ~12 bytes are checked against a known
  signature table for the declared content-type (JPEG, PNG, GIF, WebP, PDF,
  Office, zip). Mismatch returns 415. text/* and JSON pass through (no
  reliable signature). The stream is re-emitted so the upload path keeps
  working — no buffering the whole file. Full AV scan still requires an
  external CF Workers AV integration; that's a future-when-needed.
- ✅ **P2.16** — Orphan attachment GC piggybacks the digest cron. Deletes
  R2 object first (so we don't lose track of the key) then the DB row, for
  rows where `message_id IS NULL AND created_at < now - 7d`. Errors per-row
  don't kill the whole sweep.
- ✅ **P2.17** — Per-session storage quota added: `MAX_ATTACHMENT_BYTES_PER_SESSION`
  is 100 MB. Upload handler checks `SUM(size)` for the session before
  accepting a new file, returns `413 payload too large` if the budget would
  be exceeded.

### CSP / headers
- ⏭ **P2.18** — CSP `frame-src` hardcoded origins. **Deferred.** New
  showcases land at the rate of one every few months; an editing-redeploy
  cost there is fine. Loosening to wildcard origins reduces the protection
  for marginal convenience. Revisit if showcase cadence picks up.
- ✅ **P2.19** — `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
  added to `public/_headers`.
- ⏭ **P2.20** — CSP nonces. **Deferred.** Nonces in `_headers` require a
  build-time placeholder + Functions runtime substitution; Excalidraw injects
  inline styles into the document at runtime which would still need an
  `'unsafe-inline'` exception, defeating the point. Worth revisiting once
  Excalidraw is moved off `/napkin` (or replaced) and Google Fonts is
  self-hosted (P2.7-ish work).
- ✅ **P2.21** — `public/robots.txt` now disallows `/admin/`, `/en/admin/`,
  `/api/`, `/me`, `/en/me`, `/session/`, `/en/session/`, `/login`, `/en/login`.
  Anything that requires auth or shows per-user content is now off the crawl
  surface.

### Observability
- ⬜ **P2.22** — Pick an error tracker (Sentry, BetterStack, or just structured
  logs to a CF Logs analytics dataset). Today `console.error` is the only signal;
  prod incidents are debugged via `wrangler pages deployment tail`. Wire the
  client side AND the Functions side. ⚠ External account required.
- ⬜ **P2.23** — Synthetic monitor for `/api/health`. Cron-job.org (already used
  for digest) can ping every 5 minutes and email Marc on red. ⚠ External.

---

## P3 — Polish, cleanup, future-friendly

### Time-travel scrubber
- ✅ **P3.1** — Visible mono-pill keyboard hint ("Arrows ← / → to step, Space
  to play/pause"). `aria-describedby` ties it to the section root for AT.
- ✅ **P3.2** — Dropped `role="application"` and the inline eslint-disables.
  Keyboard handler now lives at the window level and only acts when focus is
  inside the scrubber root. Buttons are real `<button>`s so Tab + Enter +
  Space all work naturally; Space-toggle-play only fires when focus is on a
  non-button element.
- ✅ **P3.3** — `?step=N` URL param. Reads on mount (1-indexed for humans;
  matches the visible "Step 3 of 5" label), pushes back via replaceState on
  every idx change. Shareable links land at the right scrub position.

### Napkin
- ✅ **P3.4** — Excalidraw scene autosave. Scene JSON (small) is written to
  `marc-portal:napkin-scene` every 800ms when shapes exist; restored via
  `updateScene` once the dynamic Excalidraw chunk's API is wired. Cleared
  on successful submit so a fresh visit starts clean.
- ✅ **P3.5** — Server-side cap on intake payload (1 MB) in `POST /api/sessions`.
  Refuses oversized data-URL napkins with 400. Less critical once P1.8 lands
  but defends against misbehaving clients in the meantime.

### SEO / i18n
- ✅ **P3.6** — Hreflang now injected by `functions/_middleware.ts` via
  HTMLRewriter (`head` element append). Crawlers see them on first byte
  without running JS. Per-page mapping — `/projects` shows `/en/projects` as
  its EN alternate, not just `/en`. Tried index.html first; bare-path hrefs
  trip Vite's asset resolution, hence the middleware approach.
- ✅ **P3.7** — Locale detection in middleware. On `GET /`, an Accept-Language
  preferring EN gets 302'd to `/en`. Explicit choice via the FR/EN header
  toggle writes `mp_lang` cookie (1-year horizon, SameSite=Lax) which wins
  over Accept-Language on subsequent visits.
- ⬜ **P3.8** — Type-safe i18n. Hand-rolled `DICT[lang]` (~1100 lines). Adding
  an FR key and forgetting EN is silent. Either a TS `satisfies` check across
  shapes, or migrate to a typed library (i18next is overkill here; a `Record<Lang,
  Dict>` with shared shape constraint would do).

### Tests
- ⬜ **P3.9** — Tests for `/og/share/:id`: rendering, fallback redirect, debug
  mode. Today it's the most fragile prod-only path.
- ⬜ **P3.10** — Tests for `_middleware.ts` HTMLRewriter rewrites.
- ⬜ **P3.11** — Tests for attachment upload + download (POST + GET).
- ⬜ **P3.12** — Tests for the Napkin → Intake → SessionPage round trip
  (component-level, mock-D1 backed).
- ⬜ **P3.13** — Visual regression on the OG card output (snapshot the PNG
  buffer in a unit test; if rendering drifts, alarm).
- ⬜ **P3.14** — Tests for the time-travel scrubber (keyboard nav, play/pause,
  empty/single-build empty-state).
- ⬜ **P3.15** — One Playwright happy-path E2E (intake submit → magic link →
  /me appears). Catches CSP regressions, view-transitions oddities. ⚠
  Playwright is heavy; vitest-based browser-mode might be enough.

### Admin
- ⏭ **P3.16** — Hidden admin surfaces. **Deferred — keep as direct-URL
  routes.** The components compile cleanly, nothing breaks, and they cover
  the buyer-admin scenario IF Marc ever sells the platform to a buyer who
  needs them. Deleting them now means re-writing later. Cost of carrying:
  ~0 (lazy chunks, never loaded by default users; sidebar already hides
  them). The Admin.tsx comment already documents the rationale.
- ✅ **P3.17** — Audit log UI: client-side actor + action substring filters,
  match-count badge, clear button. Server-side date range deferred (small
  log size; client filtering is plenty).

### Misc
- ✅ **P3.18** — Rewrote the stale comment in `src/components/About.tsx` to
  document the actual purpose of the `onError` fallback instead of the
  no-longer-relevant "placeholder" framing.
- ✅ **P3.19** — `package.json` version set to `0.0.0` to signal "not tracked"
  (this is a `private: true` app, deploys are git-SHA-tracked, no consumers
  depend on the field).
- ✅ **P3.20** — OG image drift check. `build-og-image.mjs` now writes
  `public/og-image.hash.json` (SHA-256 of each SVG); `check-og-image.mjs`
  re-hashes and fails on mismatch. Wired into `prebuild` so CI catches the
  "edited SVG, forgot to regenerate PNG" case before deploy.
- ⏭ **P3.21** — Cookie consent banner. **Deferred.** All current cookies are
  strictly functional: `mp_session` (auth), `mp_csrf` (auth), `mp_lang`
  (UX preference, no tracking). Loi 25 doesn't require consent for strictly
  functional cookies. No analytics, no third-party trackers. If/when any
  analytics lands, revisit. The Privacy page (`/confidentialite`) already
  documents what's stored. Adding a banner now would be cosmetic compliance,
  not real protection.
- ⏭ **P3.22** — `feat-*` dirs at workspace root. **Deferred.** Moving them
  under `features/` would touch `lac.config.json` plus possibly hardcoded
  paths in `lac-mcp` tools that read these. The noise is real but contained;
  most ignore globs (.eslintignore, glob includes) can be tuned cheaper.

---

## Working notes / decisions log

- 2026-05-15 — Audit captured from /portal codebase walkthrough. Starting work
  from P1 top-down.
- 2026-05-15 — First batch shipped: P1.5 (per-IP rate limit), P1.6 (token
  cleanup on digest), P2.9 (middleware skips /api/, /og/), P2.21 (robots.txt
  disallow auth surfaces), P3.18 (About.tsx comment cleanup). P1.9 deferred
  with cross-origin rationale.
  - 154 tests pass (was 153 — added IP-ceiling test).
  - Typecheck + lint clean.
- 2026-05-15 — Second batch shipped: P1.7 (capacity-cap race closed via
  atomic UPDATE with cap-folded subselect), P2.11 (real 404 page), P2.12
  (route error boundary), P2.13 (Suspense skeleton), P2.19 (HSTS header),
  P3.6 (hreflang via middleware), P3.19 (version 0.0.0 to signal untracked).
  P2.1 deferred (was speculative; no real bug).
  - 154 tests pass. Typecheck + lint + build clean.
- 2026-05-15 — Third batch shipped: P1.4 (CSRF double-submit cookie + central
  middleware gate), P2.6 (attachment download verified already-shipped),
  P2.10 (og:url per-route via middleware), P2.16 (orphan attachment GC on
  digest cron), P2.17 (per-session storage quota at 100 MB).
  - 160 tests pass (+6 for the new CSRF verifier). Typecheck + lint + build
    clean. `attachmentsApi.uploadAttachment` now routes through the shared
    `api()` wrapper for CSRF header attachment.
- 2026-05-15 — Fourth batch shipped: P3.1 (scrubber keyboard hint),
  P3.2 (scrubber a11y semantics — dropped role=application, window-level
  keydown), P3.3 (scrubber ?step=N deep-link), P3.5 (1 MB intake payload
  cap as defense-in-depth before P1.8).
  - 160 tests pass. Typecheck + lint + build clean.
- 2026-05-15 — Fifth batch shipped: P2.15 (magic-byte upload validation),
  P3.4 (Excalidraw scene autosave), P3.7 (locale detect on / + mp_lang
  cookie), P3.17 (audit log filters), P3.20 (OG SVG↔PNG drift check in
  prebuild). Plus a sweep of defer-with-rationale: P2.7, P2.8, P2.14,
  P2.18, P2.20, P3.16, P3.21, P3.22.
  - 160 tests pass. Typecheck + lint + build clean.
