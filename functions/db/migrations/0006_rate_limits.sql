-- feat-rate-limits
-- Single shared rate-limit table used by sessions/messages POST handlers.
-- key = `${endpoint}:${ip}` or `${endpoint}:${email}`. Window is rolling:
-- when a request arrives and `now - window_start > windowSec`, the row is
-- reset to count=1. Magic-link issuance has its own throttle anchored on
-- magic_link_tokens; this table is for everything else.

CREATE TABLE rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  window_start INTEGER NOT NULL
);

-- Used by the opportunistic sweep to prune rows older than 1 day.
CREATE INDEX rate_limits_window_idx ON rate_limits(window_start);
