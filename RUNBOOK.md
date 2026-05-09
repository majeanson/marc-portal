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
    --command "INSERT INTO tenant_domains (tenant_id, domain) VALUES ('t_marc', 'example.com')"
  ```

  See `functions/db/migrations/README.md` for the exact shape.

## 4. Build fails in CI with `npm ci` lockfile error

**Symptoms:** GitHub Actions logs show a `@emnapi/*` mismatch.

- This is the Windows-vs-Linux optionalDeps thing — npm prunes the wrong
  set of native binaries when the lockfile is generated on Windows.
- Fix:

  ```bash
  npm install --include=optional --package-lock-only
  git add package-lock.json
  git commit -m "chore: regenerate lockfile with optional deps"
  git push
  ```

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
  curl -X POST -H "X-Digest-Token: $DIGEST_TOKEN" https://marc-portal.pages.dev/api/admin/digest
  ```

## 8. Health check failing

**Symptoms:** `curl /api/health` returns 500.

- `db: 'fail'` means the D1 binding is unreachable. CF status page first.
- If CF is fine, suspect a wrangler.toml binding mismatch — the
  `database_id` may not match the actual database. Run `wrangler d1 list
  --remote` to confirm.

## Useful one-liners

```bash
# Snapshot D1 contents (read-only, prod)
npx wrangler d1 execute marc-portal-db --remote --command "SELECT status, COUNT(*) FROM sessions WHERE deleted_at IS NULL GROUP BY status"

# Apply a single migration (dev)
npx wrangler d1 migrations apply marc-portal-db --local

# Tail prod Functions logs
npx wrangler pages deployment tail --project-name marc-portal
```
