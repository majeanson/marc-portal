# 11pm runbook

If prod breaks at 11pm and your brain is at 30%, these are the suspects in
order. Check them top-down — most-likely first, cheapest-to-rule-out first.

## How to read each section

Every triage section is structured the same way so your eyes don't have to
re-orient at 11pm:

- **Symptoms:** what the visitor sees + what you see in logs/dashboards.
- **What happens (system behavior):** the actual code path that fires, the
  DB writes that land, and the side effects (emails sent, status flips).
  Knowing the *intended* flow is half of triaging the *broken* flow.
- **Email preview:** when the action sends mail, the literal subject and
  the body skeleton. Useful for confirming "yes, this came from us" vs.
  phish, and for understanding what the visitor/admin just received.
- **Step-by-step (recovery):** numbered commands or clicks, in order. No
  "fix the issue" — actual commands.

The Email gallery at the bottom of this file lists every email the system
can send, with subjects + body shapes, in one place for cross-reference.

## 1. Magic-link emails not arriving

**Symptoms:** visitor clicks "send me a link", form clears, no email shows up.

### What happens (system behavior)

1. Visitor submits the magic-link form → `POST /api/auth/request-link`.
2. Handler validates the email (no rate-limit hit), mints a one-time token
   (15 char base64url), stores it in D1 `magic_link_tokens` with a 30-min
   TTL.
3. `sendMagicLink()` POSTs to Resend with the rendered email + subject.
4. UI flips to "Check your inbox" regardless of delivery success — the
   handler intentionally returns 200 even if Resend errors, so a Resend
   outage doesn't expose "this email exists" / "doesn't exist" to a
   probing attacker.
5. The DB row exists either way; the visitor can request another link
   any time within the 30-min window.

### Email preview (FR — EN is parallel)

- **Subject:** `Ton lien de connexion` / `Your sign-in link`
- **From:** `Marc <noreply@marcportal.com>`
- **Body skeleton:**
  > **Ton lien de connexion**
  > Clique sur le bouton ci-dessous pour entrer dans ton espace. Aucun mot
  > de passe — le lien fait toute la job.
  >
  > Le lien expire dans **30 minutes**. Si tu n'as rien demandé, ignore ce
  > courriel et il disparaîtra de lui-même.
  >
  > [Se connecter →]    (terracotta-orange button)

### Step-by-step (recovery)

1. **Confirm the row landed.** Resend may be down; D1 isn't.
   ```bash
   npx wrangler d1 execute marc-portal-db --remote \
     --command "SELECT created_at, used_at FROM magic_link_tokens WHERE email = 'VISITOR@EXAMPLE.COM' ORDER BY created_at DESC LIMIT 1"
   ```
   Row present + `used_at IS NULL` → handler ran, Resend or inbox is the issue.
2. **Resend dashboard** → recent sends. If our send isn't logged, suspect
   `RESEND_API_KEY` is unset/expired (`wrangler pages secret list --project-name marc-portal`).
3. **Resend dashboard** → "Domains". `marcportal.com` must read "Verified".
   If "Pending", DNS hasn't propagated; if "Failed", DKIM is mis-pasted.
4. **Free-tier ceiling** (100/day): "Logs" tab. If exhausted, upgrade or
   wait until midnight UTC.
5. **Quick mitigation while diagnosing:** tell the visitor to check spam +
   re-request. Each request mints a fresh row; the cap is on tokens
   outstanding per email, not per day.
6. **Last resort** (Marc only, dev): grab the token from D1 + paste
   `/auth/callback?token=<token>&email=<email>` into the visitor's URL bar.
   Burn the token immediately by deleting the row.

## 2. `/api/capacity` or `/api/sessions` returns 500

**Symptoms:** homepage capacity counter stays empty; intake submit 500s.

### What happens (system behavior)

- `/api/capacity` is a hot-path read: every home-page load + the operator
  hub call it. Its query is `SELECT COUNT(*) … FROM sessions WHERE status
  IN ('active','triage')` — references columns from migrations 0001 +
  0011 (`tier`) + 0019 (`deleted_at` post-snd-drop).
- `/api/sessions` (POST = intake submit) writes to sessions + advancements
  + intake_drafts, touching schema from migrations 0001, 0008, 0009.
- D1 throws "no such table/column" when the schema is behind the code —
  a fresh deploy that landed before its migration runs (manual partial
  deploy, hotfix bypassing `deploy.yml`).
- The middleware catches the exception via `captureWorkerException` and
  rethrows to Sentry; visitor sees a generic 500 with no schema hint
  (Loi 25: no leaking infra detail).

### Step-by-step (recovery)

1. **Tail logs** while reproducing — the D1 error text gives the missing
   column/table directly:
   ```bash
   npx wrangler pages deployment tail --project-name marc-portal
   ```
2. **Check applied migrations on prod:**
   ```bash
   npx wrangler d1 migrations list marc-portal-db --remote
   ```
   Anything in the local `functions/db/migrations/` folder that isn't
   applied prod-side is the suspect.
3. **Apply missing migrations** (idempotent — wrangler no-ops already
   applied ones):
   ```bash
   npx wrangler d1 migrations apply marc-portal-db --remote
   ```
4. **Refresh** the home page. `/api/capacity` should return `{active,
   triage, capacity}` again within ~5 sec.
5. **If migrations all show applied** but the error persists — likely a
   `database_id` mismatch in wrangler.toml. Cross-check with
   `wrangler d1 list --remote`; the id in `[[d1_databases]]` must match
   the actual DB Cloudflare created.

## 3. Every request 404s on a custom domain

**Symptoms:** the entire site responds 404 on the buyer's domain
(`example.com` shows `Not found.` while `marcportal.com` works fine).

### What happens (system behavior)

- Every Functions request hits `functions/_middleware.ts:resolveTenant()`.
  The middleware reads the `Host` header (lowercased), does a SELECT
  against `tenant_domains` joined to `tenants`.
- A match attaches `ctx.data.tenant` and runs the downstream handler.
- No match → terse 404 with body `Not found.` (`text/plain`). Deliberate:
  no tenant info leaked, no "did you mean…" hints. Looks like the
  domain isn't a website rather than "you're at the wrong site".
- Static assets (`/assets/*`, `/og-image.png`, etc.) DO serve from
  Pages even with no tenant match, because they're handled by Pages
  before the Functions middleware runs. Symptom = pure 404 on `/`, not
  a broken-asset page.

### Step-by-step (recovery)

1. **Confirm DNS is pointing at us.** `dig example.com CNAME` should
   resolve to `<project>.pages.dev`. If not, the buyer's DNS isn't
   wired up — that's their fix, not a runbook issue.
2. **Confirm the domain is attached to the Pages project.** CF
   Dashboard → Pages → marc-portal → Custom domains. Should list
   `example.com` with a green checkmark. If missing/red, attach via
   the dashboard or:
   ```bash
   npx wrangler pages project domain add --project-name marc-portal example.com
   ```
3. **Add the tenant_domains row** (the actual mapping the middleware
   reads):
   ```bash
   npx wrangler d1 execute marc-portal-db --remote --command \
     "INSERT INTO tenant_domains (tenant_id, domain, is_primary, added_at) VALUES ('t_marc', 'example.com', 0, unixepoch())"
   ```
   Field notes:
   - `tenant_id` — usually `'t_marc'` for the operator's own buyers.
     Other tenants would be `'t_<slug>'`.
   - `is_primary = 1` if this is the canonical surface for that
     tenant; `0` if it's a secondary alias pointing at the same
     tenant. Multiple `is_primary=1` rows per tenant is a data bug —
     the SELECT picks one arbitrarily.
   - `added_at` is NOT NULL with no default; `unixepoch()` works.
4. **Verify:** `curl -I https://example.com/` should return 200 within
   ~5 sec (the middleware's query cache is short).
5. **If still 404 after the row exists:** confirm with the SELECT below
   that the row landed (case sensitivity matters):
   ```bash
   npx wrangler d1 execute marc-portal-db --remote --command \
     "SELECT domain, tenant_id, is_primary FROM tenant_domains WHERE domain = 'example.com'"
   ```
6. **If `tenant.status='frozen'`:** the middleware returns 503 `This
   app is currently paused.` instead of 404. Flip back with
   `UPDATE tenants SET status='active' WHERE id='t_<id>'`.

## 4. Build fails in CI with `npm ci` lockfile error

**Symptoms:** GitHub Actions logs show `npm error code E_MISSING_PEER` or
explicit `@emnapi/core` / `@emnapi/runtime` "not found" lines during the
`npm ci` step of check.yml / e2e.yml / deploy.yml.

### What happens (system behavior)

- The lockfile is generated on Windows (Marc's laptop). npm 11.x
  optionalDependencies for `@emnapi/core` + `@emnapi/runtime` (used by
  Workers ai bindings) get pruned because Windows isn't a target
  platform for them.
- CI runs Linux → `npm ci` expects those entries to be present →
  install fails before any test or build runs.
- **The pre-push hook prevents this most of the time.**
  `.githooks/pre-push` invokes `scripts/check-lockfile.mjs` which scans
  `package-lock.json` for the required entries and blocks the push if
  any are missing. Hook auto-installs via the `prepare` lifecycle.
- It only reaches CI when the hook is bypassed (`git push --no-verify`)
  or skipped (clone without `npm install` ever running locally).

### Step-by-step (recovery)

1. **Run the fix script locally.** It auto-fetches `origin/main` first
   to ensure your lockfile is based on the latest:
   ```bash
   node scripts/fix-lockfile.mjs
   ```
2. **Commit + push the regenerated lockfile:**
   ```bash
   git add package-lock.json
   git commit -m "chore: restore @emnapi lockfile entries"
   git push
   ```
3. **Don't try `npm install --include=optional --package-lock-only`** —
   npm 11.x silently ignores the flag for cross-platform optional native
   deps. The script is the only path that actually injects the entries.
4. **If CI is mid-fail RIGHT NOW** and the script's fix is already on
   `origin/main` (race: lighthouse auto-commit landed between push and
   CI run), it's safe to re-run the failing workflow without changes.
5. **Permanent prevention:** never push with `--no-verify` unless the
   lockfile fix is already on origin. The hook's whole point is to
   catch this before it costs CI minutes.

## 5. Deploy succeeded but pages serve old code

**Symptoms:** the build URL (e.g. `<sha>.marc-portal.pages.dev`) shows the
new deploy, but visitors on `marcportal.com` still see the previous
version. JS bundle filenames in DevTools network tab don't match the
hashes in the new deploy.

### What happens (system behavior)

- Cloudflare Pages serves assets from edge caches. `public/_headers` sets
  `Cache-Control: public, max-age=31536000, immutable` for `/assets/*` —
  intentional, because each asset filename is content-hashed by Vite so
  the URL itself changes on every code change.
- `index.html` should NOT be cached aggressively — it carries the
  `<script>` tags pointing at the current asset hashes. Cached
  `index.html` = the visitor's browser loads old script references and
  the new bundle never reaches them.
- Pages' default for HTML is short cache (few minutes), but `_headers`
  rules + intermediate caches (the visitor's ISP, browser disk cache)
  can extend that window.

### Step-by-step (recovery)

1. **Confirm the deploy actually swapped the production alias.** CF
   Pages → marc-portal → Deployments — the top entry should be tagged
   "Production". If "Preview", manually promote via the "..." menu.
2. **Purge the cache** for the affected URLs only (not everything —
   that incurs cold-cache cost across all visitors):
   - CF dashboard → marc-portal → Caching → Purge Cache → "Custom Purge".
   - Enter the URLs (e.g. `https://marcportal.com/`,
     `https://marcportal.com/en`, `https://marcportal.com/index.html`).
3. **Have the visitor hard-reload** (Ctrl+Shift+R on Win/Linux, Cmd+
   Shift+R on Mac) — bypasses their browser disk cache.
4. **If still stale** after purge + hard reload: check
   `public/_headers` for an overly-broad cache rule on `*.html`. The
   default should be no rule (Pages picks short-cache).
5. **Rollback path** (if the new deploy is actually broken, not just
   cached):
   - CF Pages → Deployments tab → the prior good entry → "..." →
     "Rollback to this deployment".
   - Schema is forward-only (D1 migrations don't rollback), but old
     code against new schema is usually fine — most of our migrations
     are additive columns the old code ignores.

## 6. Cookie forgery suspected

**Symptoms:** account-takeover reports from a visitor; an admin-only
endpoint returning 200 to a non-admin email in logs; unexplained
`mp_session` cookies in Sentry breadcrumbs that don't match any account.

### What happens (system behavior)

- `functions/_lib/auth.ts:signSessionCookie` HMAC-SHA256-signs a JSON
  payload `{e: email, x: expSeconds}` with `SESSION_SECRET`.
- `verifySessionCookie` rejects any cookie whose HMAC doesn't match OR
  whose `x` is in the past. Without a valid `SESSION_SECRET`, the
  guard in `requireSessionSecret` throws
  `SessionSecretMisconfiguredError` — handlers that try to verify a
  cookie return 401, no forgery possible.
- The 32-char minimum is the *floor*, not the recommended length. A
  shorter secret = guessable HMAC = forgeable cookies. Production uses
  64 hex chars (`openssl rand -hex 32`).
- A compromised secret is the worst-case scenario: every existing
  cookie is forgeable until rotated.

### Step-by-step (recovery)

1. **Confirm the secret is set + long enough:**
   ```bash
   npx wrangler pages secret list --project-name marc-portal
   ```
   Look for `SESSION_SECRET` in the output. The CLI doesn't reveal the
   value (correct — it's a secret), but it lists whether it's present.
2. **Treat the absence of `SESSION_SECRET` as production-down.** The
   guard would throw on every auth-touching request; symptom is 500s
   not 200s. So if the symptom is "wrong user got in", the secret
   exists — focus on the value.
3. **Rotate the secret immediately** if forgery is plausible:
   ```bash
   # Generate a fresh 64-char hex secret
   openssl rand -hex 32 | tee /tmp/new-session-secret
   # Push it to prod
   cat /tmp/new-session-secret | npx wrangler pages secret put SESSION_SECRET --project-name marc-portal
   # Wipe the local copy
   rm /tmp/new-session-secret
   ```
4. **Blast radius:** every active session is immediately invalidated.
   Visitors next request → 401 → SPA redirects to `/login` → magic-link
   flow. ~5-min disruption for active visitors, no data lost.
5. **Audit the incident:** Sentry for any `currentEmail()` returning a
   surprising value, D1 `session_advancements` for unexpected
   `actor_email` values. Document what you found at the bottom of this
   file under "Incident log".
6. **Don't reset to a shorter secret** to "test something". The boot
   guard refuses anything under 32 chars and 500s every request. If you
   need to flip into maintenance mode, do that via the tenants table
   (`status='frozen'`), not by tampering with the secret.

## 7. Triage piling up

**Symptoms:** Marc didn't see new sessions; SLA timer (72h) overdue.

### What happens (system behavior)

- The daily digest cron (cron-job.org → `POST /api/admin/digest` with
  `X-Digest-Token`) runs once per morning UTC.
- The handler counts open work: untriaged sessions > 48h, unread visitor
  messages, unresolved `admin_alerts` rows (Stripe failures that bypassed
  email), and pending Tier-4 quotes.
- If anything is non-zero, Marc gets one digest email summarizing the
  queue with deep-links to `/admin/inbox/<sessionId>` for each item.
- If everything is empty, the handler returns 204 — no email — to avoid
  inbox noise.
- A separate "stuck triage" detector inside the same handler counts items
  > 48h since `created_at` AND still `status='triage'`; those get bolded
  in the digest body as overdue.

### Email preview

- **Subject:** `[marc-portal] Digest matinal — N élément(s) à voir`
- **From:** `Marc <noreply@marcportal.com>` (system tone, signed-off as
  "marc-portal")
- **Body skeleton (FR):**
  > **Digest matinal**
  > Trois choses ouvertes ce matin :
  >
  > - **2 sessions en triage** depuis plus de 48 h
  >   → [Ouvrir l'inbox →](https://marcportal.com/admin/inbox)
  > - **1 alerte Stripe non résolue** (sub renewal failed sub_xxx)
  >   → [Ouvrir admin/alerts →](https://marcportal.com/admin)
  > - **1 message visiteur non lu** (Jean Tremblay, sess_abc)
  >   → [Ouvrir la session →](https://marcportal.com/admin/inbox/sess_abc)

### Step-by-step (recovery)

1. **Check the cron actually fired this morning.** cron-job.org dashboard →
   the `marc-portal /api/admin/digest` job → "History". Last run should
   be ~8am UTC today. Green ✓ = handler returned 2xx.
2. **Run the digest manually if the cron skipped.** Same token + URL:
   ```bash
   curl -X POST -H "X-Digest-Token: $DIGEST_TOKEN" \
     https://marcportal.com/api/admin/digest
   ```
   Response: `200 {sent: true}` (digest had content + email landed),
   `204` (no content to send), or `401` (token mismatch — check
   `wrangler pages secret list`).
3. **If the email is sent but not arriving:** see section #1 (Resend).
4. **Walk the inbox by hand.** `/admin/inbox` shows the queue with the
   same age coloring the digest uses. Click into each `triage` over 48h
   and either reject (with `decline_note`) or activate.
5. **If the cron itself is broken** (cron-job.org account expired, free
   tier exhausted): the digest job is one of two on the free plan
   (other is `/api/health`). Re-create it per the "Synthetic monitor"
   setup section above; the schedule should be daily ~8am UTC.

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

**Symptoms:** `curl https://marcportal.com/api/health` returns 500, OR
the cron-job.org monitor fires its "marc-portal /api/health failing"
email to Marc.

### What happens (system behavior)

- `/api/health` runs a one-row probe (`SELECT 1 FROM sqlite_master
  LIMIT 1`) against D1. Returns `200 {ok:true, db:'ok', ts}` on
  success, `500 {ok:false, db:'fail', ts}` on D1 error.
- The cron-job.org monitor fires every 5 min. "Treat as failed" is
  configured to either HTTP ≥ 400 OR body missing `"ok":true`.
- This means the monitor catches both "D1 is down" and "the response
  body is malformed" (which would happen on a code regression to the
  endpoint itself).

### Monitor email preview

- **Subject:** `Cronjob "marc-portal /api/health" failed`
- **From:** `cron-job.org <reports@cron-job.org>`
- **Body skeleton:**
  > Hello,
  >
  > the cronjob "marc-portal /api/health" failed:
  > URL: https://marcportal.com/api/health
  > Time: <UTC timestamp>
  > HTTP status: 500
  > Response body: `{"ok":false,"db":"fail","ts":...}`
  >
  > Regards, your cron-job.org team

### Step-by-step (recovery)

1. **Check Cloudflare status first** — `https://www.cloudflarestatus.com/`.
   Workers / D1 incidents propagate to our health endpoint within
   seconds.
2. **Manually probe the endpoint:**
   ```bash
   curl -s https://marcportal.com/api/health | jq
   ```
   - `db:'ok'` — false alarm from the monitor (network blip). No action.
   - `db:'fail'` — D1 binding is unreachable.
3. **If `db:'fail'`** and Cloudflare isn't in incident:
   - Check `wrangler d1 list --remote` — confirm `marc-portal-db`
     exists with the same `database_id` as in `wrangler.toml`'s
     `[[d1_databases]]` block.
   - Mismatch = the binding points at a database that doesn't exist.
     Fix in `wrangler.toml`, commit, deploy.
4. **Tail logs while probing** to see the raw D1 error text:
   ```bash
   npx wrangler pages deployment tail --project-name marc-portal
   ```
5. **If the response body is malformed** (not JSON, or missing the
   `ok` field): a code regression. Roll back via section #5's rollback
   path until a fix lands.
6. **Mute the monitor** *only* if you're actively investigating —
   leaving it muted longer than the investigation = the next outage is
   silent.

## 9. Stripe — payment / webhook failures

**Symptoms:** visitor hits "Payer →" on /me and nothing happens; OR you got
the `[marc-portal] Stripe alert` email; OR a payment shows `status='pending'`
in D1 long after the visitor told you they paid.

### Path A — Checkout endpoint failing

**What happens (system behavior):**

- `POST /api/payments/checkout` → `currentEmail()` resolves the visitor →
  `canAccessSession()` verifies they own this session (or are admin) →
  `insertPending()` mints a `payments` row in `pending` status with a
  freshly generated `pay_*` id and the computed leg amount → the handler
  calls Stripe's `/v1/checkout/sessions` with our `Idempotency-Key:
  checkout-<paymentId>` → on success, `stripe_checkout_session_id` is
  attached to the row and the URL is returned. On Stripe error,
  `markFailed()` flips the row to `status='failed'` with the error
  message in `failure_reason`.
- Visitor's browser then `window.location.assign(checkoutUrl)`.
- Common failure shapes you'll see:
  - **503 "payments not configured"** — `STRIPE_SECRET_KEY` unset.
  - **503 "custodian {plan} price not configured"** — missing price ID
    var.
  - **400 "amountCadOverride out of range (100..100000 CAD)"** — admin
    tried a Tier-4 override outside the safety bounds.
  - **409 "build already fully paid"** — UI is stale (visitor refreshes;
    the page was cached after the final webhook). Not actually broken.
  - **409 "tier 4 not quoted yet"** — visitor on Tier 4 without
    `tier4_amount_cents` set. Marc must quote first.

**Step-by-step (recovery):**

1. **Tail Functions logs** while reproducing — the handler logs the
   Stripe error message verbatim before throwing.
   ```bash
   npx wrangler pages deployment tail --project-name marc-portal
   ```
2. **503 cluster:** set or rotate the missing secret.
   ```bash
   npx wrangler pages secret put STRIPE_SECRET_KEY --project-name marc-portal
   # paste the sk_live_xxx (or sk_test_xxx) value, hit Enter
   ```
   For custodian price IDs, edit `wrangler.toml [vars]` —
   `STRIPE_CUSTODIAN_WATCH_PRICE_ID` and `STRIPE_CUSTODIAN_CARE_PRICE_ID`
   — paste the real `price_xxx` from Stripe Dashboard → Products,
   commit, push. Plaintext lives in wrangler.toml, NOT the dashboard
   (see project memory `cf_pages_wrangler_toml_managed_vars`).
3. **400 / 409 cluster:** these are intentional contracts. If the visitor
   has a real problem, fix the underlying data (admin sets `tier4_amount_cents`,
   or admin marks the build complete via the legitimate flow), don't
   widen the API.
4. **If a `payments` row is stuck at `failed`:** check `failure_reason`
   column — it has the Stripe error text. Common: card was declined
   (Stripe rejects the Checkout session minting, rare); rate-limit
   (transient — visitor can retry, mints a new row).

### Path B — Webhook not arriving

**What happens (system behavior):**

- Stripe POSTs `/api/payments/webhook` with the event body + a
  `Stripe-Signature` header (`t=<ts>,v1=<hex>`).
- Our handler verifies the signature against `STRIPE_WEBHOOK_SECRET`. On
  mismatch → 401 (Stripe will NOT retry signature failures, by design).
- On valid signature + parseable body → `INSERT OR IGNORE INTO
  webhook_events (event_id, ...)`. If `changes === 0`, this is a Stripe
  retry of a known event — handler returns `200 {received:true,
  duplicate:true}` and skips side effects (admin emails would re-fire).
- Otherwise the event type drives the right handler:
  - `checkout.session.completed` → `handleCheckoutCompleted` (flips
    `payments.status='paid'`, attaches PI/sub/customer ids; on first
    transition only, fires `sendInstallmentClearedPrompt` for build
    legs that have a next installment).
  - `invoice.paid` → `handleInvoicePaid` (attaches invoice id to the
    initial row OR inserts a renewal row + bumps `custodian_status` to
    `active`).
  - `invoice.payment_failed` → `handleInvoiceFailed` (flips
    `custodian_status='past_due'`, fires admin alert via Resend OR
    `admin_alerts` row).
  - `customer.subscription.deleted` → `handleSubscriptionDeleted`
    (`custodian_status='switched_to_tout_a_toi'` per the Handoff page
    promise, fires admin alert).
  - `charge.refunded` → `handleChargeRefunded` (updates
    `refunded_amount_cents`, flips `status='refunded'` when cumulative
    refund ≥ amount; on FIRST refund only, fires `sendRefundNotice` to
    the visitor).
- 5xx is never returned — every internal failure is logged + 200ed so
  Stripe doesn't enter retry backoff on a transient D1 blip.

**Step-by-step (recovery):**

1. **Stripe Dashboard → Developers → Webhooks** → click the endpoint URL
   row → "Recent events" tab. Each event shows attempt history with
   response code + body.
2. **401 "signature mismatch":** the secret on our side doesn't match.
   Dashboard → endpoint → "Click to reveal" → copy the `whsec_*` →
   ```bash
   npx wrangler pages secret put STRIPE_WEBHOOK_SECRET --project-name marc-portal
   ```
   No need to "Roll" the secret unless you suspect compromise; rolling
   invalidates the old one immediately and you'd need to redeploy fast
   to avoid every in-flight event 401ing.
3. **401 "webhook secret not configured":** same fix — the secret is
   simply unset on prod.
4. **5xx (handler threw):** Sentry will have it with full request
   context. Check the recent deploys; the handler is designed to absorb
   D1 failures with log+200, so a 5xx is either a code bug or the
   middleware caught the exception and rethrew via
   `captureWorkerException`.
5. **2xx but our DB didn't update:** the handler short-circuited on
   `event_id` dedupe (duplicate Stripe retry), OR the event metadata is
   malformed (no `client_reference_id`, no `payment_intent`). Inspect
   the event body in the Dashboard.
6. **After fixing:** Dashboard → the failed event row → "Resend". Our
   dedupe is keyed on `event_id`, so this only takes effect if the
   `webhook_events` row was never inserted (i.e. we 401ed before
   recording).

### Path C — Payment row stuck in `pending`

**What happens (system behavior):**

- A `pending` row exists because `/api/payments/checkout` succeeded but
  no `checkout.session.completed` event arrived for it. Two real causes:
  1. **Visitor abandoned the Checkout page** — closed the tab before
     paying. The Stripe Checkout session itself expires after 24h, but
     our row has no auto-expiry (no cron prunes them today). Harmless:
     the next time they click Pay, a fresh row is minted. The orphan
     stays as historical noise.
  2. **Webhook delivery failed** (Path B). Visitor *did* pay; we just
     don't know yet.
- `nextIndex` in the build-installment counter is derived from
  `COUNT(* WHERE status='paid')`, NOT pending rows, so orphan pending
  rows don't block the next leg's checkout from minting.

**Step-by-step (recovery):**

1. **Cross-reference with Stripe Dashboard.** Search by amount + date,
   look for a Payment Intent with `client_reference_id` matching the
   stuck `pay_*` id.
2. **PI exists + paid:** webhook didn't arrive. Path B → "Resend" the
   `checkout.session.completed` event. Our handler is idempotent — a
   double-arrival via Resend is no harm.
3. **PI doesn't exist:** visitor abandoned. No action needed; consider
   leaving the row or running an occasional cleanup query:
   ```sql
   -- Marc-only, run interactively: shows pending rows older than 7 days
   SELECT id, session_id, kind, amount_cents,
          datetime(created_at, 'unixepoch') AS created
     FROM payments
    WHERE status = 'pending' AND created_at < unixepoch() - 7*86400;
   ```
   Decide case-by-case whether to delete or leave; deleting is safe
   because `pay_*` ids are never reused and nothing links to them
   externally.

### Path D — Visitor reports they paid but /me still shows "Pay now"

**What happens (system behavior):**

- The `/me` Pay button reads from `/api/me/payments/summary` which
  counts `paid` rows for the visitor's sessions. Until our row flips,
  the UI shows the button.
- Webhook is the only path that flips `pending → paid`. So this state =
  webhook never landed OR landed on the wrong row.

**Step-by-step (recovery):**

1. **Stripe Dashboard → Payments** → search by visitor's amount + date
   → find the charge.
2. **Verify it has `client_reference_id` matching a `pay_*` row** in
   our D1:
   ```bash
   npx wrangler d1 execute marc-portal-db --remote --command \
     "SELECT id, session_id, status, created_at FROM payments WHERE id = 'pay_xxxxx'"
   ```
3. **`client_reference_id` matches but row is `pending`:** Webhook
   never delivered (Path B). Stripe Dashboard → Events → find
   `checkout.session.completed` for this charge → "Resend". Our handler
   updates `status='paid'` + fires `sendInstallmentClearedPrompt` if
   build/multi-leg.
4. **No `client_reference_id`** (charge was created via a manual
   Payment Link in the Dashboard, not via our /api/payments/checkout):
   our flow can't reconcile it. Bookkeeping fix — insert manually:
   ```bash
   npx wrangler d1 execute marc-portal-db --remote --command \
     "INSERT INTO payments (id, session_id, kind, tier, installment_index, installment_of, amount_cents, currency, status, stripe_payment_intent_id, created_at, paid_at) VALUES ('pay_manual_$(date +%s)', '<sessionId>', 'build', 1, 1, 1, 75000, 'cad', 'paid', 'pi_xxx', unixepoch(), unixepoch())"
   ```
   Replace the literals (`<sessionId>`, `pi_xxx`, tier/amount) with the
   real values from the Stripe charge. The visitor's `/me` flips to
   Paid on next page load.

## 10. Refund issued but visitor confused

**Symptoms:** visitor emails to ask "did you actually refund me?" even
though Stripe issued the refund.

### What happens (system behavior)

- Stripe POSTs `charge.refunded` with the parent `payment_intent` id and
  the **cumulative** `amount_refunded` (NOT the delta of just this
  refund — Stripe always sends the running total).
- `handleChargeRefunded` looks up our payment row by
  `stripe_payment_intent_id`. If not found (refund initiated on a charge
  we never tracked, e.g. a manual Dashboard payment link), the handler
  logs + 200s. No mutation.
- Otherwise, it updates `refunded_amount_cents = amount_refunded`. When
  cumulative ≥ `amount_cents`, also flips `status='refunded'` and
  stamps `refunded_at`.
- **First-refund-transition guard:** the handler pre-reads the row's
  `refunded_amount_cents` BEFORE updating. If it was 0 and is now > 0,
  this is the FIRST refund — fire `sendRefundNotice` to the visitor.
  Partial-then-full sequences (two events) only send one email.
- Stripe also emails its own receipt (billing-platform tone). Our email
  is in Marc's voice + deep-links to `/me`.

### Email preview

- **Subject (full refund):** `Remboursement de 750,00 $ effectué` /
  `Refund of $750 issued`
- **Subject (partial):** `Remboursement partiel de 300,00 $` /
  `Partial refund of $300`
- **From:** `Marc <noreply@marcportal.com>`
- **Body skeleton (FR, full refund):**
  > **Ton remboursement est parti**
  > J'ai émis un remboursement de **750,00 $** via Stripe. Selon ta
  > banque, il apparaît sur ta carte entre 5 et 10 jours ouvrables.
  >
  > Le portail reflète déjà le changement — tu peux voir la nouvelle
  > ligne sous « Mes paiements ».
  >
  > [Ouvrir Mes paiements →]
- **Body skeleton (FR, partial $300 on $750):**
  > **Remboursement partiel envoyé**
  > J'ai émis un remboursement de **300,00 $** via Stripe. Selon ta
  > banque, il apparaît sur ta carte entre 5 et 10 jours ouvrables.
  >
  > C'est un remboursement partiel : le solde de ce paiement (450,00 $)
  > reste tel quel. Ta page Mes paiements montre les deux montants côte
  > à côte.

### Step-by-step

1. **Confirm the row reflects the refund.**
   ```bash
   npx wrangler d1 execute marc-portal-db --remote --command \
     "SELECT id, status, amount_cents, refunded_amount_cents, refunded_at FROM payments WHERE stripe_payment_intent_id = 'pi_xxx'"
   ```
2. **If `refunded_amount_cents` is 0:** webhook didn't arrive. Stripe
   Dashboard → Events → find `charge.refunded` → "Resend".
3. **If the row updated but visitor didn't get our email:** Resend may
   have failed (the handler logs + swallows). Check Resend dashboard
   for a delivery to the visitor's address near the refund time.
4. **If no Resend log:** worth running through Sentry (the catch around
   `sendRefundNotice` logs errors via `console.error`).
5. **Pro forma:** Stripe's own email always lands (different sender);
   our follow-up is supplemental. Reassuring the visitor that the
   Stripe receipt counts is fine.

## 11. Custodian sub failed renewal / canceled

**Symptoms:** visitor's `/me` says "Custodian past due" or "Switched to
All yours", or you got an admin alert mentioning a subscription id.

### What happens (system behavior)

- **Renewal succeeded:** `invoice.paid` → handler tries to UPDATE the
  initial row (where `stripe_invoice_id IS NULL`). If found, attach the
  invoice id. If not (initial already linked → this is a renewal),
  INSERT a fresh `pay_inv_<id>` row tied to the cached
  `custodian_subscription_id` and bump `custodian_status` to `active`.
- **Renewal failed:** `invoice.payment_failed` → flip
  `sessions.custodian_status='past_due'`. Fire
  `sendAdminAlert(maybeNotifyAdmin)`. If Resend fails, the alert lands
  in `admin_alerts` table; the daily digest surfaces it tomorrow morning.
- **Subscription canceled:** `customer.subscription.deleted` → flip
  `sessions.custodian_status='switched_to_tout_a_toi'` (Handoff page
  promise). Same admin alert path.

### Email preview (admin alert)

- **Subject:** `Alerte Stripe — quelque chose mérite ton attention`
- **From:** `Marc <noreply@marcportal.com>`
- **Body skeleton:**
  > **Une alerte Stripe vient d'arriver**
  > Custodian sub renewal failed (subscription sub_xxxxx)
  >
  > Si ce n'est pas livré et marqué non résolu, le digest quotidien va
  > te le rappeler. Tu peux aussi marquer comme résolu via D1.
  >
  > [Ouvrir l'admin →]

### Step-by-step (past_due)

1. **Email the visitor in your own voice** — system did the technical
   part, but a one-liner from Marc is the difference between an
   awkward auto-flip and an actual conversation. The session row has
   their email + `custodian_subscription_id` for context.
2. **Wait for Stripe to retry** — Smart Retries handle most card
   timeouts within 4 days. If the card actually died, the next
   `invoice.payment_failed` will still 200 (idempotent past_due flip),
   and eventually `customer.subscription.deleted` arrives.
3. **Manually mark the alert resolved** once handled:
   ```bash
   npx wrangler d1 execute marc-portal-db --remote --command \
     "UPDATE admin_alerts SET resolved_at = unixepoch() WHERE id = 'alrt_xxx'"
   ```
   Otherwise the digest re-surfaces it daily.

### Step-by-step (switched_to_tout_a_toi)

1. **Transfer the assets** Marc was holding: repo collaborator removal,
   DNS handover, account ownership swaps. The /handoff page has the
   visitor-facing checklist; the operator-side checklist is in
   `docs/handoff/CHECKLIST.md`.
2. **Confirm the visitor's `/me` reflects the new state** before
   resolving the admin alert.

## 12. e2e visual baselines diverge in CI

**Symptoms:** `e2e.yml` is red on a PR with `Expected an image NxN px,
received NxM px` failures in `screenshots.spec.ts` and/or
`error-states.spec.ts`. The diff PNGs in the run's
`playwright-report` artifact show pages shifted by tens-to-hundreds of
pixels, not pixel-noise.

### What happens (system behavior)

- Baselines are committed PNGs under `e2e/__screenshots__/{viewport}/`,
  rasterized on Windows. CI is Windows-pinned (see `e2e.yml`) precisely
  so the gate doesn't trip on font anti-aliasing between OSes.
- Any non-trivial UI commit (copy trim, pricing change, new section,
  removed component) shifts the document height. `maxDiffPixelRatio`
  absorbs sub-pixel drift but cannot rescue a dimension mismatch — a
  390×2003 baseline against a 390×2132 actual fails outright.
- A bulk regen workflow exists for exactly this reason. It runs the
  whole screenshot suite with `--update-snapshots`, commits the
  regenerated PNGs back to the PR, and rebases before pushing so the
  lighthouse auto-commit doesn't race it.

### Step-by-step (recovery)

1. **First — eyeball the diff PNGs in the run artifact**
   (`playwright-report.zip` → open the HTML report → click a failed
   test → "diff" tab). The committed baseline IS the spec — if a
   section is genuinely missing (not just shifted), regenerating
   bakes the regression in. Confirm "this looks how I wanted" before
   triggering the regen.
2. **Trigger the regen on the PR branch:**
   ```bash
   gh workflow run e2e-snapshots.yml --ref <your-branch>
   ```
   Or via the Actions UI: "e2e snapshots" → "Run workflow" → pick the
   branch. The workflow has a `concurrency` group with
   `cancel-in-progress: false` so two concurrent runs can't collide
   on the same binary PNG.
3. **Wait for the run.** It takes ~25 min on the Windows runner. It
   pushes a `chore(e2e): regenerate visual baselines …` commit to your
   branch, after rebasing on `origin/<your-branch>` so any in-flight
   lighthouse auto-commit on `main` doesn't blow it up.
4. **Pull the regenerated commit locally** before continuing work on
   the branch: `git pull --ff-only`. The PR will go green on the next
   e2e run (which uses the PR head, so it picks up the new baselines).
5. **Don't `playwright test --update-snapshots` locally.** Marc's
   laptop is Windows but Chromium versions / font hinting drift; the
   regen runner is the single source of truth.
6. **Don't bypass the e2e gate by pushing direct to `main`.** That
   silently ships the visual regression. Direct-to-`main` skips the
   PR gate by design (cost), but use it only for hot-fixes the regen
   workflow can't help with.

## 13. Community-pricing flag — visitor dispute or stuck toggle

**Symptoms:** EITHER (a) a visitor emails "I thought my project was
community-rate, why is the receipt full price?", OR (b) the admin
toggles **Tarif communautaire** on `/admin/inbox/:id` and the toggle
snaps back with the inline "figé — un versement a déjà été payé"
message.

### What happens (system behavior)

- `sessions.community_discount` (INTEGER 0/1) is read by every
  `kind: 'build'` checkout in `functions/api/payments/checkout.ts`. When
  1, `buildInstallmentPlan(..., true)` discounts the tier TOTAL by
  `COMMUNITY_DISCOUNT_PCT` (20%) BEFORE splitting installments — so
  every leg is reduced consistently and the legs still sum to the exact
  discounted total. Scoping + custodian rows ignore the flag.
- The flag is operator-set via PATCH `/api/sessions/:id` with body
  `{ communityDiscount: boolean }`. Admin-only.
- **Freeze rule:** the PATCH wraps the UPDATE in an atomic
  `WHERE NOT EXISTS (SELECT 1 FROM payments WHERE session_id = ? AND
  kind = 'build' AND status = 'paid')`. If any build leg is paid, the
  UPDATE affects 0 rows and the server returns 409 with the message
  `community discount is frozen — a build installment has already been
  paid`. The `CommunityDiscountToggle` component catches the 409 and
  renders the frozen-state hint inline.
- The Stripe line-item label gets a `— tarif communautaire` (FR) /
  `— community rate` (EN) suffix when the flag is on, so the visitor's
  Stripe receipt + the CRA paper trail both name *why* the amount is
  lower than the public tier price.

### Step-by-step — visitor says they should have been community-rate

1. **Check the session row.**
   ```bash
   npx wrangler d1 execute marc-portal-db --remote --command \
     "SELECT id, tier, community_discount FROM sessions WHERE id = '<sessionId>'"
   ```
   `community_discount = 0` means the flag wasn't set when the leg was
   charged. The visitor saw the full-price button on `/me` and the
   Stripe receipt has no community-rate suffix — consistent state.
2. **Decide:** is this a misunderstanding (the project wasn't actually
   eligible) or a true miss on your end (you forgot to toggle before
   the leg was paid)?
3. **If a true miss:** the freeze rule blocks a retroactive toggle.
   The fix is a Stripe **refund**, then re-toggle, then re-checkout.
   - In Stripe Dashboard, refund the charge. Webhook
     `charge.refunded` writes `refunded_amount_cents = amount_cents`
     and flips `status='refunded'` (see §10 for the full handler
     behaviour). Once `status` is no longer `'paid'`, the freeze guard
     releases.
   - Toggle **Tarif communautaire** ON via `/admin/inbox/:id`.
   - Ask the visitor to re-click Pay; the new checkout charges the
     discounted amount.
4. **Document the round-trip** in the session thread (visitor sees it):
   "Refund issued for $X, community rate now applied, new charge at
   $X×0.80 — sorry for the back-and-forth."

### Step-by-step — toggle won't take, "figé" inline message

This is the freeze rule firing as designed. The session has a paid
build leg; the only way through is via §10's refund flow followed by a
re-toggle (above). Don't try to bypass the guard in code — the whole
point is that the visitor's paid and unpaid legs always agree on the
rate.

If you need to verify *which* leg is blocking:
```bash
npx wrangler d1 execute marc-portal-db --remote --command \
  "SELECT id, kind, installment_index, status, amount_cents FROM payments WHERE session_id = '<sessionId>' AND kind = 'build' AND status = 'paid'"
```

## 14. Napkin missing on a session view

**Symptoms:** Visitor sketched on the intake form, submitted, and the
napkin section on `/session/:id` shows no image (or worse, a broken
`<img>`). The other intake details look right.

### What happens (system behavior)

Since P1.8 the napkin PNG is stored as a `kind='napkin'` row in
`attachments` (R2-backed), not inline in `intake_json`. The intake
client does two requests in sequence:

1. `POST /api/sessions` creates the session row. The PNG is **not** in
   the payload; only the editable scene + caption + form answers ride
   in `intake_json`.
2. `POST /api/sessions/:id/attachments?kind=napkin` uploads the PNG.

Step 2 is best-effort. If it fails, the session still exists — the
orchestrator (`src/lib/submitIntake.ts`) logs the upload error to Sentry
via `captureException` and proceeds. The visitor never sees a hard
error; they land on the confirmation page as if the submit fully
succeeded.

The session view (`src/pages/SessionPage.tsx`) builds the napkin's URL
from `session.napkin_attachment_id` (a derived field surfaced by every
session SELECT via a correlated subquery on the `attachments` table).
If that field is `NULL` AND the legacy inline `intake_json.napkin.png`
data URL is absent, NapkinSection is dropped entirely.

### Step-by-step — visitor says their sketch is missing

1. **Check Sentry first.** A `napkin upload failed: …` event from
   `Intake.tsx` (signed-in submit) or `MePortal.tsx` (post-magic-link
   finalize) will be present. The event's `sessionId` extra ties it to
   the affected row.

2. **Check the D1 row:**
   ```bash
   npx wrangler d1 execute marc-portal-db --remote --command \
     "SELECT id, kind FROM attachments WHERE session_id = '<sessionId>'"
   ```
   - No `kind='napkin'` row → the upload truly failed. Continue to step 3.
   - One `kind='napkin'` row but the visitor can't see it → check R2.

3. **Check R2** (the object SHOULD be at `sessions/<sessionId>/<attachmentId>`):
   ```bash
   npx wrangler r2 object get marc-portal-media \
     "sessions/<sessionId>/<attachmentId>" --pipe > /tmp/check.png
   ```
   A non-zero file means the object exists and the issue is client-
   side rendering (cache, CSP, browser console for clues). A 404 means
   the DB row points at a missing R2 object — see step 4.

4. **Recovery: ask the visitor to redraw + resubmit.** Don't try to
   patch the DB row in place. The intake draft is preserved across the
   magic-link round-trip, so the visitor's scene is usually still in
   their browser's `intake-draft` localStorage. Telling them
   "your sketch didn't make it — open intake and resubmit" is the
   cheapest recovery; the new submit hits the same code path with a
   fresh upload attempt.

5. **If R2 is the wider issue** (multiple napkins failed in a short
   window), check `gh run view --log` on the latest deploy for
   `env.MEDIA` binding warnings, and the Cloudflare R2 dashboard for
   error rates. The intake page hides the sketch step gracefully when
   R2 is unbound (the upload returns 503), but a *transient* R2
   outage would manifest as Sentry events with no graceful-degrade.

### Why we don't auto-retry server-side

The orchestrator could re-POST the napkin on failure, but the failure
modes that actually fire (R2 transient, magic-byte rejection on a
malformed PNG, per-session quota exceeded by a bad client) are not
helped by retry — they need either a human looking at Sentry or a
visitor-driven redo. Carrying the data URL forward in a
client-side retry queue is the next step if Sentry events start
clustering; until then, the redo-from-draft path is enough.

## 15. Email outbox — durable send not delivered

**Symptoms:** Daily digest log says `outbox sweep — retried N, delivered M,
failed K` with K trending upward over multiple days, OR a visitor reports
they never got a tier-assigned / refund / installment-cleared email.

### What happens (system behavior)

Five durable notices write to `email_outbox` when Resend fails at the
moment of send:

- `tier-assigned` (PATCH /api/sessions/:id with tier set)
- `refund-notice` (charge.refunded webhook)
- `installment-cleared` (checkout.session.completed for a build leg)
- `status-change` (PATCH /api/sessions/:id status transition)
- `withdrawal-visitor` (DELETE /api/sessions/:id by admin, visitor side)

Magic-link, admin-internal nudges, and the vouch-moderation ping are NOT
durable — they're either re-requestable (magic-link) or visible in the
admin UI on next visit (the rest).

The daily digest cron (`POST /api/admin/digest`) calls
`sweepEmailOutbox()` which:

1. Reads up to 25 pending rows where `attempts < 5`, oldest first.
2. For each, applies exponential backoff: skip if
   `now - last_attempt < 2^attempts * 60` (capped at 1h).
3. Calls Resend directly. On 2xx → set `sent_at`. On 5xx / network throw →
   bump `attempts`, set `last_attempt`, capture `last_error`.
4. Stops looking at a row once `attempts >= 5` — the row stays in the
   table for an operator to inspect / decide.

### Step-by-step — stuck row

1. **Find stuck rows:**
   ```bash
   npx wrangler d1 execute marc-portal-db --remote --command \
     "SELECT id, to_email, kind, attempts, last_error, created_at
      FROM email_outbox
      WHERE sent_at IS NULL AND attempts >= 5
      ORDER BY created_at"
   ```

2. **Diagnose `last_error`:**
   - `403: marcportal.com domain not verified` → DNS still pending or
     Resend domain status flipped back. See P1.1 in `AUDIT.md`.
   - `429: too many requests` → Resend free-tier daily cap (100/day) was
     hit. Wait until midnight UTC; the next digest sweep retries.
   - `5xx: …` → Resend platform incident; check Resend's status page.

3. **Force a single retry** (after fixing the upstream cause):
   ```bash
   npx wrangler d1 execute marc-portal-db --remote --command \
     "UPDATE email_outbox SET attempts = 0, last_error = NULL
      WHERE id = '<eob_id>'"
   ```
   Next digest run will pick it up. The 25-row batch is the throttle —
   no need to reset many rows at once.

4. **Triage by kind:**
   ```bash
   npx wrangler d1 execute marc-portal-db --remote --command \
     "SELECT kind, COUNT(*) as n
      FROM email_outbox WHERE sent_at IS NULL
      GROUP BY kind"
   ```
   A spike concentrated in one `kind` points at a template-specific
   issue. Spread across kinds points at Resend itself.

### Why we cap at 5 attempts

A row that fails 5 times across 5 different days has hit something
structural (bad address, account suspended, banned content). The sweeper
backing off is correct behavior — we don't want a digest that takes 30
minutes to process a stuck queue. A manual reset (step 3) is the escape
hatch; in practice this should fire rarely.

## 16. Resend domain + bounce webhook activation (P1.1 + P1.2)

This is a **one-time** procedure, gated on DNS access to marcportal.com.
Once activated, every send via `noreply@marcportal.com` stops 403-ing,
Gmail/Outlook reputation stops being shared with every other Resend
customer using `onboarding@resend.dev`, and bounce/complaint events flow
into the `email_events` table.

### Step 1 — Add the domain on Resend

1. Resend Dashboard → **Domains** → **Add Domain** → `marcportal.com`.
2. Resend lists 4 DNS records. Copy them somewhere temporary — they'll
   look like:

   ```
   TXT   resend._domainkey   p=MIGfMA…QIDAQAB
   MX    send                feedback-smtp.us-east-1.amazonses.com   (priority 10)
   TXT   send                v=spf1 include:amazonses.com ~all
   TXT   _dmarc              v=DMARC1; p=none;
   ```

   The `send` subdomain pattern is deliberate — Resend uses it for the
   feedback (bounce) loop. This is why the SPF + MX records here do NOT
   collide with the CF Email Routing records at the apex domain.

### Step 2 — Add the records to Cloudflare DNS

CF Dashboard → marcportal.com → **DNS** → **Add record**, one per row
from step 1. Leave Proxy disabled (DNS-only) for all four — these are
authentication records, not traffic.

### Step 3 — Wait for verification (~2–10 minutes)

Resend Dashboard → Domains → marcportal.com flips from `pending` to
`verified` when all 4 records resolve. If still pending after 10 minutes,
recheck the record values (DKIM keys are case-sensitive; a missing space
in the TXT body breaks DMARC).

Until verified, you can deploy with a temporary fallback:

```ts
// functions/_lib/email.ts
const RESEND_FROM = 'Marc Portal <onboarding@resend.dev>'
```

…then revert to `'Marc <noreply@marcportal.com>'` after verify. The
fallback degrades deliverability (shared reputation) but doesn't 403.

### Step 4 — Wire up the bounce/complaint webhook (P1.2)

1. Resend Dashboard → **Webhooks** → **Add Endpoint**.
2. URL: `https://marcportal.com/api/webhooks/resend`.
3. Events to subscribe: at minimum `email.bounced`, `email.complained`,
   `email.delivered`. `email.delivery_delayed` is useful for triage but
   noisy; subscribe only if you want it. Skip `email.sent` (we already
   log every successful send from our side).
4. Copy the signing secret (begins with `whsec_…`). Then locally:

   ```bash
   echo "whsec_…" | npx wrangler secret put RESEND_WEBHOOK_SECRET
   ```

   This deploys the secret to Pages without rebuilding.

### Step 5 — Verify with a test event

Resend Dashboard → Webhooks → endpoint → **Send Test Event**. Then:

```bash
npx wrangler d1 execute marc-portal-db --remote --command \
  "SELECT id, to_email, type, subtype, received_at FROM email_events
   ORDER BY received_at DESC LIMIT 5"
```

You should see one row from the test event within ~5 seconds. If
nothing arrives:

- Cloudflare Pages logs (`wrangler pages deployment tail`) — look for
  `resend webhook: …`. Signature mismatch logs as `401`; misconfig logs
  as `503 webhook secret not configured`.
- The Resend Dashboard's webhook log — the event will be marked
  "delivered" with our 200, or with our error code if rejected.

### Why this lands in two parts

P1.1 (domain) and P1.2 (webhook) are split because they fail
independently — a verified domain still works without the webhook
hooked up, and the webhook handler tolerates an unset secret (503) so
the code can ship now without breaking anything. The code paths are
audited and tested; the activation is a single sitting whenever DNS
access is available.

## 17. Suppression list — visitor reports not getting emails

**Symptoms:** Visitor messages saying "I never received the magic link"
OR "the tier-assigned email never arrived." The address might be on the
suppression list — meaning Resend told us at some point that the address
hard-bounced, complained, or the visitor clicked one-click unsubscribe,
and our send code is honoring that signal by skipping the send.

### What happens (system behavior)

Since P1.11, every send through `functions/_lib/email.ts` first calls
`isAddressSuppressed` against the `email_events` table. If a matching
row exists, the Resend POST is skipped entirely and the function returns
`{ ok: false, suppressed: 'complaint' | 'unsubscribed' | 'hard-bounce' }`.
Magic-link request handler bubbles the reason back to the SPA in the
`/api/auth/request-link` response body for a future "try another
address" hint.

Admin emails (whoever is in `env.ADMIN_EMAILS`) are exempt from the check
— Marc's own inbox can't be suppressed, otherwise admin alerts would
silently stop.

### Step-by-step — visitor says they're not getting mail

1. **Check `email_events` for that address:**
   ```bash
   npx wrangler d1 execute marc-portal-db --remote --command \
     "SELECT id, type, subtype, received_at FROM email_events
      WHERE to_email = LOWER('visitor@example.com')
      ORDER BY received_at DESC"
   ```
   - `type='email.complained'` → they hit Gmail's "Report spam" at some
     point. Talking to them out-of-band (different channel) is the only
     polite path.
   - `type='email.unsubscribed'` → they clicked the one-click unsubscribe.
     Could be deliberate or accidental (e.g. Gmail's "Unsubscribe" button
     is one tap, easy to misfire).
   - `type='email.bounced', subtype='permanent'` → the mailbox truly
     doesn't exist or was disabled. Address is invalid; ask for another.
   - `type='email.bounced', subtype='transient'` → soft bounce (mailbox
     full, greylisting). NOT suppressed — sends should still go through.
     If they're not getting mail anyway, the issue is downstream of us.

2. **If the suppression was wrong** (accidental click, recovered mailbox),
   delete the suppression event:
   ```bash
   npx wrangler d1 execute marc-portal-db --remote --command \
     "DELETE FROM email_events
      WHERE to_email = LOWER('visitor@example.com')
        AND type IN ('email.complained','email.unsubscribed')
        OR (type='email.bounced' AND subtype='permanent')"
   ```
   The next send will go through. Consider a follow-up email from a
   different channel to confirm the visitor actually wants to be
   re-subscribed.

3. **If there are no rows in `email_events`** for that address but they
   say they're not getting mail, the issue isn't suppression. Check:
   - Spam folder (Gmail aggressively bins anything that looks like
     transactional mail from a new sender).
   - Resend Dashboard → Emails → search by recipient — is Resend
     reporting it as delivered, deferred, or bounced?
   - Our outbox: `SELECT * FROM email_outbox WHERE to_email = '...' AND
     sent_at IS NULL` — is the send queued but stuck?

### Manual unsubscribe (operator-driven)

If a visitor emails Marc directly asking to unsubscribe (rather than
clicking the link):
```bash
npx wrangler d1 execute marc-portal-db --remote --command \
  "INSERT INTO email_events (id, to_email, type, subtype, payload, received_at)
   VALUES ('manual_$(date +%s)', LOWER('visitor@example.com'),
           'email.unsubscribed', 'manual',
           '{\"source\":\"operator-request\"}',
           strftime('%s','now'))"
```

Same suppression as the one-click flow.

## 18. `/admin/today` dashboard wrong, empty, or 500

**Symptoms:** the operator dashboard at `/admin/today` either returns 500,
shows "Failed to load", or renders with numbers that disagree with what
you see elsewhere (capacity counter, inbox, custodian board).

### What happens (system behavior)

- `/admin/today` is one round-trip to `GET /api/admin/today`. The handler
  pulls sessions + messages + payments + operator_notes + email events +
  email outbox + admin alerts + custodians in ~8 queries and composes the
  per-session **next action** via the pure-fn `functions/_lib/nextAction.ts`.
- The capacity numbers in the dashboard's "system health" panel are
  computed from the same `sessions` query as the rest of the page — they
  intentionally do not call `/api/capacity`, so the dashboard is
  internally consistent even if the home counter was momentarily stale.
- The note-snippet column wraps its `SELECT ... FROM operator_notes` in a
  `no such table` fallback. A deploy that landed the handler before
  migration 0028 ran will degrade to "no snippet visible", not 500.

### Step-by-step

1. **First probe the endpoint:**
   ```bash
   curl -s https://marcportal.com/api/admin/today \
     -H "Cookie: mp_sess=…" | jq '.generatedAtS, .sessions | length'
   ```
   - 401 → cookie missing/expired. Re-sign in.
   - 403 → cookie email isn't in the admin list (`ADMIN_EMAILS` in wrangler.toml).
   - 200 with a believable shape → the issue is client-side, see step 4.
   - 500 → continue.

2. **Tail logs while re-fetching** to see which SQL phase blew up:
   ```bash
   npx wrangler pages deployment tail --project-name marc-portal
   ```
   - `no such table: operator_notes` → migration 0028 hasn't applied.
     The fallback `try/catch` in `functions/api/admin/today.ts` should
     absorb this, but if you removed it: re-add. Then
     `npm run db:migrate:prod` from local to land the migration.
   - `no such column: ...` on the sessions/messages/payments query → a
     schema migration was reverted or skipped. Run `db:migrate:prod`.

3. **Capacity numbers disagree with the home counter:**
   - The home counter reads `/api/capacity`. The dashboard reads the same
     `sessions` rows that `/api/capacity` reads, but in its own query.
     If the two disagree, the only realistic cause is a write that
     landed mid-render. Reload both pages; they will reconcile.
   - If they stay disagreeing after a reload, that's a real bug — the
     atomic capacity guard in `PATCH /api/sessions/:id` is what enforces
     1+1, and a disagreement means a write bypassed the guard. Open an
     incident — this is the structural invariant from CLAUDE.md.

4. **Page rendered but a section is missing or wrong:**
   - The dashboard reads once on mount; there's no polling. A stale page
     left open all day is on the operator. Hit **Reload** (header) or
     refresh the browser.
   - A section showing 0 when you know there should be entries (e.g. a
     visitor sent a message that's been unanswered for two days but
     "Unanswered messages" is empty): the SLA windows are 24h for replies
     and 72h for triage/draft SLA — entries below those thresholds don't
     show. This is by design.

5. **Restoring confidence quickly** — the dashboard is a *view*, not a
   write path. If it's broken, none of the underlying surfaces are
   affected. The hub at `/admin`, the inbox at `/admin/inbox`, and the
   custodian board at `/admin/custodians` all keep working independently.

### What this dashboard does NOT do

- Does **not** mutate state. No "mark as resolved" buttons; the page
  links out to the focused surface for the action.
- Does **not** poll for live updates. One read on mount, manual reload.
- Does **not** read from the daily digest email cache. It reads D1 fresh.

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
| 5 | Reuse the existing **Custodian Mode** product: rename it to **Custodian Care** and add a recurring CAD price of $400.00/year, then archive its old $200 price. (Stripe prices are immutable — you add a new price and archive the old one; you never edit an amount in place. Archiving doesn't cancel anyone already on the $200 price.) Then create a second product, **Custodian Watch** — recurring CAD $120.00/year. | Products |
| 6 | Copy each `price_xxx` → paste into `wrangler.toml [vars]` as `STRIPE_CUSTODIAN_WATCH_PRICE_ID` and `STRIPE_CUSTODIAN_CARE_PRICE_ID` | Code commit + redeploy |
| 7 | Create webhook endpoint: `https://marcportal.com/api/payments/webhook` | Developers → Webhooks → Add |
| 8 | Select events: `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.deleted`, `customer.subscription.updated`, `charge.refunded` | Same form |
| 9 | Copy `whsec_*` → `npx wrangler pages secret put STRIPE_WEBHOOK_SECRET` | CLI |
| 10 | Set `STRIPE_SECRET_KEY` via the same CLI command | CLI |
| 11 | Enable Customer Portal: Settings → Billing → Customer portal → "Activate" | Dashboard |
| 12 | In Customer Portal config: allow update payment method, cancel subscription, view invoice history | Same screen |
| 13 | Cancellations → enable **"Cancel immediately"** alongside or instead of "Cancel at end of period". Default is period-end only, which means a visitor who hits "Manage subscription → Cancel" stays charged until renewal. Enable immediate so leaving the engagement is one click, not an email to Marc. | Same screen → Cancellations |

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
- `STRIPE_CUSTODIAN_WATCH_PRICE_ID` and `STRIPE_CUSTODIAN_CARE_PRICE_ID` are
  the test-mode `price_*` values for the Watch ($120/yr) and Care ($400/yr)
  custodian products.
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
   visible and `Payer (750 $)` is enabled.
3. Click → redirect to Stripe → enter `4242…4242` → submit.
4. Redirected back to `/me?paid=1&pay=pay_*`. UI flips to `Payé · 750,00 $`.
5. Verify D1: `wrangler d1 execute marc-portal-db --command "SELECT id, status, paid_at FROM payments ORDER BY created_at DESC LIMIT 1"` →
   one row, `status='paid'`, `paid_at` set.
6. Verify Stripe Dashboard → Payments → one $750 CAD entry, marked "Succeeded".

**Tier 2 (deposit + final) — exercises the new auto-prompt**

1. Set a session to `tier=2`.
2. Pay the first installment (900 $) — same card flow as above.
3. **Verify the auto-prompt email fires.** Either inspect Resend's audit
   trail or watch the `stripe listen` output for `checkout.session.completed`
   → check the test inbox for "Dépôt Tier 2 reçu — solde final disponible".
4. Refresh `/me`. The button should now read `Payer le versement 2/2 (900 $)`.
5. Pay the final → `/me` shows `Payé · 1 800,00 $` (sum, not just the leg).
6. Verify D1: two rows, both `status='paid'`, both `paid_at` set.

**Tier 2 retry-idempotency check (critical)**

The auto-prompt email MUST fire exactly once. To prove it:

1. Note the current count in the test inbox after a fresh deposit.
2. In Stripe Dashboard → Developers → Webhooks → find the
   `checkout.session.completed` event for that payment → "Resend".
3. Confirm: no second email arrives; `paid_at` is unchanged; payment
   row status remains `paid`.

**Custodian subscription**

1. On `/me`, click `Activer Watch (120 $/an)` (or `Activer Care (400 $/an)`).
2. Pay with `4242…` → redirect back. UI shows `actif` + `Gérer
   l'abonnement`.
3. Click "Gérer" → opens Stripe Customer Portal.
4. Verify D1: `sessions.custodian_status='active'`,
   `sessions.custodian_subscription_id='sub_*'`. One `payments` row with
   `kind='custodian'`, `custodian_plan='watch'`, `stripe_invoice_id='in_*'`.
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

## Calendar reminders

Time-based ops tasks that aren't urgent today but will rot if forgotten.

### DMARC tighten (target: 2026-06-14)

When Resend's `marcportal.com` domain was verified on 2026-05-16, the
DMARC record was added at `_dmarc.marcportal.com` as `v=DMARC1; p=none;`
— monitor-only. In 2-4 weeks (target 2026-06-14), check the deliverability
report in Resend (or a free DMARC analyzer like postmarkapp.com/dmarc).

If no false positives are visible (legitimate mail being marked as
suspicious by receivers), tighten to:

```
v=DMARC1; p=quarantine; pct=25;
```

`pct=25` quarantines only 25% of failing mail — gradual rollout. Wait
another 2 weeks; if still clean, drop pct and move to `p=quarantine`.
Eventually `p=reject` for max anti-spoof protection.

Update via Cloudflare DNS → `marcportal.com` → DNS → edit the existing
`_dmarc` TXT record. Propagation is ~5 min on CF nameservers.

If false positives appear (Marc's mail bouncing, Resend log showing
DMARC failures from a legitimate `noreply@marcportal.com` send), back
off to `p=none` and investigate before re-tightening.

## Email gallery (everything the system can send)

Cross-reference for "is this real or a phish?" and for "what was the
visitor about to receive?". Every email below is rendered by
`functions/_lib/email.ts` from the same cream-paper / sage-green /
terracotta template. All come `from: Marc <noreply@marcportal.com>`.

| # | Trigger | Function | Recipient | Subject (FR / EN) |
|---|---|---|---|---|
| 1 | Visitor requests sign-in link | `sendMagicLink` | visitor | `Ton lien de connexion` / `Your sign-in link` |
| 2 | Visitor posts a message in a session | `sendVisitorMessageNotification` | Marc | `[marc-portal] Nouveau message — <session name>` / `[marc-portal] New message — <name>` |
| 3 | Marc posts in a session | `sendMarcMessageNotification` | visitor | `Marc t'a répondu` / `Marc replied` |
| 4 | Admin advances a session (`draft → active`, etc.) | `sendStatusChangeNotification` | visitor | `Ta session est maintenant <status>` / `Your session is now <status>` |
| 5 | Visitor edits intake after admin engaged | `sendIntakeEditedNotification` | Marc | `[marc-portal] Intake édité — <session name>` |
| 6 | Visitor withdraws session | `sendWithdrawalNotification` | Marc | `[marc-portal] Session retirée — <session name>` |
| 7 | Build installment clears (and more legs remain) | `sendInstallmentClearedPrompt` | visitor | `Versement N/M reçu — prochain disponible` / `Installment N/M received — next one available` |
| 8 | Admin assigns a tier (or Tier-4 quote lands) | `sendTierAssignedNotification` | visitor | varies by tier — see function |
| 9 | Vouch submitted on a project | `sendNewVouchNotification` | Marc | `[marc-portal] Nouveau témoignage — <project>` |
| 10 | Subscription failure / cancellation (admin alert) | `sendAdminAlert` | Marc | `Alerte Stripe — quelque chose mérite ton attention` |
| 11 | Visitor confirms "Tout à toi" (opts out of Custodian) | `sendAllYoursAckNotification` | Marc | `Visiteur a confirmé « Tout à toi »` / `Visitor confirmed 'All yours'` |
| 12 | First refund transition on a payment | `sendRefundNotice` | visitor | `Remboursement de <amount> effectué` / `Refund of <amount> issued` (or "Partial refund of <amount>") |
| 13 | Daily digest with overdue triage / unresolved alerts | `(digest handler)` | Marc | `[marc-portal] Digest matinal — N élément(s) à voir` |

### Common shape

Every email uses the shared `renderEmail()` template:

- Cream paper background, sage-green left rule, terracotta accent for
  primary CTAs (login + payments — moments where the button IS the
  email).
- Single-column mobile-first. No images embedded; the wordmark is a
  CSS gradient block that degrades to bold text in ancient clients.
- Footer carries Marc's name + "depuis Montréal" / "from Montréal".
- Dark mode handled via `prefers-color-scheme` — recipients on dark
  clients see a cream-on-near-black variant of the same layout.

### "Is this a phish?" checklist

If you (or a visitor) get an email claiming to be from us and it looks
off, the genuine markers are:

- **From address:** `noreply@marcportal.com` — never a `+suffix`,
  never `support@`, never `billing@`.
- **DKIM passes** (most clients show a checkmark or "by marcportal.com").
- **Body voice:** terse, written in first-person ("J'ai émis…",
  "I issued…"), Québécois register in FR (`tu`, never `vous` outside
  legal pages). A polished generic English or French ("Dear customer,
  we are pleased to inform you…") is a forgery.
- **Links:** every CTA points at `marcportal.com` (no shortener, no
  bare IP, no lookalike domain). Stripe's own emails point at
  `stripe.com`; ours never redirect through Stripe.
- **No attachments.** We never attach files. Stripe sends receipts as
  inline HTML, not PDFs.

If something feels off, the deciding test: log into `/me` directly
(type the URL yourself) and check whether the claimed action actually
happened. The portal is always the source of truth.
