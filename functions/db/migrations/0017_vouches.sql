-- Vouches — short public testimonials submitted by visitors who know
-- Marc (clients, colleagues, friends). The whole point is social proof
-- on the home page and a dedicated /vouches surface, so the schema is
-- shaped around "submit → moderate → display."
--
-- Submission is open (anyone with an email can write one); moderation
-- is the spam gate. Marc reviews in /admin/vouches; status flips from
-- 'pending' to 'approved' or 'rejected'. Only approved+!deleted rows
-- are returned by /api/public/vouches.
--
-- Email is stored for verification/contact but NEVER returned by the
-- public endpoint — the projection in functions/api/public/vouches.ts
-- explicitly drops it.
--
-- session_id is an optional link to a specific shipped project. When
-- present, the vouch can appear as a testimonial on that session's
-- /share/:id page. No FK constraint (D1 doesn't enforce; the join is
-- defensive in queries).
--
-- author_relationship is constrained at the application layer to one
-- of: 'client' | 'colleague' | 'friend' | 'other'. Stored as TEXT for
-- forward flexibility.
CREATE TABLE vouches (
  id TEXT PRIMARY KEY,
  author_name TEXT NOT NULL,
  author_email TEXT NOT NULL,
  author_relationship TEXT NOT NULL,
  body TEXT NOT NULL,
  link_url TEXT,
  session_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at INTEGER NOT NULL,
  approved_at INTEGER,
  deleted_at INTEGER
);

-- Public list query: filter by status + deleted_at, sort by created_at.
CREATE INDEX idx_vouches_public ON vouches (status, deleted_at, created_at);

-- Per-session projection: surface vouches on the /share/:id page.
CREATE INDEX idx_vouches_session ON vouches (session_id) WHERE session_id IS NOT NULL;

-- Rate-limit lookup: count recent submissions per email.
CREATE INDEX idx_vouches_email_created ON vouches (author_email, created_at);
