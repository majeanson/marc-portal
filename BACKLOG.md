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

- ⬜ **B1 · S · manual: none** — Remove the dead streaming `verifyMagicBytes`
  helper from `functions/_lib/attachments.ts`. `AUDIT.md` P1.10 left it as a
  "possible future tool" after the buffered code path took over; only
  `verifyMagicBytesBuffer` is imported anywhere (verified 2026-05-29). Dead code
  that reads as live is a 11pm trap. Delete it + its type, run the suite.

- ⬜ **B2 · S · manual: none** — Refresh the historical "temporary fallback"
  RESEND_FROM guidance flagged in `AUDIT.md` P1.1. The `marcportal.com` sender
  domain has been verified + delivering since 2026-05-24; any comment still
  framing `onboarding@resend.dev` as the live default is stale. Sweep
  `functions/_lib/email.ts` and update the comment to current reality.

- ⬜ **B3 · M · manual: none** — Attachment **upload**-path unit tests
  (`AUDIT.md` P3.11). Today's PR added the serve/Range tests; the upload side
  (magic-byte reject → 415, per-session quota → 413, kind opt-in, R2.put with
  the buffered path) is still only covered indirectly. Add handler-level tests
  with the in-memory R2 stub already proven in `attachment-serve.test.ts`.

- ⬜ **B4 · M · manual: none** — Component-test coverage sweep. CLAUDE.md's rule
  is "components with logic worth testing get a test." Inventory `src/components`
  + `src/pages` for logic-bearing components with no `.test.tsx` and fill the
  highest-value gaps (state machines, derived display, conditional rendering).
  Pure-presentational components stay untested by design.

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

- ⬜ **B8 · M · manual: register the cron later** — Custodian-renewal
  reconciliation (`AUDIT.md`/gap-queue **#10**). Build the endpoint that calls
  Stripe `GET /v1/subscriptions?status=active` and reconciles
  `current_period_end` against `sessions.custodian_status`, plus an admin
  manual-trigger button on a diagnostics surface so it's usable before the cron
  exists. Graceful-degrade on missing `STRIPE_SECRET_KEY` (503). Tests with the
  sentinel-stub Stripe pattern. Cron registration on cron-job.org is the only
  manual follow-up.

- ⬜ **B9 · M · manual: register the cron later** — Sentry quota watchdog
  (gap-queue **#8**). Endpoint polls
  `sentry.io/api/0/organizations/{org}/stats_v2/`, alerts (admin_alerts +
  `/admin/today` tile) when usage > 80 %. Same shape as B8 — handler + manual
  trigger now, cron later. Degrade cleanly when the Sentry API token is unset.

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
