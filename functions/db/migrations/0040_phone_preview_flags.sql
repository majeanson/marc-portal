-- fix: phone-shaped card previews for the two phone-first games.
--
-- Ashwake and Dungeon Depths render portrait-first; their gallery cards
-- embedded a 1280×800 desktop viewport, which shows a stretched, letterboxed
-- version of each game. The new previewViewport flag ('phone') makes
-- ProjectCardPreview render a 430×932 frame instead. json_set preserves the
-- flags already on each row (allowedForPublic, showAsCurrentBuild).
--
-- Idempotent: setting the key to the same value is a no-op; the rows only
-- exist where 0030/0034 seeded them.

UPDATE session_advancements
SET
  flags_json = json_set(COALESCE(flags_json, '{}'), '$.previewViewport', 'phone'),
  updated_at = unixepoch()
WHERE id IN ('As3vB7qK6tP2', 'Db5mHc8yRw4T');
