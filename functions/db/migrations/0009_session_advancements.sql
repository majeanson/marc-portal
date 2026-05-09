-- feat-session-advancements
-- Per-session "advancements" — admin-posted records of build/demo progress with
-- optional Cloudflare Pages deployment URLs (auto-stamped by CI). Mirrors the
-- feature.json revisions[] pattern from feat-demo-sunday-night-dread, but for
-- engagement sessions: each advancement is a step in the iterative SND-style
-- cadence (rev 1 demo → rev 2 → ...) the visitor can time-travel through.
--
-- Visibility flags live in flags_json:
--   allowedForPublic    — non-owner non-admin visitors may see this entry
--   showInConversation  — render inline in the message thread (future)
--   showAsCurrentBuild  — pin as the headline "current demo" entry
--
-- build_url + commit_sha are stamped by .github/workflows/deploy.yml after
-- wrangler-action ships, via scripts/stamp-session-advancements.mjs.

CREATE TABLE session_advancements (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  -- unix seconds — when the advancement was created (independent of created_at
  -- so an admin can backdate). Defaults to created_at on insert.
  date INTEGER NOT NULL,
  author TEXT NOT NULL,
  label TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  -- Nullable; auto-stamped on next deploy if null.
  build_url TEXT,
  commit_sha TEXT,
  -- Optional path appended to build_url for the iframe preview (e.g. "/me",
  -- "/session/abc123"). When unset, the iframe shows the deploy root.
  iframe_path TEXT,
  -- JSON object: {allowedForPublic?: bool, showInConversation?: bool,
  -- showAsCurrentBuild?: bool}. Empty object is the default.
  flags_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX session_advancements_session_idx
  ON session_advancements(session_id, date DESC);

-- Index for the CI stamping query (find unstamped rows quickly).
CREATE INDEX session_advancements_unstamped_idx
  ON session_advancements(build_url) WHERE build_url IS NULL;
