-- feat-fleet-foundation: tenancy primitive
-- Adds: tenants (one row per buyer instance), tenant_domains (M:N for hosts),
--       audit_log (operator action trail), tenant_id FK on existing tables.
-- Backfills Marc's data as tenant 'marc'. Forward-only.

CREATE TABLE tenants (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  owner_email TEXT NOT NULL,
  template_id TEXT NOT NULL,
  template_version TEXT NOT NULL,
  theme TEXT NOT NULL DEFAULT '{}',
  flags TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'frozen')),
  created_at INTEGER NOT NULL,
  frozen_at INTEGER
);

CREATE INDEX tenants_owner_email_idx ON tenants(owner_email);

CREATE TABLE tenant_domains (
  domain TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  is_primary INTEGER NOT NULL DEFAULT 0,
  ssl_status TEXT NOT NULL DEFAULT 'active'
    CHECK (ssl_status IN ('pending', 'active', 'failed')),
  added_at INTEGER NOT NULL
);

CREATE INDEX tenant_domains_tenant_idx ON tenant_domains(tenant_id);

CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  ts INTEGER NOT NULL,
  actor_email TEXT NOT NULL,
  tenant_id TEXT,
  action TEXT NOT NULL,
  payload TEXT
);

CREATE INDEX audit_log_ts_idx ON audit_log(ts DESC);
CREATE INDEX audit_log_tenant_idx ON audit_log(tenant_id, ts DESC);

-- Add tenant_id to existing tables (D1 SQLite: nullable, no DEFAULT REFERENCES)
ALTER TABLE sessions ADD COLUMN tenant_id TEXT;
ALTER TABLE messages ADD COLUMN tenant_id TEXT;
ALTER TABLE magic_link_tokens ADD COLUMN tenant_id TEXT;

CREATE INDEX sessions_tenant_idx ON sessions(tenant_id);
CREATE INDEX messages_tenant_idx ON messages(tenant_id);
CREATE INDEX magic_link_tokens_tenant_idx ON magic_link_tokens(tenant_id);

-- Seed tenant 'marc' (operator + first buyer = self).
-- Theme '{}' falls back to the Bonjour defaults declared in styles.css :root.
-- flags.isOperator = true gates /admin access.
INSERT INTO tenants (id, slug, owner_email, template_id, template_version, status, theme, flags, created_at)
VALUES (
  't_marc',
  'marc',
  'marc.jeanson92@gmail.com',
  'marc-portal',
  '1.0',
  'active',
  '{}',
  '{"isOperator":true}',
  unixepoch()
);

-- Seed Marc's domains (prod + Cloudflare Pages preview + local dev).
-- The middleware accepts any of these as 'this is Marc'.
INSERT INTO tenant_domains (domain, tenant_id, is_primary, ssl_status, added_at) VALUES
  ('marc-portal.pages.dev',  't_marc', 1, 'active', unixepoch()),
  ('lifeascode.app',         't_marc', 0, 'active', unixepoch()),
  ('localhost:5173',         't_marc', 0, 'active', unixepoch()),
  ('localhost:8788',         't_marc', 0, 'active', unixepoch()),
  ('127.0.0.1:5173',         't_marc', 0, 'active', unixepoch()),
  ('127.0.0.1:8788',         't_marc', 0, 'active', unixepoch());

-- Backfill: every existing row belongs to Marc's tenant.
UPDATE sessions          SET tenant_id = 't_marc' WHERE tenant_id IS NULL;
UPDATE messages          SET tenant_id = 't_marc' WHERE tenant_id IS NULL;
UPDATE magic_link_tokens SET tenant_id = 't_marc' WHERE tenant_id IS NULL;
