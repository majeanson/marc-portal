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
- ⚠ **P1.1** — Custom Resend sender domain. Code is ready: the `RESEND_FROM`
  constant in `functions/_lib/email.ts` is already `noreply@marcportal.com`
  with the 4-record DNS set documented in the file's header comment.
  Currently DNS-blocked at the operator level — the records have not been
  added to Cloudflare DNS yet, so every send via this FROM 403s with
  "domain not verified". Activation steps in RUNBOOK §16 (one-time DNS +
  Resend Dashboard verify; ~10 minutes including propagation wait).
- ⚠ **P1.2** — Resend bounce/complaint webhook handler shipped at
  `POST /api/webhooks/resend`. Code-only landing: signature verification
  (Svix-style HMAC-SHA-256, `whsec_` prefix accepted), idempotency via the
  shared `webhook_events` table, persists every bounce/complaint/delivered/
  delayed/opened/clicked event into a new `email_events` table (migration
  0027) with a `subtype` column for "hard vs soft" bounce filtering.
  Informational `email.sent` events drop through without a row. Endpoint
  returns 503 while `RESEND_WEBHOOK_SECRET` is unset, so a stray request
  in the meantime is a non-event. 15 tests cover the verifier (good sig,
  tampered body, wrong secret, stale timestamp, missing headers, rotated
  multi-sig header) and the handler (unconfigured 503, bad-sig 401,
  ingestable 200, duplicate idempotency, informational ignore).
  Activation depends on P1.1 — no events flow until the domain is
  verified. RUNBOOK §16 carries the full DNS + dashboard + secret
  activation procedure as a single paragraph.
- ✅ **P1.3** — Resend send-failure outbox shipped. `email_outbox` table
  (migration 0026), durable opt-in via a new optional `outboxDb` arg on
  the 5 load-bearing send-sites (tier-assigned, refund-notice,
  installment-cleared, status-change, visitor-withdrawal). Magic-link is
  intentionally non-durable — it's re-requestable any time. When Resend
  fails (HTTP or thrown), the rendered email is persisted with
  `attempts=1`; the daily digest cron sweeps pending rows with
  exponential backoff (2^N minutes, capped at 1h) and an
  `OUTBOX_MAX_ATTEMPTS=5` ceiling so a permanently-bad row eventually
  stops looping. The sweeper logs per-run counters (retried / delivered
  / failed) so the digest's own log line surfaces outbox state.
  9 new tests cover the writer (success no-op, 502 enqueue, no-durable-no-op,
  tier-assigned kind) and the sweeper (retry happy path, attempts bump on
  failure, backoff skip, max-attempts ceiling, empty outbox).

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
- ✅ **P1.8** — Napkin PNG moved out of `intake_json` into R2. Two-phase
  intake submit: POST `/api/sessions` creates the session with just the
  editable scene + caption inline; the client immediately follows up with
  POST `/api/sessions/:id/attachments?kind=napkin` for the PNG. The
  attachments pipeline already had the R2 + magic-byte + per-session quota
  primitives — the change is a new `'napkin'` AttachmentKind value, an
  explicit `?kind=napkin` opt-in on the upload handler (one per session,
  image/png only), a correlated subquery surfacing `napkin_attachment_id`
  on every session row, and an orphan-sweep exemption (`kind != 'napkin'`)
  in the digest cron so a session-scoped napkin isn't reaped at the 7-day
  cutoff. Failure shape: a napkin-upload failure does NOT roll back the
  session — the orchestrator (`src/lib/submitIntake.ts`) returns the
  session + an optional `napkinUploadError` so the caller logs to Sentry
  but doesn't abort the submit. Intake cap dropped from 1 MB to 256 KB
  (defense in depth — a real intake without the PNG is well under 50 KB).
  Backwards-compat: legacy sessions whose napkin is still inline in
  `intake_json` continue to render via the data URL; the SessionPage
  parser prefers the inline `png` field when present, falls back to
  building the attachment URL from `napkin_attachment_id` otherwise.
  Tests: napkin AttachmentKind, `findNapkinForSession`, orphan-sweep
  exclusion, session SELECT projection, submitIntake split/failure cases.

### Attachment uploads (legacy file path)
- ⏭ **P1.10** — `kind='file'` thread-attachment upload path uses a
  hand-constructed `ReadableStream` (returned by `verifyMagicBytes`) and
  passes it to `R2Bucket.put` without a content-length. Surfaced by the
  napkin-upload e2e backend spec on 2026-05-24: Miniflare's R2 emulator
  hard-rejects with `TypeError: Provided readable stream must have a
  known length`. **Production Workers R2 accepts it** — Marc confirmed
  on 2026-05-24 that real attachments land via the existing UI. So this
  is a Miniflare-vs-prod environment difference, not a prod bug. The
  e2e backend harness can't exercise the file-upload path until either
  (a) the handler is routed through the buffered branch (same shape as
  P1.8's napkin fix — voice / sketch / napkin all buffer), or (b) the
  stream is wrapped in a `FixedLengthStream(file.size)` so Miniflare
  also sees a known length. **Deferred** — no prod impact, the e2e gap
  is the only real cost, and the next time the attachments handler is
  touched for another reason is the right window to fold this in.
  Reopen if a prod incident ever shows file uploads silently failing,
  or if we want e2e backend coverage for the file path.

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
- ⏭ **P2.2** — Logout server-side revocation. **Deferred.** Real revocation
  requires per-user `min_session_at` storage + an `iat` field in the cookie
  payload + a DB hit on every authed request. Cost: a per-request lookup,
  meaningful at scale. Benefit at current scale: marginal — the cookie is
  HttpOnly + SameSite=Lax, theft is hard, and rotating `SESSION_SECRET`
  remains the nuclear option for actual incident response. Reopen if a
  per-device session list becomes a user-facing requirement.

### Sessions / data
- ⏭ **P2.3** — `status_history` as JSON column. **Deferred — premature.**
  No current need to query "status changes this week" cross-session.
  Lift to a `session_events` table the day that need materializes.
- ⏭ **P2.4** — `intake_json` denormalization. **Deferred — premature.**
  At <100 sessions, full-scan filtering is sub-millisecond. Revisit at 1k+.
- ⏭ **P2.5** — `featured_position` column. **Deferred — no current need.**
  Marc isn't asking to pin a project. If the gallery ever holds enough
  showcases that the implicit `showcased_at DESC` ordering hurts, add then.
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
  Excalidraw is dropped or replaced (as of 2026-05-21 it's an inline panel
  in the intake form rather than its own page — still injecting inline
  styles) and Google Fonts is self-hosted (P2.7-ish work).
- ✅ **P2.21** — `public/robots.txt` now disallows `/admin/`, `/en/admin/`,
  `/api/`, `/me`, `/en/me`, `/session/`, `/en/session/`, `/login`, `/en/login`.
  Anything that requires auth or shows per-user content is now off the crawl
  surface.

### Observability
- ✅ **P2.22** — Sentry. Frontend uses `@sentry/react` (init in `main.tsx`,
  user identity synced from `AuthProvider`, route boundary forwards via
  `captureException` in `RouteError.tsx`). Functions side uses a hand-rolled
  envelope poster (`functions/_lib/sentry.ts`, ~80 lines, no SDK) wired into
  `_middleware.ts` — any unhandled handler throw reports with sanitized
  request context (cookie/auth/CSRF headers stripped) and the signed-in
  email. Both DSNs (`VITE_SENTRY_DSN` build-time, `SENTRY_DSN` runtime)
  default to silent no-op. Setup steps in RUNBOOK § Observability.
- ✅ **P2.23** — Synthetic monitor instructions in RUNBOOK § Observability.
  Reuses the existing cron-job.org account (already running the digest cron);
  target `/api/health`, 5-min interval, email on failure. Five-minute setup
  in the cron-job.org UI — no code change needed beyond the doc.

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
  - 2026-05-21 — superseded by the napkin fold into the intake form. The
    scene no longer has its own `marc-portal:napkin-scene` key; it lives in
    the intake draft (`draft.sketch`), debounced ~500ms and autosaved with
    the rest of the form. The editable scene ships in the payload and is
    re-openable on the session view.
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
- ⏭ **P3.8** — i18n type safety. **Already covered.** `i18n.ts` has
  `type Copy = typeof FR` + `const EN: Copy = {...}`. Adding a key to FR
  and forgetting EN is a hard compile error (Copy demands the field exists
  in both). The audit point was a false alarm — verified by reading the
  type chain.

### Tests
- ✅ **P3.9** — Tests in `functions/og/share/[id].test.ts`. Covers: missing
  id, session not found, soft-deleted, non-showcased, and the debug-mode
  JSON branch (happy + sad). workers-og is vi.mocked so the satori/resvg
  WASM isn't bootstrapped in tests.
- ✅ **P3.10** — Tests in `functions/_middleware.test.ts`. CSRF gate
  behaviour (block/allow/exempt) + locale redirect run in happy-dom. The
  five HTMLRewriter-dependent tests (OG/hreflang injection) `describe.skipIf`
  when HTMLRewriter is unavailable — run them under miniflare or
  `@cloudflare/vitest-pool-workers` for full coverage.
- ⏭ **P3.11** — Attachment upload/download tests. **Deferred.** Upload flow
  exercises R2 + magic bytes + linker; needs an R2 mock alongside the D1
  mock. Worth doing the day a bug shows up in this path — for now the code
  paths are covered by handler-level assertions and the `_lib/attachments`
  unit tests on magic-byte and size validation.
- ⏭ **P3.12** — Napkin round-trip test. **Deferred.** Would need a
  testing-library/react setup with a mock-Excalidraw (heavy). Manual smoke
  test on each release is cheaper than building the harness for now.
- ⏭ **P3.13** — OG PNG visual regression. **Deferred.** Snapshot testing the
  PNG buffer is brittle (font rendering varies across runtimes) and the
  current OG endpoint is well-covered functionally by P3.9. Real protection
  here is a manual eyeball on the Slack/Discord preview after each OG copy
  change.
- ⏭ **P3.14** — Scrubber tests. **Deferred.** Scrubber is fairly isolated;
  the manual flow (intake → ship 2+ advancements with build URLs → visit
  /share/:id) is cheap to spot-check. Heavy keyboard + iframe-state testing
  would need testing-library; not worth the harness today.
- ⏭ **P3.15** — Playwright E2E. **Deferred.** Heavy infra for one happy-path.
  Manual smoke after deploy + the unit + handler tests we have catch the
  realistic regression classes. Revisit when CI red shifts to "test passed
  but UX broke" repeatedly.

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
- ✅ **P3.21** — Loi 25 compliance for Sentry. Now real because Sentry is
  the first third-party processor receiving anything beyond plain
  functional state. Shipped:
  1. **PIA** authored at `docs/loi-25-pia.md` — covers art. 3.3 and art. 17
     requirements (cross-border, US recipient, mitigations).
  2. **Notice** added to `/confidentialite` (FR) + `/en/privacy` (EN) —
     new section 6 (Sentry-specific) plus updates to §2 and §5. Anchor IDs
     on each section so cross-references resolve.
  3. **Code minimization**: `setSentryUser` admin-gated (visitor email
     never reaches Sentry); `beforeSend` strips URL query strings,
     breadcrumb URLs, `user.ip_address`. Server side mirrors.
  4. **RUNBOOK** has the operator's one-time Sentry dashboard checklist
     (DPA, retention 30d, IP-disable, scrubber) + access-request playbook
     + breach-response playbook.
  5. Cookies (`mp_session`, `mp_csrf`, `mp_lang`) remain strictly functional
     — no consent banner required for those.
- ⏭ **P3.22** — `feat-*` dirs at workspace root. **Deferred.** Moving them
  under `features/` would touch `lac.config.json` plus possibly hardcoded
  paths in `lac-mcp` tools that read these. The noise is real but contained;
  most ignore globs (.eslintignore, glob includes) can be tuned cheaper.

---

## Working notes / decisions log

- 2026-05-17 — **Decision: freeze buyer-admin / Fleet / Tenant code with note**
  (PLAN_TOMORROW.md §3.4, Q1 in §10 open-questions). Default path picked:
  keep as scaffolding, document the freeze in each page header so future-Marc
  knows it's intentional, not abandoned. Cost to carry: ~0 — lazy chunks
  never load for the default users, sidebar already hides them. Re-open
  trigger: actually wanting to productize the white-label template (§5.4 in
  the plan, Q8 90-day backlog), or a buyer-driven need that turns up
  concretely. Freeze-note added to AdminFleet, AdminFleetNew, AdminAppearance.
  AdminBilling and AdminTeam already carried adequate scaffolding notes.
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
- 2026-05-15 — Sixth batch shipped: P3.9 (OG endpoint tests), P3.10
  (middleware tests). P3.8 closed as already-handled by the existing
  Copy = typeof FR pattern.
  - 174 tests pass, +5 skipped under happy-dom (HTMLRewriter; runs under
    miniflare). Typecheck + lint clean.
- 2026-05-15 — Seventh batch shipped: P2.22 (Sentry — both frontend + Functions
  wired, DSNs optional/no-op), P2.23 (synthetic monitor doc in RUNBOOK).
  - 174 tests pass. Typecheck + lint + build clean. `@sentry/react` adds
    ~80 KB to the main bundle (one-time, not in lazy chunks).
- 2026-05-15 — Final sweep: documented defer rationale for every remaining
  pure-code item.
- 2026-05-15 — Loi 25 compliance pass for the Sentry integration. P3.21
  flipped from ⏭ deferred to ✅ shipped: PIA, privacy-page notice, code
  minimization, RUNBOOK procedures. Memory entry added so future sessions
  know the established pattern when adding new third-party processors. P1.3 (Resend outbox), P1.8 (napkin → R2), P2.2 (logout
  revoke), P2.3–2.5 (data model premature), P3.11–3.15 (test infra heavy
  for current value). Each item now has a clear "reopen when X" trigger
  so future-me knows what to watch for.
- 2026-05-21 — Napkin folded into the intake form. The standalone `/napkin`
  page is gone (now a redirect to the intake); the Excalidraw sketch is a
  collapsible panel in the intake's form step. The editable scene travels
  with the intake draft and ships in `intake_json`, and the session view can
  re-open it interactively (read-only canvas) instead of only showing the
  flat PNG. Touches P3.4 (autosave moved into the draft) and P1.8 (scene
  JSON now rides alongside the PNG). Typecheck + lint + build clean; e2e
  visual baselines regenerated on the CI runner.

## Session totals (2026-05-15)

- **7 commits** on `main` (`b14b453` → `ccb6f6b` plus this final sweep).
- **~40 items addressed** out of the original ~50-item audit.
  - ✅ Shipped: P1.4, P1.5, P1.6, P1.7, P2.6, P2.9, P2.10, P2.11, P2.12,
    P2.13, P2.15, P2.16, P2.17, P2.19, P2.21, P2.22, P2.23, P3.1, P3.2,
    P3.3, P3.4, P3.5, P3.6, P3.7, P3.9, P3.10, P3.17, P3.18, P3.19, P3.20.
  - ⏭ Deferred with rationale: P1.3, P1.8, P1.9, P2.1, P2.2, P2.3, P2.4,
    P2.5, P2.7, P2.8, P2.14, P2.18, P2.20, P3.8, P3.11, P3.12, P3.13,
    P3.14, P3.15, P3.16, P3.21, P3.22.
  - ⚠ External-blocked: P1.1, P1.2 (Resend DNS).
- **174 active tests** pass (+5 skipped under happy-dom). Typecheck + lint
  + build all clean throughout.
