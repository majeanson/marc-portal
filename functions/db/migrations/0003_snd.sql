-- feat-template-snd-package: per-tenant Sunday Night Dread data model.
-- Productizes the static demo into a real D1-backed app: voice clips
-- (transcripts) per tenant. Audio upload, invoice drafts, and end-users
-- come in follow-up migrations.

CREATE TABLE snd_voice_clips (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  recorded_at INTEGER NOT NULL,
  client_name TEXT NOT NULL,
  transcript_fr TEXT,
  transcript_en TEXT,
  created_by_email TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX snd_voice_clips_tenant_idx
  ON snd_voice_clips(tenant_id, recorded_at DESC);
