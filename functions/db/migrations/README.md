# Migrations

Forward-only SQL migrations applied to the marc-portal D1 database.

## Apply locally (dev)

```sh
npm run db:migrate:local
```

Wrangler walks every numbered file in this directory and applies any not yet
recorded in the local D1 metadata.

## Apply to production

```sh
npm run db:migrate:prod
```

**Read this before running prod migrations:**

1. Migrations are forward-only. There is no rollback path. If a migration ships
   bad data or schema, you ship a forward fix, not a revert.
2. Migrations apply to the live D1 used by `marc-portal.pages.dev`. They take
   effect immediately on the next request.
3. Always apply locally first and verify the app still boots.
4. Long-running ALTERs are not safe — D1 has per-statement timeouts. Each
   migration in this directory is intentionally small and additive (CREATE
   TABLE / ADD COLUMN / INSERT seed rows).

## Migration log

| File                                | What it does                                                                                          |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `0001_initial.sql`                  | feat-2026-015 — sessions, messages, magic_link_tokens                                                 |
| `0002_tenants.sql`                  | feat-2026-016 — tenants, tenant_domains, audit_log; tenant_id FKs                                     |
| `0003_snd.sql`                      | feat-2026-021 — snd_voice_clips for the productized SND template (dropped in 0019)                    |
| `0004_volunteer.sql`                | feat-2026-022 — vr_shifts + vr_signups for Volunteer Roster                                           |
| `0005_session_audit.sql`            | Adds `deleted_at` (soft-delete) and `status_history` (JSON timeline) to sessions                      |
| `0006_rate_limits.sql`              | `rate_limits` table — shared rolling-window throttle keyed by endpoint+ip/email                       |
| `0007_attachments.sql`              | `attachments` table — R2-backed message attachments, linked to message_id (nullable)                  |
| `0008_intake_drafts.sql`            | `intake_drafts` table — server-side cross-device draft store, keyed by lowercased email               |
| `0009_session_advancements.sql`     | `session_advancements` — per-session build/demo records with CI-stamped build_url + commit_sha        |
| `0010_session_showcase.sql`         | Adds `showcased_at`, `showcase_title`, `showcase_tagline` to sessions for the public /projects gallery |
| `0011_session_tier.sql`             | Adds nullable `tier` (0/1/2/3) to sessions matching public Pricing copy                                |
| `0012_seed_external_showcases.sql`  | Seeds two externally-hosted showcase sessions (Jaffre + Retrodio) — idempotent INSERT OR IGNORE       |
| `0013_payments.sql`                 | `payments` table + custodian-mode cache on sessions; one row per Stripe money movement                |
| `0014_payments_v2.sql`              | Partial-refund accounting (`refunded_amount_cents`), webhook event dedupe, `admin_alerts` fallback     |
| `0015_session_tier3_amount.sql`     | Adds `tier3_amount_cents` to sessions for admin-quoted Tier 3 ("sur devis") projects                  |
| `0016_all_yours_ack.sql`            | Adds `all_yours_acknowledged_at` to sessions — explicit visitor opt-out of Custodian mode             |
| `0017_vouches.sql`                  | `vouches` table — short public testimonials with submit→moderate→display lifecycle                    |
| `0018_user_prefs.sql`               | `user_prefs` table — per-email key/value bag (starts with `lang`, grows over time)                    |
| `0019_drop_snd.sql`                 | Drops `snd_voice_clips` — Sunday Night Dread template retired                                          |
| `0020_session_decline_note.sql`     | Adds `decline_note` to sessions — operator-written "generous no" surfaced to the visitor              |
| `0021_message_media.sql`            | Extends `attachments` to carry voice notes + Excalidraw sketches as message media                      |
| `0022_pricing_v2.sql`               | Pricing v2: five-tier ladder + decoupled payment kinds (build/scoping/custodian)                       |
| `0023_session_custodian_plan.sql`   | Adds `custodian_plan` (watch/care) to sessions — denormalized for AdminCustodians MRR view             |
| `0024_user_prefs_first_name.sql`    | Add `first_name` (nullable) to `user_prefs`                                                            |
| `0025_community_discount.sql`       | Add `community_discount` (INTEGER bool) to `sessions`                                                  |
| `0026_email_outbox.sql`             | AUDIT P1.3: send-failure outbox for durable notices                                                    |
| `0027_email_events.sql`             | AUDIT P1.2: bounce/complaint events from Resend                                                        |
| `0028_operator_notes.sql`           | Per-session admin-only scratch pad for /admin/today                                                    |
| `0029_system_kv.sql`                | System-level key/value store for cron heartbeats (first use: `last_digest_at` for digest-cron staleness on `/admin/today`) |

## After applying 0002

The seeded tenant `t_marc` includes these domains by default:

- `marc-portal.pages.dev` (primary)
- `lifeascode.app`
- `localhost:5173` / `localhost:8788` (dev)
- `127.0.0.1:5173` / `127.0.0.1:8788` (dev)

If you serve the portal from a domain not in this list, the middleware will 404
every request. Add the domain via:

```sql
INSERT INTO tenant_domains (domain, tenant_id, is_primary, ssl_status, added_at)
VALUES ('your.example.com', 't_marc', 0, 'active', unixepoch());
```

…or use the admin wizard at `/admin/fleet/new` once it's live for buyer tenants.
