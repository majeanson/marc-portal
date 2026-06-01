# Go-live checklist

> The one-sitting activation sequence for taking `marcportal.com` from
> test/dormant to live. Companion to `RUNBOOK.md` (11pm incident triage) and
> `AUDIT.md` (known gaps). Each deep procedure already lives in RUNBOOK; this
> file is the *ordered* index so nothing is missed on launch day.

## What this is — and isn't

The code is launch-ready: 764 tests green, every critical path (capacity cap,
community-discount freeze, webhook dedup, checkout idempotency, CSRF, session
HMAC) audited and atomic. **What remains is almost entirely activation** —
secrets, dashboard wiring, and two crons. Nothing here needs a code change
except the two Stripe price IDs in `wrangler.toml`.

Every optional binding degrades gracefully (503, UI hides itself) when unset,
so a half-done launch fails *visibly and safely* rather than silently. The
deep health probe in Step 5 confirms the whole surface in one call.

---

## Step 0 — Establish the true current state (5 min)

Don't trust assumptions about what's already set. Read reality first.

```bash
# Which secrets exist on prod (values never shown — that's correct):
npx wrangler pages secret list --project-name marc-portal

# Which migrations have actually applied prod-side:
npx wrangler d1 migrations list marc-portal-db --remote
```

Expected baseline secrets already present from earlier work: `SESSION_SECRET`,
`RESEND_API_KEY`, `STRIPE_SECRET_KEY` (test), `STRIPE_WEBHOOK_SECRET` (test).
`ADMIN_EMAILS` lives in `wrangler.toml [vars]`, not the secret list. Note the
gaps against the table at the bottom of this file, then work the phases.

> Secret command form: this is a Pages project, so the unambiguous form is
> `npx wrangler pages secret put NAME --project-name marc-portal`. From inside
> the project dir the bare `npx wrangler secret put NAME` also resolves; the
> RUNBOOK uses both. Pick one and stay consistent in your shell history.

---

## Phase 1 — Stripe test → live (blocks all revenue)

Stripe isolates test and live catalogs, so this is a clean swap, not a
migration. Full failure-mode triage is **RUNBOOK §9**.

1. **Live secret key.** Stripe Dashboard → toggle *Test mode* OFF → Developers
   → API keys → copy the `sk_live_…` secret key.
   ```bash
   npx wrangler pages secret put STRIPE_SECRET_KEY --project-name marc-portal
   # paste sk_live_…
   ```

2. **Live custodian products + prices.** In live mode, create the two
   recurring CAD prices (Watch and Care), copy each `price_…`, and replace the
   test IDs in `wrangler.toml:67-68`:
   ```toml
   STRIPE_CUSTODIAN_WATCH_PRICE_ID = "price_…"   # live
   STRIPE_CUSTODIAN_CARE_PRICE_ID  = "price_…"   # live
   ```
   Commit + push (these are plaintext vars; per the project's wrangler-toml
   constraint they cannot go in the dashboard). Until they match live,
   custodian checkout returns 503 with a clear message.

3. **Live webhook endpoint.** Stripe → Developers → Webhooks → Add endpoint:
   - URL: `https://marcportal.com/api/payments/webhook`
   - Events (exactly what the handler switches on — `webhook.ts:86`):
     `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`,
     `customer.subscription.deleted`, `customer.subscription.updated`,
     `charge.refunded`
   - Copy the `whsec_…` signing secret:
   ```bash
   npx wrangler pages secret put STRIPE_WEBHOOK_SECRET --project-name marc-portal
   # paste whsec_…  (the LIVE endpoint's secret, not the test one)
   ```

4. **Customer Portal.** Stripe → Settings → Billing → Customer portal →
   Activate. Enable payment-method update, subscription cancel (allow *cancel
   immediately*, not period-end only), and invoice history — `/me` links here.

5. **Smoke test before announcing.** Run the end-to-end loop documented in
   RUNBOOK (checkout → webhook → D1 → `/me`). Verify a real card produces a
   `paid` row and the visitor's `/me` flips.

---

## Phase 2 — Operator lifeline crons (blocks the safety net)

Without these, the email outbox never sweeps, triage SLA breaches go silent,
and a D1 outage is invisible. Both run free on cron-job.org. Setup detail:
RUNBOOK §7 (digest) and the *Synthetic monitor* section (health).

1. **Digest token.** Mint and set it:
   ```bash
   openssl rand -hex 32 | npx wrangler pages secret put DIGEST_TOKEN --project-name marc-portal
   ```
   Save the value — the cron needs it as a header. Gate: `digest.ts:66-69`
   returns 401 until `DIGEST_TOKEN` is set and matched.

2. **Daily digest cron** (cron-job.org):
   - URL: `https://marcportal.com/api/admin/digest`, method **POST**
   - Header: `X-Digest-Token: <the value from step 1>`
   - Schedule: once daily (~8am UTC is fine)
   - Notify on failure → Marc's inbox
   - This cron also drives the outbox sweep, custodian reconcile, and Sentry
     quota watchdog — it's the heartbeat for all four.

3. **Health monitor cron** (cron-job.org):
   - URL: `https://marcportal.com/api/health`, method GET
   - Schedule: every 5 minutes
   - Treat as failed if HTTP ≥ 400 OR body lacks `"ok":true`
   - Notify on failure → Marc's inbox

> cron-job.org free tier allows the two jobs this needs. The shallow
> `/api/health` is public and D1-only by design, so the 5-min cadence costs no
> upstream API quota.

---

## Phase 3 — Resend domain + bounce webhook (email health)

Magic links and notices already send. This phase stops shared-reputation drag
and turns on bounce/complaint suppression. Both halves tolerate being unset
(503 / fallback sender), so they're not hard launch blockers, but a real
launch wants them. Full procedure: **RUNBOOK §16**.

1. Add `marcportal.com` on Resend → copy the 4 DNS records (DKIM, MX, SPF,
   DMARC) → add each to Cloudflare DNS, proxy disabled → wait for *verified*.
2. Confirm `RESEND_FROM` in `functions/_lib/email.ts` is
   `'Marc <noreply@marcportal.com>'` (not the `onboarding@resend.dev`
   fallback). The stale-comment cleanup is BACKLOG B2.
3. Add the Resend webhook → `https://marcportal.com/api/webhooks/resend`,
   events `email.bounced` / `email.complained` / `email.delivered`:
   ```bash
   npx wrangler pages secret put RESEND_WEBHOOK_SECRET --project-name marc-portal
   ```
   Until set, the handler 503s (`resend.ts`) — a stray request meanwhile is a
   non-event.
4. Fire a test event from the Resend dashboard, confirm a row lands in
   `email_events`.

---

## Phase 4 — Loi 25 / Sentry dashboard toggles (compliance correctness)

Code minimization is shipped; these dashboard actions are what make the PIA
(`docs/loi-25-pia.md`) claims true. Without them, the code is stricter than
nothing but the cross-border posture isn't what the privacy page states.
Checklist: RUNBOOK *Sentry — Loi 25 compliance*.

- [ ] Sign Sentry's Data Processing Agreement
- [ ] Set project data retention to **30 days**
- [ ] Enable *Prevent Storing of IP Addresses*
- [ ] Confirm the Data Scrubber is ON

---

## Phase 5 — Data residency + final verification

1. **Confirm D1 region.** The footer's "Hébergé au Canada" claim depends on
   the DB living in `enam` (Toronto). If created without the hint, CF Support
   can relocate it (offline, ~30 min) — see `wrangler.toml:14-19`.
   ```bash
   npx wrangler d1 info marc-portal-db
   ```

2. **Apply any pending migrations** (deploy.yml does this automatically, but
   confirm prod is current):
   ```bash
   npx wrangler d1 migrations apply marc-portal-db --remote
   ```

3. **One-call green check.** The deep health probe pings every configured
   upstream live. Run it signed-in as admin (it's admin-gated to avoid a
   Stripe/Resend bill from an unauthenticated DDoS — `health.ts:143-148`):
   ```bash
   curl -s 'https://marcportal.com/api/health?deep=1' -H "Cookie: mp_session=<your admin cookie>" | jq
   ```
   Every configured probe should read `ok`. `unconfigured` is neutral (that
   binding is intentionally off); only `fail` is a launch blocker.

---

## Optional / post-launch (ship anytime, no code change)

These degrade gracefully today. None blocks launch.

- **R2 attachments** (`MEDIA`): message/voice/sketch file uploads. Create the
  bucket, the binding is already in `wrangler.toml:38-41`. Unset → upload
  endpoints 503, text sessions unaffected.
- **Workers AI / Whisper** (`AI`): voice-note transcripts. Binding present at
  `wrangler.toml:49-51`, no resource to provision. Unset → voice notes still
  upload + play with a null transcript.
- **CF auto-domain attach** (`CF_API_TOKEN` + `CF_ACCOUNT_ID` +
  `CF_PAGES_PROJECT_NAME`): only matters for multi-tenant buyer onboarding.
  Unset → `/admin/fleet/new` shows manual instructions. Detail in
  `wrangler.toml:80-87`.
- **Sentry quota watchdog** (`SENTRY_AUTH_TOKEN` + `SENTRY_ORG`): daily alert
  at 80% of the error quota. Unset → no-op. See `wrangler.toml:70-78`.

---

## Launch sign-off

| # | Var / action | Where | Gates |
|---|---|---|---|
| 1 | `STRIPE_SECRET_KEY` → `sk_live_` | secret | all payments |
| 2 | `STRIPE_CUSTODIAN_*_PRICE_ID` → live | `wrangler.toml` + deploy | custodian checkout |
| 3 | `STRIPE_WEBHOOK_SECRET` → live `whsec_` | secret | payment confirmation |
| 4 | Live webhook endpoint + Customer Portal | Stripe dashboard | payment confirmation, self-serve billing |
| 5 | `DIGEST_TOKEN` + daily digest cron | secret + cron-job.org | outbox sweep, triage SLA, alerts |
| 6 | Health monitor cron (5 min) | cron-job.org | outage visibility |
| 7 | Resend domain verified + `RESEND_WEBHOOK_SECRET` | DNS + secret | deliverability, suppression |
| 8 | Sentry Loi 25 toggles (DPA, 30d, IP-off, scrubber) | Sentry dashboard | privacy-page accuracy |
| 9 | D1 in `enam` | `wrangler d1 info` | "Hébergé au Canada" claim |
| 10 | `health?deep=1` all-`ok` + payment smoke test | curl + Stripe | final green light |

When 1–10 are done and the deep probe is green: live.
