# 11pm runbook

If prod breaks at 11pm and your brain is at 30%, these are the suspects in
order. Check them top-down — most-likely first, cheapest-to-rule-out first.

## 1. Magic-link emails not arriving

**Symptoms:** visitor clicks "send me a link", form clears, no email shows up.

- First check: Resend dashboard for the free-tier ceiling (100/day) or a
  sender-domain block.
- Second check: `functions/_lib/email.ts:6` is hardcoded to
  `onboarding@resend.dev` (Resend's shared domain — no SPF/DKIM, may be
  greylisted by Gmail/Outlook).
- Quick mitigation: tell the visitor to check spam.
- Proper fix: verify a custom sender domain on Resend.

## 2. `/api/capacity` or `/api/sessions` returns 500

**Symptoms:** homepage capacity counter stays empty; intake submit 500s.

- First check: a migration didn't run on prod.

  ```bash
  npx wrangler d1 migrations apply marc-portal-db --remote
  ```

- The capacity endpoint and the sessions endpoints are the two that fail
  loudest if the schema is behind. Now that `deploy.yml` runs migrations
  automatically before each deploy, this should be rare — but a manually-
  triggered partial deploy or a hotfix can still skip them.

## 3. Every request 404s on a custom domain

**Symptoms:** the entire site responds 404 on the buyer's domain.

- `functions/_middleware.ts` resolves `Host` to a tenant via
  `tenant_domains`. An unregistered host returns a terse 404 by design (no
  tenant info leaked).
- Fix:

  ```bash
  npx wrangler d1 execute marc-portal-db --remote \
    --command "INSERT INTO tenant_domains (tenant_id, domain, is_primary, added_at) VALUES ('t_marc', 'example.com', 0, unixepoch())"
  ```

  `added_at` is NOT NULL with no default — must be supplied. `is_primary=1`
  if this is the canonical surface; `0` if it's a secondary domain pointing
  at the same tenant. See `functions/db/migrations/0002_tenants.sql` for the
  full schema.

## 4. Build fails in CI with `npm ci` lockfile error

**Symptoms:** GitHub Actions logs show a `@emnapi/*` mismatch.

- This is the Windows-vs-Linux optionalDeps thing — npm prunes the wrong
  set of native binaries when the lockfile is generated on Windows.
- **Should rarely reach CI now** — the `.githooks/pre-push` hook runs
  `scripts/check-lockfile.mjs` and blocks the push when the entries are
  missing. Hook auto-installs via the `prepare` lifecycle on `npm install`.
- Fix (when caught by the gate, or when bypassed via `--no-verify`):

  ```bash
  node scripts/fix-lockfile.mjs       # auto-fetches origin/main
  git add package-lock.json
  git commit -m "chore: restore @emnapi lockfile entries"
  git push
  ```

  `npm install --include=optional --package-lock-only` does NOT work — npm
  11.x ignores the flag for cross-platform optional native deps. The script
  is the only path that actually adds the entries.

## 5. Deploy succeeded but pages serve old code

**Symptoms:** the build URL shows the new deploy, but visitors still see the
previous version.

- Cloudflare Pages caches aggressively. `_headers` correctly sets
  `Cache-Control: public, max-age=31536000, immutable` for `/assets/*`
  (content-hashed — fine).
- Check that `index.html` is not cached. If stale, purge cache from the CF
  dashboard.
- Roll back: CF Pages "Deployments" tab → "Rollback" on the prior good
  deployment. (D1 schema is forward-only; old code against new schema is
  usually fine.)

## 6. Cookie forgery suspected

**Symptoms:** odd account-takeover reports; admin-only endpoint returning
`200` to the wrong user.

- Confirm `SESSION_SECRET` is set in CF Pages env and ≥ 32 chars. The boot
  guard in `functions/_lib/auth.ts` throws if it isn't, but a partial
  rollback or a deleted env var could trip it.
- Rotating: change `SESSION_SECRET`, redeploy. Every active session gets
  invalidated — visitors re-sign-in via magic link. Acceptable blast radius.

## 7. Triage piling up

**Symptoms:** Marc didn't see new sessions; SLA timer (72h) overdue.

- `/admin/inbox` shows the queue.
- Daily digest cron should email Marc by ~8am if anything is older than
  48h. If the cron stopped firing, hit the endpoint manually:

  ```bash
  curl -X POST -H "X-Digest-Token: $DIGEST_TOKEN" https://marcportal.com/api/admin/digest
  ```

## Observability setup (one-time)

### Sentry

DSN is hardcoded in `src/lib/sentry.ts` (browser SDK) and
`functions/_lib/sentry.ts` (Pages Functions). Sentry DSNs are
public-by-design — they authorize writes to one project, nothing else,
and are already shipped to every visitor in the SPA bundle. Committing
them in source is the documented Sentry pattern.

Why hardcoded and not env-var-based: tried both env-var paths first, both
broke. Dashboard env vars are locked to encrypted secrets in
wrangler-toml-managed mode (Marc's setup); `wrangler.toml [vars]` is
runtime-only, so Vite's build-time read can't see it. Hardcoding
collapses two failure modes into zero.

To rotate the DSN:
1. Sentry → Settings → Client Keys (DSN) → Rotate.
2. Replace the literal DSN string in `src/lib/sentry.ts` (line near top)
   and `functions/_lib/sentry.ts` (`SENTRY_DSN` const).
3. Commit + push. CF Pages rebuilds and the new DSN ships within 2 min.

The frontend SDK is `@sentry/react`; the Functions side uses a hand-rolled
envelope poster (~80 lines, no SDK). Both strip the session cookie, CSRF
token, and Authorization header before sending events.

### Sentry — Loi 25 compliance + operational checklist

Reference: `docs/loi-25-pia.md` (Privacy Impact Assessment, internal
record). Compliance posture: visitor events are anonymized at SDK time
(no `user.email`, no query strings, no IP), so Sentry holds no PII for
Quebec residents under Loi 25.

**One-time setup actions for the operator** (Sentry web UI):

| # | Action | Where |
|---|---|---|
| 1 | Sign Sentry's Data Processing Agreement | <https://sentry.io/legal/dpa/> — click-to-accept |
| 2 | Set project retention to **30 days** | Settings → General Settings → Data Retention |
| 3 | Enable "Prevent Storing of IP Addresses" | Settings → Security & Privacy → toggle ON |
| 4 | Verify data scrubbing rules are ON | Settings → Security & Privacy → "Data Scrubber" (defaults: credit cards, common secrets) |

If any of (1)–(4) is not done, the technical mitigations in code are
weaker than what the PIA claims. Re-read `docs/loi-25-pia.md` §6.3
before assuming the cross-border transfer is compliant.

**Handling a Loi 25 access request that mentions Sentry**

When a visitor sends a request under Loi 25 art. 27 ("send me
everything you have on me") and Sentry is on their radar:

1. The portal-side data lives in D1 — handle that via the existing
   `/me` page export.
2. For Sentry specifically, the canonical answer is:

   > Sentry events about your usage are anonymized at SDK time —
   > no email, no IP, no URL parameters carry your identity. There is
   > therefore no individual record to extract for you. The relevant
   > technical mitigation list is in our PIA (`docs/loi-25-pia.md`),
   > available on request.

3. If the visitor pushes back: confirm `setSentryUser` is admin-gated
   in current `src/lib/AuthProvider.tsx`, and `beforeSend` strips
   query strings in current `src/lib/sentry.ts`. If both true, the
   answer in step 2 is honest.

**Handling a Sentry breach notification**

If Sentry notifies you of an incident affecting your events:

1. Read their incident report; identify the time window + event count.
2. Because we don't tag visitor events with identity, the affected
   events are anonymous (per PIA §3.1). No notification to CAI or
   individuals is required (no risk of serious harm — no identifying
   info to leak).
3. The exception is the operator's own events: notify yourself.
4. Log the incident in this RUNBOOK with date + Sentry's incident ID.

### Synthetic monitor (cron-job.org)

The digest cron already runs through cron-job.org (Marc's free account); add a
second cron there for health monitoring:

1. cron-job.org → "Create cronjob".
2. **Title:** `marc-portal /api/health`
3. **URL:** `https://marcportal.com/api/health`
4. **Schedule:** Every 5 minutes.
5. **Notifications:** "Notify on failure" — email to Marc.
6. **Treat as failed:** HTTP status ≥ 400 (default), OR response body doesn't
   contain `"ok":true` (set under "Advanced" → "Response notifications").

Health endpoint returns `200 { ok: true, db: 'ok', ts }` when D1 is reachable,
`500 { ok: false, db: 'fail', ts }` otherwise. The 5-min cadence + free-tier
ceiling (one cronjob already used by digest) is fine on cron-job.org's free
plan.

## 8. Health check failing

**Symptoms:** `curl /api/health` returns 500.

- `db: 'fail'` means the D1 binding is unreachable. CF status page first.
- If CF is fine, suspect a wrangler.toml binding mismatch — the
  `database_id` may not match the actual database. Run `wrangler d1 list
  --remote` to confirm.

## 9. Stripe — payment / webhook failures

**Symptoms:** visitor hits "Payer →" on /me and nothing happens; OR you got
the `[marc-portal] Stripe alert` email; OR a payment shows `status='pending'`
in D1 long after the visitor told you they paid.

### Path A — Checkout endpoint failing

- Check `wrangler pages deployment tail`. The endpoint logs the Stripe
  error message before throwing.
- 503 "payments not configured" → `STRIPE_SECRET_KEY` is unset on the
  Pages project. Set it:
  ```bash
  npx wrangler pages secret put STRIPE_SECRET_KEY --project-name marc-portal
  ```
- 503 "custodian subscription price not configured" → `STRIPE_CUSTODIAN_PRICE_ID`
  is empty in `wrangler.toml [vars]`. Edit the value to the real
  `price_xxx` from Stripe Dashboard → Products, commit, redeploy.

### Path B — Webhook not arriving

- Stripe Dashboard → Developers → Webhooks → click the endpoint → "Recent
  events" tab. Each event row shows attempt history + response.
- 401 "signature mismatch" → `STRIPE_WEBHOOK_SECRET` doesn't match what
  Stripe is signing with. Reset via Dashboard ("Roll secret") then
  `npx wrangler pages secret put STRIPE_WEBHOOK_SECRET ...`.
- 401 "webhook secret not configured" → as above, set the secret.
- Webhook attempts visible but our handler returns 5xx → we caught a
  bug; the handler is designed to log + 200 on every internal failure.
  Check Sentry; the request context is captured.

### Path C — Payment row stuck in `pending`

- Most likely: the visitor abandoned the Checkout page before paying.
  The `payments` row stays `pending` forever (no auto-expiry today).
  Safe to ignore; the visitor can click "Pay" again, mints a new row.
- Alternatively: webhook delivery failed (see Path B). Stripe Dashboard
  → "Resend" on the failed event after fixing the underlying issue.

### Path D — Visitor reports they paid but /me still shows "Pay now"

- Stripe Dashboard → Payments → search by amount + date → find the charge.
- Verify the charge has a `client_reference_id` matching a `pay_*` row
  in our D1.
- If yes, the webhook didn't arrive or didn't update our row. Use
  Dashboard's "Resend" button on the relevant event.
- If no (charge has no `client_reference_id`), the visitor paid via a
  link generated outside our flow (manual Payment Link in dashboard?).
  Manually update D1:
  ```bash
  npx wrangler d1 execute marc-portal-db --remote --command \
    "INSERT INTO payments (id, session_id, kind, amount_cents, currency, status, stripe_charge_id, created_at, paid_at) VALUES ('pay_manual_<id>', '<session_id>', 'tier1', 30000, 'cad', 'paid', 'ch_xxx', strftime('%s','now'), strftime('%s','now'))"
  ```

## Payments setup (one-time) — Stripe

Required reference: `docs/loi-25-pia-stripe.md`. Compliance posture: card
data never touches marc-portal (Stripe-hosted Checkout); Stripe Payments
Canada Ltd. is the QC processing entity → no cross-border transfer.

**One-time setup actions for the operator** (Stripe web UI):

| # | Action | Where |
|---|---|---|
| 1 | Create account, Country = Canada, type = Individual / Sole Proprietor | <https://stripe.com> |
| 2 | Sign Stripe's Services Agreement + DPA (click-through at signup) | Activation flow |
| 3 | Verify identity (ID + SIN + bank account) | Activation flow |
| 4 | Statement descriptor = `MARCPORTAL` (≤22 chars, recognizable) | Settings → Public details |
| 5 | Create Product "Custodian mode" — recurring, $200.00 CAD/year | Products → Add |
| 6 | Copy the `price_xxx` from the new product → paste into `wrangler.toml [vars] STRIPE_CUSTODIAN_PRICE_ID` | Code commit + redeploy |
| 7 | Create webhook endpoint: `https://marcportal.com/api/payments/webhook` | Developers → Webhooks → Add |
| 8 | Select events: `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.deleted`, `customer.subscription.updated`, `charge.refunded` | Same form |
| 9 | Copy `whsec_*` → `npx wrangler pages secret put STRIPE_WEBHOOK_SECRET` | CLI |
| 10 | Set `STRIPE_SECRET_KEY` via the same CLI command | CLI |
| 11 | Enable Customer Portal: Settings → Billing → Customer portal → "Activate" | Dashboard |
| 12 | In Customer Portal config: allow update payment method, cancel subscription, view invoice history | Same screen |

If any of (1)–(10) is missing, payments will silently fail at runtime —
endpoint returns 503 or webhook returns 401. The /me UI hides the "Pay"
button when the summary endpoint 503s, so the visitor never sees an
inconsistent state.

**Handling a Loi 25 access request that mentions Stripe**

When a visitor sends a request under Loi 25 art. 27 ("send me
everything you have on me") and Stripe is on their radar:

1. Direct them to the Stripe Customer Portal (link on `/me`): they
   self-serve receipts, payment methods, and subscription state.
2. For full export beyond what the Portal shows, retrieve from Stripe
   Dashboard → Customers → search by their email → export. Deliver
   within 30 days per Loi 25.
3. For deletion under art. 28.1: see PIA §7 — Stripe-side records are
   retained for 7 years under CRA + FINTRAC obligations. Anonymize the
   Stripe customer object (replace email with `deleted+<id>@marc-portal.invalid`)
   and delete the local `payments` link rows; the immutable financial
   record stays in Stripe per the legal-obligation exception.

**Handling a Stripe breach notification**

If Stripe notifies you of an incident affecting your charges:

1. Read their incident report; identify the time window + affected
   accounts.
2. For any affected visitor: notify within 72h by email at the address
   on the session (Loi 25 art. 3.5 if risk of serious harm — card data
   leaks would qualify).
3. Notify the CAI within the same 72h window (Loi 25 art. 3.6).
4. Log the incident at the bottom of this RUNBOOK with date + Stripe's
   incident ID.

## Payments smoke test (test mode end-to-end)

Run before flipping a `sk_test_*` to `sk_live_*`, or any time the payment
code path changes materially. Goal: validate the full Checkout → webhook
→ /me update loop without spending real money.

**Prereqs**

- A `sk_test_*` Stripe secret key is installed (`wrangler pages secret put STRIPE_SECRET_KEY`).
- `STRIPE_WEBHOOK_SECRET` is set (`whsec_*` from the Stripe Dashboard for
  the corresponding test-mode endpoint).
- `STRIPE_CUSTODIAN_PRICE_ID` is the test-mode `price_*` for the
  $200/yr custodian product.
- Stripe CLI installed locally (`stripe --version`).

**Local-loop variant (recommended)**

For a tight feedback loop, point Stripe at `localhost`:

```bash
# Terminal 1 — run the app
npm run dev:cf            # serves on :8788 with Pages Functions

# Terminal 2 — forward Stripe events to it
stripe login              # one-time
stripe listen --forward-to localhost:8788/api/payments/webhook
# (the listener prints a whsec_*; export it as STRIPE_WEBHOOK_SECRET locally)
```

**Test card matrix** (Stripe test mode — no real charge):

| Card                | Behavior                            |
| ------------------- | ----------------------------------- |
| 4242 4242 4242 4242 | Success                             |
| 4000 0000 0000 9995 | Insufficient funds (declined)       |
| 4000 0000 0000 0341 | Successful auth, fails on charge    |
| 4000 0027 6000 3184 | 3D Secure challenge required        |

Any future expiry (e.g. `12/30`), any 3-digit CVC, any postal (e.g. `H1A 1A1`).

**Tier 1 happy path**

1. As admin, set a session to `status='active'`, `tier=1`.
2. Log in as the visitor; load `/me`. Confirm the "TEST MODE" banner is
   visible and `Payer Tier 1 (≈ 300 $)` is enabled.
3. Click → redirect to Stripe → enter `4242…4242` → submit.
4. Redirected back to `/me?paid=1&pay=pay_*`. UI flips to `Payé · 300,00 $`.
5. Verify D1: `wrangler d1 execute marc-portal-db --command "SELECT id, status, paid_at FROM payments ORDER BY created_at DESC LIMIT 1"` →
   one row, `status='paid'`, `paid_at` set.
6. Verify Stripe Dashboard → Payments → one $300 CAD entry, marked "Succeeded".

**Tier 2 (deposit + final) — exercises the new auto-prompt**

1. Set a session to `tier=2`.
2. Pay deposit (≈ 750 $) — same card flow as above.
3. **Verify the auto-prompt email fires.** Either inspect Resend's audit
   trail or watch the `stripe listen` output for `checkout.session.completed`
   → check the test inbox for "Dépôt Tier 2 reçu — solde final disponible".
4. Refresh `/me`. The button should now read `Payer le solde (≈ 750 $)`.
5. Pay the final → `/me` shows `Payé · 1 500,00 $` (sum, not just the leg).
6. Verify D1: two rows, both `status='paid'`, both `paid_at` set.

**Tier 2 retry-idempotency check (critical)**

The auto-prompt email MUST fire exactly once. To prove it:

1. Note the current count in the test inbox after a fresh deposit.
2. In Stripe Dashboard → Developers → Webhooks → find the
   `checkout.session.completed` event for that payment → "Resend".
3. Confirm: no second email arrives; `paid_at` is unchanged; payment
   row status remains `paid`.

**Custodian subscription**

1. On `/me`, click `Activer le mode dépositaire (200 $/an)`.
2. Pay with `4242…` → redirect back. UI shows `actif` + `Gérer
   l'abonnement`.
3. Click "Gérer" → opens Stripe Customer Portal.
4. Verify D1: `sessions.custodian_status='active'`,
   `sessions.custodian_subscription_id='sub_*'`. One `payments` row with
   `kind='custodian-sub'`, `stripe_invoice_id='in_*'`.
5. From the Portal, cancel the subscription → webhook fires
   `customer.subscription.deleted` → D1 flips to
   `custodian_status='switched_to_tout_a_toi'`. Admin gets the
   `[marc-portal] Stripe alert` email.

**Failure paths**

- **Unset `STRIPE_SECRET_KEY`**: `POST /api/payments/checkout` → 503;
  the "Pay" button stays mounted but the inner state never resolves
  (no banner shown either).
- **Unset `STRIPE_WEBHOOK_SECRET`**: `POST /api/payments/webhook` → 401.
- **Bad signature**: as above.
- **Visitor accessing another visitor's session**: → 403.

**When done**

- Reset the test session(s) in D1 if you don't want them lingering:
  `UPDATE sessions SET status='draft', tier=NULL WHERE id=...`.
- The "TEST MODE" banner remains on the live page while `sk_test_*` is
  in use — feature, not bug. It only disappears when a `sk_live_*` key
  replaces it.

## Useful one-liners

```bash
# Snapshot D1 contents (read-only, prod)
npx wrangler d1 execute marc-portal-db --remote --command "SELECT status, COUNT(*) FROM sessions WHERE deleted_at IS NULL GROUP BY status"

# Apply a single migration (dev)
npx wrangler d1 migrations apply marc-portal-db --local

# Tail prod Functions logs
npx wrangler pages deployment tail --project-name marc-portal
```
