-- System-level key/value store for cron heartbeats and other one-row-per-
-- topic state that doesn't belong on any business table.
--
-- First use is `last_digest_at` — a timestamp updated whenever the daily
-- digest cron fires. `/admin/today` reads it and flags the dashboard when
-- it's older than 36h, surfacing a silent cron-job.org outage that would
-- otherwise go unnoticed.
--
-- Future uses can piggyback (no migration needed): last_outbox_sweep_at,
-- last_orphan_gc_at, last_stripe_recon_at, etc. Keep the keys to short
-- dotted slugs — they're searchable in D1 directly.
--
-- Shape: not normalised — the `value` column is just a string. Callers
-- own the encoding (number → toString, JSON → stringify). At single-tenant
-- scale we trade a typed schema for migration-free additions.

CREATE TABLE system_kv (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
