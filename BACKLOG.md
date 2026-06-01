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

## Notes

- Batch Tier 1 into one PR (all test/hygiene, low blast radius), then Tier 2
  (visual — needs `e2e-snapshots.yml` regen), then Tier 3 one feature per PR.
- Anything here that turns out to need a manual prod step gets moved to
  `RUNBOOK.md` with the activation paragraph, not left as a silent TODO.
- When an item ships: flip ✅, link the commit, and if it closes an `AUDIT.md`
  or gap-queue item, strike that there too.
