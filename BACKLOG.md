# Backlog — autonomous code-side work

> Started 2026-05-29. Companion to `AUDIT.md` (known gaps) — this file is the
> queue of **code-only** improvements that need no manual prod step from Marc
> (no Stripe dashboard, no secrets, no cron registration). Each item is atomic
> and self-contained so it can be picked up cold and shipped through the
> standard PR + e2e flow.
>
> Status: ⬜ todo · 🟡 in progress · ✅ done · ⏭ deferred
> Size: **S** ≤ ~1 file + tests · **M** a few files · **L** new surface
> Manual: what (if anything) Marc must do by hand AFTER the code lands. "none"
> means fully shippable unsupervised.
>
> Launch-gating activation (Stripe test→live, Resend webhook secret, cron +
> uptime registration) is intentionally NOT here — it lives in RUNBOOK §16 etc.
> and needs Marc's hands. This file is the work I can do while he can't supervise.

---

## Tier 1 — Zero-risk hygiene & coverage (do first; verifiable by the test suite)

- ✅ **B1 · already satisfied (verified 2026-06-01)** — The dead streaming
  `verifyMagicBytes` helper no longer exists in `functions/_lib/attachments.ts`;
  only `verifyMagicBytesBuffer` is defined and imported (index.ts, transcribe.ts,
  attachments.test.ts). It was removed when P1.10's buffered path landed. The
  one leftover was a stale *comment* in `e2e/backend/napkin-upload.spec.ts`
  still naming the old function — fixed to `verifyMagicBytesBuffer`.

- ✅ **B2 · already satisfied (verified 2026-06-01)** — `functions/_lib/email.ts`'s
  header comment (lines 34-39) already documents the verified `marcportal.com`
  sender on its own reputation; no `onboarding@resend.dev` / "temporary fallback"
  framing remains. `RESEND_FROM` is `'Marc <noreply@marcportal.com>'`. Nothing
  to change — the AUDIT P1.1 "remove on next touch" note was cleared by an
  earlier pass.

- ✅ **B3 · already satisfied (verified 2026-06-01)** — `attachment-upload.test.ts`
  already covers the full upload validation matrix with the in-memory R2 stub:
  415 (magic-byte mismatch + disallowed type), 413 (per-kind cap + per-session
  budget), the `?kind=napkin` opt-in + non-PNG reject + one-per-session 409 +
  `?replace=true` atomic swap, sketch JSON shape-checking, and R2-rollback on a
  DB insert failure. Exactly what P3.11 asked for.

- ✅ **B4 · done (2026-06-01)** — Coverage sweep. Most untested `src/lib` files
  are thin `fetch` API wrappers (advancementsApi, paymentsApi, prefsApi,
  todayApi, …) — unit-testing those means mocking `fetch` and asserting nothing
  real (the anti-pattern CLAUDE.md calls out), so left untested by design.
  `pricing.ts` is already pinned by `pricingParity.test.ts`; `map/filter.ts` by
  `map.test.ts`. Filled the two genuinely logic-bearing gaps: `erasureFlag.ts`
  (one-shot consume + SSR/storage-blocked guards → `erasureFlag.test.ts`) and
  `export.ts` (`exportMyData` per-session error-resilience branch →
  `export.test.ts`). 8 new tests.

---

## Tier 2 — UX / look polish

- ✅ **B5 · manual: none** — Four-state audit. The cut state turned out to be
  **error**, not empty: `AdminInbox`, `AdminTrash`, `AdminCustodians`, and
  MePortal's session list all did `catch { setSessions([]) }`, so a failed
  fetch rendered as "nothing here" — indistinguishable from a genuinely empty
  list, hiding a backend problem. Each now carries a distinct `loadError` state
  with a retry, separate from loading (null) and empty (length 0). Loading,
  empty, and success were already present on the surfaces audited
  (`FeaturedProjects`, `Projects`, `Vouches`, `AdminAudit`, `AdminEmailOutbox`,
  `AdminShowcase`, `AdminVouches`, `SessionAdvancements` all complete).
  `Testimonials` deliberately hides on empty/error (a broken marketing section
  is worse than a hidden one) — left as-is by design.

- ✅ **B6 · audited, no change** — Accessibility pass found the codebase already
  solid: 47 `prefers-reduced-motion` blocks, 107 `:focus-visible` rules, and
  every icon-only control (`ThemeToggle`, `ShareModal` close, `MobileStickyCta`
  dismiss) already carries an `aria-label`; decorative glyphs are `aria-hidden`
  with adjacent real text. No concrete gap — manufacturing changes here would be
  speculative churn against the "verify before asserting" discipline.

- ✅ **B7 · audited, no change** — Interactivity-consistency sweep. The
  StudioSign→home gap (shipped earlier) was the real one; no other
  decorative-but-clickable / clickable-but-hidden mismatch surfaced worth a
  visual change.

---

## Tier 3 — Code-only features (the handler/page ships now; activation is later & manual)

- ✅ **B8 · manual: none (runs in the existing digest cron)** — Custodian-renewal
  reconciliation (gap **#10**). `_lib/custodianReconcile.ts`: pure
  `computeCustodianDrift` + `reconcileCustodians` that lists Stripe's active
  subscriptions (`listActiveSubscriptions` in `_lib/stripe.ts`) and cross-checks
  `sessions.custodian_status`, catching a missed billing webhook (lapsed sub
  still shown active, or recovered sub still shown past_due). Alert-only via
  `admin_alerts` (kind `custodian-reconcile`), deduped to one open alert.
  Piggybacks the daily digest cron — no new auth/CSRF surface — so it's already
  "usable before a dedicated cron exists." No-op when `STRIPE_SECRET_KEY` unset.
  10 tests, co-located feature.json, RUNBOOK §23. Chose digest-piggyback over a
  standalone endpoint+button (lower surface) and alert-only over auto-heal
  (won't race the webhook).

- ✅ **B9 · manual: set SENTRY_AUTH_TOKEN + SENTRY_ORG later** — Sentry quota
  watchdog (gap **#8**). `_lib/sentryQuota.ts`: pure `evaluateQuota` +
  `sumErrorQuantity`, and `checkSentryQuota` that reads 30-day error usage from
  the Sentry stats API and alerts via `admin_alerts` (kind `sentry-quota`,
  deduped) when usage ≥ 80% of `SENTRY_MONTHLY_ERROR_QUOTA` (default 5000).
  Piggybacks the daily digest (housekeeping #5) — same shape/rationale as B8.
  No-op until the token + org are set. 11 tests, feature.json (feat-2026-107),
  RUNBOOK §24, env vars documented in `wrangler.toml`. Used a configured quota
  constant over fragile plan-introspection.

- ⬜ **B10 · M · manual: lawyer review before it's binding** — Terms-of-Service
  route (gap-queue **#15**). Author the FR/EN page behind the existing inline
  `COPY = { fr, en }` operator-page pattern, route it in parallel like the other
  legal pages, link it from the site map (where the footer now points). Flag in
  the page + RUNBOOK that a Quebec-lawyer review is required before it carries
  legal weight — the code ships regardless.

---

## UX solidification pass (2026-07-31)

> Five-agent audit of every journey (visitor funnel, client, operator,
> cross-cutting states/a11y, consistency/i18n/copy), findings verified by
> hand before landing here. Nothing new: each batch tightens what exists.
> One branch + PR per batch, merged green before the next starts.
> Full finding details live in the session transcript; ids (AC-1, XC-23, …)
> are kept so a future session can trace any line back to its evidence.

- ✅ **U1 · done (2026-07-31, #28)** — Silent failures on client money/message paths.
  `SessionPage.onSend` has no catch (failed reply looks sent; also route 401 →
  login); `onWithdraw` swallows errors; `PaymentActions` hides the whole
  payment block when the summary fetch fails (`return null`) and resets
  pay/portal buttons on error with no message; `MyData` fabricates an empty
  Loi 25 bundle on fetch failure ("I hold no data" during an outage);
  `Login.onSubmit` navigates to "check your email" even when the request never
  left the device (branch on transport failure ONLY — the always-200
  anti-enumeration behaviour is deliberate and stays); intake `Confirmation`
  resend gives no success/failure feedback. Pattern to reuse: `ackError` /
  `attachError` / `field__hint` idioms already in the same files.
  [AC-1/2/3/5, XC-1/2/3/4/15/16/17, OP-3, VF-5]

- ✅ **U2 · done (2026-07-31, #29)** — Operator trust + admin nav. `onStatusChange`
  renders every 409 as "modified elsewhere" — discriminate the at-capacity 409
  (server message is already actionable) from a genuine stale row, mirroring
  `CommunityDiscountToggle`; `AdminTrash.onRestore` and `DeclinePanel.save`
  fail silently; tier/quote/split setters swallow non-409s; status/tier pills
  need an in-flight guard (double-click can double-email the visitor); add
  Inbox, Vouches, Trash, Custodians to the persistent admin sidebar (Inbox is
  the self-described "primary working surface" and takes 2 clicks + a grid
  scan today); fix the nonexistent `status-pill` class in AdminTrash/
  AdminVouches (renders unstyled; real class is `session-frame__status-pill`)
  and route AdminTrash's raw English status through a labels map; correct the
  trash copy ("remet en triage" is false — restore keeps prior status);
  `AdminEmailOutbox.reload` blanks the table mid-retry-loop; `FirstNameCard`
  has a loading state with no render branch; `OperatorNotesPanel` load-path
  catch is empty. [OP-1/2/5/6/7/8, XC-5/6/10/11/13/14/18, CI-18]

- ✅ **U3 · done (2026-07-31, #30)** — Router-link completion. Shared components the
  f8f22bd migration missed: `HomeDrillCard`, `CrossFeatureLink`,
  `BringAnything` CTA, intake `AccountStep` sign-in link, every `NotFound`
  exit, `InlineIntakeTeaser` napkin line — plus the whole signed-in surface
  (`MePortal`, `MyData`, `SessionPage` back link, `Login` already-signed-in
  branch). Also seed `Login`'s email field from `?email=` so "send another
  link" doesn't force retyping. No visual delta expected. [VF-1/2/3/4/6/11,
  AC-4/8]

- ✅ **U4 · done (2026-07-31, #31)** — Fetch resilience + retry affordances. Five
  surfaces show an error with no retry (`AdminAudit`, `AdminShowcase`,
  `PublicAdvancements`, `Projects`, `Vouches` — reuse `AdminToday`'s
  `load()`-plus-button shape; give Vouches its own error copy instead of the
  global error-boundary string); `Hero` capacity pill sticks on "loading…"
  forever on failure; `SketchAttachment` permanently blocks retry after one
  blip and bypasses `api.ts`; `SessionPage.listAdvancements` masks failure as
  empty; post-payment `/me?paid=1` can show "paiement reçu" beside a live
  Payer button until the webhook lands — retry the summary fetch once or
  twice with short backoff; surface the `suppressed` field request-link
  already returns so a hard-bounced address stops getting "check your spam".
  [XC-7/8/9/12, VF-10, AC-6/7]

- ⬜ **U5 · M · manual: none** — A11y + contrast + touch targets. `--text-faint`
  fails AA in BOTH themes (≈2.0:1 day, ≈2.4:1 night) and is real UI text at
  ~24 sites — swap informational uses to `--text-soft`, keep faint for
  decorative/disabled; night `--border`/`--border-soft` sit under the 3:1
  UI-boundary guideline against `--bg-card` — nudge lighter; `ShareModal` has
  no Tab trap (port the ~15-line cycle from `SiteSearch`); `theme-toggle`
  focus-visible strips the outline for a hover-identical tint; hardcoded
  English `aria-label="new activity"` over FR text in MePortal;
  `EngagementStatusBar` conveys current step by color alone (add
  `aria-current="step"`); auto-refreshed admin counts need a polite live
  region; NapkinSection error missing `role="alert"`; `/me` skeleton shimmer
  missing its reduce-motion override; accent-toggle swatches 18px and intake
  progress chips ~20px tall (WCAG 2.5.8) — use the `::before` hit-area
  technique from `.time-travel__notch`; SiteSearch close button under 24px.
  Needs baseline regen. [XC-20…32 minus 23-adjacent, XC-23/24/25/26, VF-12/13]

- ⬜ **U6 · M · manual: none** — Copy + form polish. Rewrite the negation-
  anaphora on MyData and Privacy §2/§3, the em-dash-dense Privacy §2 list
  paragraph, the flat FR triad on Home ("Vrai code, vrai problème, vrai
  monde"), the two-dash Atelier intro; apply `frPunct()` to the FR strings
  with unspaced `? ! : ; »` (EnglishNudge, HowItWorks, Vouch lead); converge
  status vocabulary (MePortal FR ships untranslated "active" — client surfaces
  use "en cours"; document or converge the declined/rejected/not-taken-on
  three-way EN split); collapse the four local date-format forks onto
  `formatDateTime`; fix PageMast's stale doc comment; intake email field gets
  a why-is-this-disabled hint; vouch field errors clear on change instead of
  next submit; intake autosave checkmark becomes honest — probe storage once
  and warn when drafts can't persist; reply composer draft persists to
  sessionStorage keyed by session id; `editorial-rise` drops `translateY`
  (house rule: reveals are opacity-only; compliant keyframe exists in-file).
  Needs baseline regen. [CI-6/7/8/11…16/20/21/22/23, VF-7/8/9/14, OP-4, AC-9,
  XC-19]

- ⬜ **U7 · M · manual: none** — i18n pattern consolidation. ~103 banned inline
  `lang === 'fr' ? … : …` copy ternaries across 8+ files, mostly `PageMast`
  stamp props — give PageMast a `Bi` stamp prop contract, fold AdminHub's
  three ad-hoc shapes into its COPY block, move Footer/Runbook shared-chrome
  strings into `DICT`. Mechanical, no visual delta. [CI-1/2/3]

**Held for Marc (decisions, not code):** the status pill itself is a rounded
colour-filled badge, which the house rules ban ("mono ledger tag with a
filled/hollow square") — redesigning it is L effort + 6 call sites + full
baseline churn, do it deliberately or bless the exception [CI-19]. Privacy
uses "tu" throughout where CLAUDE.md prescribes "vous" for legal surfaces —
either is defensible, pick one [CI-9]. `frPunct()` today covers 2 call sites;
decide whether it's policy (adopt broadly) or opt-in (fix the comments that
imply broad coverage) [CI-5].

---

## Notes

- Batch Tier 1 into one PR (all test/hygiene, low blast radius), then Tier 2
  (visual — needs `e2e-snapshots.yml` regen), then Tier 3 one feature per PR.
- Anything here that turns out to need a manual prod step gets moved to
  `RUNBOOK.md` with the activation paragraph, not left as a silent TODO.
- When an item ships: flip ✅, link the commit, and if it closes an `AUDIT.md`
  or gap-queue item, strike that there too.
