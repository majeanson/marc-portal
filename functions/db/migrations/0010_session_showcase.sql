-- feat-session-showcase
-- Admin can opt a session into the public /projects gallery. When showcased_at
-- is non-null, the session appears on the public projects page; the admin-set
-- title + tagline drive the card copy. Visitors land on /share/<id> from the
-- card, which already shows public-flagged advancements (see migration 0009).
--
-- Session ID stays the capability for the share view (72-bit token); showcase
-- just exposes a curated index. Toggling off clears showcased_at; the title /
-- tagline rows stay so admin can re-showcase without retyping.

ALTER TABLE sessions ADD COLUMN showcased_at INTEGER;
ALTER TABLE sessions ADD COLUMN showcase_title TEXT;
ALTER TABLE sessions ADD COLUMN showcase_tagline TEXT;

-- Cheap lookup for the public gallery query (showcased rows, newest first).
CREATE INDEX sessions_showcased_idx ON sessions(showcased_at DESC) WHERE showcased_at IS NOT NULL;
