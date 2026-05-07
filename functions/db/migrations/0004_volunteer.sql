-- feat-template-volunteer-roster: per-tenant Volunteer Roster data model.
-- Differs from SND on purpose: forward-dated time buckets, slot fills,
-- mutable signups with uniqueness per (shift, volunteer email).

CREATE TABLE vr_shifts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  starts_at INTEGER NOT NULL,
  ends_at INTEGER NOT NULL,
  role TEXT NOT NULL,
  slots_needed INTEGER NOT NULL DEFAULT 1,
  location TEXT,
  notes TEXT,
  created_by_email TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX vr_shifts_tenant_starts_idx
  ON vr_shifts(tenant_id, starts_at);

CREATE TABLE vr_signups (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  shift_id TEXT NOT NULL REFERENCES vr_shifts(id) ON DELETE CASCADE,
  volunteer_email TEXT NOT NULL,
  volunteer_name TEXT,
  status TEXT NOT NULL DEFAULT 'confirmed'
    CHECK (status IN ('confirmed', 'cancelled')),
  created_at INTEGER NOT NULL,
  UNIQUE (shift_id, volunteer_email)
);

CREATE INDEX vr_signups_shift_idx ON vr_signups(shift_id);
CREATE INDEX vr_signups_volunteer_idx
  ON vr_signups(tenant_id, volunteer_email);
