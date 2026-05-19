-- Drop snd_voice_clips — the Sunday Night Dread template (feat-2026-021) is
-- retired. The demo page lived at /demo/sunday-night-dread and the buyer-facing
-- tenant app at any tenant with templateId='snd'; both are gone. The remaining
-- SND project itself now lives as a regular session, not as its own surface.
--
-- 0003_snd.sql cannot be deleted (D1 locks migrations by filename — see
-- migrations/README.md), so this DOWN-style migration runs forward to drop the
-- table cleanly. After running prod, this table is gone for good.

DROP TABLE IF EXISTS snd_voice_clips;
