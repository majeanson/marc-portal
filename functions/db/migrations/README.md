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

| File                | What it does                                                      |
| ------------------- | ----------------------------------------------------------------- |
| `0001_initial.sql`  | feat-2026-015 — sessions, messages, magic_link_tokens             |
| `0002_tenants.sql`  | feat-2026-016 — tenants, tenant_domains, audit_log; tenant_id FKs |
| `0003_snd.sql`      | feat-2026-021 — snd_voice_clips for the productized SND template  |

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
