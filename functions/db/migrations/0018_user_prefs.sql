-- Per-email account preferences. Today: language. Tomorrow: notification
-- channels, digest opt-in, etc. — the table is shaped as a key/value bag
-- on (email) rather than a column-bloated one-row-per-pref to keep future
-- additions migration-cheap.
--
-- Why a dedicated table instead of stuffing lang on `sessions`:
--   - Marc himself has no `sessions` row (admin only), but his notification
--     emails (vouches awaiting moderation, new visitor messages, all-yours
--     acks, withdrawals, intake-edits) STILL deserve his chosen language.
--     A vouch submitter who never signs in also has no session — but if
--     they later log in and pick a language, that should stick across all
--     future emails.
--   - Visitors can have many sessions; their language preference is
--     identity-scoped, not session-scoped. Previously we read it off
--     `intake_json.lang` per row, which makes "change my preference once"
--     impossible — there's no row to write to until they submit a session.
--
-- Lookup: email is the natural key. Always stored lowercased (the auth
-- layer already canonicalizes — see isPlausibleEmail in functions/_lib/auth.ts).
--
-- Fallback chain implemented in functions/_lib/userPrefs.ts:
--   user_prefs.lang  →  session.intake_json.lang (legacy rows)  →  'fr'.
--
-- 'fr' is the default because the practice is Quebec-first (OQLF copy, CAD,
-- Loi 25 framing). EN is fully supported but opt-in.
CREATE TABLE user_prefs (
  email TEXT PRIMARY KEY,
  lang TEXT NOT NULL DEFAULT 'fr' CHECK (lang IN ('fr', 'en')),
  updated_at INTEGER NOT NULL
);

-- Backfill: seed Marc's own preference so admin notifications respect his
-- canonical language out of the gate. Other rows fill in lazily — the first
-- magic-link request upserts the chosen lang (see request-link.ts).
INSERT INTO user_prefs (email, lang, updated_at)
VALUES ('marc.jeanson92@gmail.com', 'fr', unixepoch());
