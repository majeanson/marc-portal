/**
 * Tiny localStorage-backed "last seen" tracker. Stores a map of
 * sessionId → unix-seconds, then exposes:
 *   - isUnread(session) — true iff the session has bumped updated_at since
 *     the visitor last opened it.
 *   - markSeen(session) — record the current updated_at as seen.
 *
 * Lossless across tabs because we read/write the full map per call.
 * Lossy across devices, by design — this is a UI affordance, not durable
 * state. The signal is "newer than what I last looked at on this browser."
 */

const KEY = 'marc-portal:last-seen'

interface LastSeenMap {
  [sessionId: string]: number // unix seconds
}

function read(): LastSeenMap {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null ? (parsed as LastSeenMap) : {}
  } catch {
    return {}
  }
}

function write(map: LastSeenMap): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(map))
  } catch {
    // private mode, storage full — silently no-op.
  }
}

export function isUnread(session: { id: string; updated_at: number }): boolean {
  const seen = read()[session.id]
  if (typeof seen !== 'number') return false // first sighting → not "unread"; intake creation isn't a notification
  return session.updated_at > seen
}

export function markSeen(session: { id: string; updated_at: number }): void {
  const map = read()
  if (map[session.id] === session.updated_at) return
  map[session.id] = session.updated_at
  write(map)
}

/**
 * Treat the first sighting as "seen at created time" so subsequent updates
 * register as unread. Called when /me first lists a previously-unknown
 * session — we don't want to flag the visitor's own freshly-submitted
 * intake as "new."
 */
export function seedIfMissing(session: { id: string; updated_at: number }): void {
  const map = read()
  if (map[session.id] !== undefined) return
  map[session.id] = session.updated_at
  write(map)
}
