-- feat-message-media
-- Voice notes and Excalidraw sketches as first-class message attachments.
-- Reuses the existing `attachments` table + R2 (the MEDIA binding) rather than
-- a parallel store: upload -> R2, link-to-message, serve, orphan-sweep, the
-- per-session byte ceiling and the rate limits all already exist and apply
-- unchanged. This migration adds only what those primitives can't derive.
--
--   kind        'file' (every existing upload), 'voice', or 'sketch'. Set once
--               at upload time from the content type, so the thread renderer
--               and the digest orphan-sweep branch without re-sniffing MIME.
--               DEFAULT 'file' backfills every pre-migration row correctly.
--
--   transcript  kind='voice' only: the text Whisper produced at the edge
--               (Cloudflare Workers AI — see functions/_lib/transcribe.ts).
--               NULL for files and sketches, and for a voice note uploaded
--               while the AI binding was absent (graceful degrade: the audio
--               is still stored and playable, just not transcribed).

ALTER TABLE attachments ADD COLUMN kind TEXT NOT NULL DEFAULT 'file';
ALTER TABLE attachments ADD COLUMN transcript TEXT;
