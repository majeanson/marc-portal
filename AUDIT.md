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
- ⬜ **P1.4** — Add CSRF token to state-changing endpoints (POST / PATCH / DELETE).
  Today `SameSite=Lax` is the only protection; works for most browsers but
  isn't belt-and-suspenders. Pattern: double-submit cookie OR per-session token
  in a header the SPA reads from a meta tag.
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
- ⬜ **P2.6** — No download endpoint visible for attachments. Files live in R2
  but I didn't find `GET /api/attachments/:id`. Verify: can a visitor actually
  retrieve their own uploaded file? If not, add the endpoint with signed URL
  + Content-Disposition. If yes, point me at it and check this off.

### OG / sharing
- ⬜ **P2.7** — `workers-og` PNG render uses inline HTML with `font-family:system-ui`.
  CF's V8 isolate doesn't bundle system-ui consistently — local preview vs prod
  often diverge (serif fallback). Either bundle a webfont (Inter or Geist via
  TTF), or document the divergence as known.
- ⬜ **P2.8** — `/og/share/:id` falls back to 302 redirect to `/og-image.png` on
  any error. Slack/Discord cache 302s aggressively (~24h). Fix the bad card →
  bad card still shows up everywhere. Cache the fallback as `200 + the static
  PNG bytes` with a short `s-maxage` so a fresh fix propagates faster.
- ✅ **P2.9** — HTMLRewriter skips `/api/*` and `/og/*` paths (cheap pathname
  check at the top of `rewriteOgTags`). Other HTML responses still get
  rewritten — handlers that return HTML errors won't be touched.
- ⬜ **P2.10** — `og:url` isn't rewritten per-route. Sharing `/share/:id` shows
  the home title in the card. Either pass `og:title` / `og:description` through
  the rewriter too, OR render those in `Home.tsx` / `PublicAdvancements.tsx`
  useEffect like we already do for `og:image`.

### Routing / SPA
- ✅ **P2.11** — `src/pages/NotFound.tsx` renders a proper 404 with the path
  the visitor hit, links to home + intake. Wired as `<Route path="*">`
  replacing the previous silent home-redirect.
- ✅ **P2.12** — `src/pages/RouteError.tsx` is the root `errorElement` on the
  layout route. Surfaces "something went sideways" + Refresh button. Reuses
  the 404 copy for ErrorResponse-style 404s so the experience is consistent.
- ✅ **P2.13** — `RouteFallback` component (in `router.tsx`) renders three
  shimmer bars during lazy chunk fetch. Reduced-motion stops the animation.
- ⬜ **P2.14** — Collapse the duplicated FR+EN route subtrees in `src/router.tsx`
  (~350 lines, 2× maintenance). Either parametrize with `:lang(en)?` or build
  the route list programmatically from a path table. Comment calls the
  duplication "deliberate" — but it's only deliberate because nobody made the
  param-route version work.

### Attachments
- ⬜ **P2.15** — No virus / malware scan on uploaded files. 10 MB cap + broad
  allow-list (zip, Office docs, PDFs). At minimum: refuse files whose magic
  bytes don't match `content_type`. Better: integrate a CF Workers AV (or
  defer-but-flag the file as "unscanned" until a human approves).
- ⬜ **P2.16** — Orphan attachment GC. Pre-message uploads (`message_id IS NULL`)
  that never get linked to a message are never cleaned up. Sweep on the daily
  digest cron: delete `attachments` rows + R2 objects where `message_id IS NULL
  AND created_at < now - 7d`.
- ⬜ **P2.17** — No per-session storage quota. A visitor could upload 30 files ×
  10 MB / hour = 300 MB/hour. Add a per-session sum-of-sizes ceiling (50 MB?)
  to the upload handler.

### CSP / headers
- ⬜ **P2.18** — `frame-src` hardcodes specific demo origins (`snd-demo.pages.dev`,
  `jaffre.vercel.app`, `retrodio.vercel.app`) in `public/_headers`. Every new
  showcase needs a CSP edit + redeploy. Move to a `_headers` builder script
  that reads showcased build URLs from D1, OR loosen to `*.pages.dev` /
  `*.vercel.app` (with the security trade-off documented).
- ✅ **P2.19** — `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
  added to `public/_headers`.
- ⬜ **P2.20** — `style-src 'unsafe-inline'` allowed (needed for Google Fonts +
  Excalidraw). If we replace Google Fonts with self-hosted `.woff2` files, we
  can drop `unsafe-inline`. Excalidraw also injects inline styles — verify if
  it still works under nonces.
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
- ⬜ **P3.1** — Add scrubber help text for AT users. `role="application"` with
  no instructions means screen readers don't tell the user "arrow keys step."
  Add a `t.scrubberHelp` line visible in-view (or `aria-describedby`).
- ⬜ **P3.2** — Replace inline `eslint-disable jsx-a11y/...` in
  `TimeTravelScrubber.tsx:101` with proper semantics (wrap interactive parts in
  buttons rather than slap role=application on the whole section).
- ⬜ **P3.3** — Deep-link a scrub index. `?step=3` in the URL → open scrubber at
  step 3. Visitors can share specific revisions.

### Napkin
- ⬜ **P3.4** — Excalidraw scene autosave. Refresh mid-sketch = work lost. Hook
  `onChange` and store the serialized scene in localStorage (not the PNG —
  scene JSON is small).
- ⬜ **P3.5** — Server-side cap on `napkin.png` size — refuse data URLs over
  ~600 KB in `POST /api/sessions`. (Less critical once P1.8 is done.)

### SEO / i18n
- ✅ **P3.6** — Hreflang now injected by `functions/_middleware.ts` via
  HTMLRewriter (`head` element append). Crawlers see them on first byte
  without running JS. Per-page mapping — `/projects` shows `/en/projects` as
  its EN alternate, not just `/en`. Tried index.html first; bare-path hrefs
  trip Vite's asset resolution, hence the middleware approach.
- ⬜ **P3.7** — Locale detection on first visit. `Accept-Language: en` → redirect
  to `/en` from `/`. Honor a preference cookie afterward.
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
- ⬜ **P3.16** — Decide what to do with the hidden-but-routed admin surfaces
  (Apparence, Équipe, Facturation, Fleet, Fleet/New). The sidebar comment says
  "vision is solo practice, not SaaS" — pick: (a) keep them as direct-URL
  rescue routes (current state, document why), (b) delete the components
  entirely. Right now they're 2× the surface area to maintain for no UX visible.
- ⬜ **P3.17** — Audit log UI filters (actor, action type, date range). Today
  `/admin/audit` is just a list (88 lines).

### Misc
- ✅ **P3.18** — Rewrote the stale comment in `src/components/About.tsx` to
  document the actual purpose of the `onError` fallback instead of the
  no-longer-relevant "placeholder" framing.
- ✅ **P3.19** — `package.json` version set to `0.0.0` to signal "not tracked"
  (this is a `private: true` app, deploys are git-SHA-tracked, no consumers
  depend on the field).
- ⬜ **P3.20** — `scripts/build-og-image.mjs` is run manually. Add a check in
  CI that diffs `og-image.svg` against the bundled PNG and fails if they're
  out of sync. (Or: just regenerate in `prebuild`.)
- ⬜ **P3.21** — Cookie consent / Loi 25 banner. Privacy page exists; explicit
  consent for non-essential cookies may be required for the QC market.
  Auth cookies are essential (no consent needed) — but if any analytics ever
  lands, we need a banner. Document the boundary.
- ⬜ **P3.22** — `feat-*` feature.json dirs live as siblings of `src/` (~22
  dirs). Noise in file pickers, glob patterns. Consider `features/*/feature.json`.

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
