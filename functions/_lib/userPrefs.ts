// Per-email account preferences. Today: language. See migration 0018.
//
// Fallback chain for getLang(db, email):
//   1. user_prefs.lang      — explicit, identity-scoped preference
//   2. sessions.intake_json.lang  — legacy per-session signal (newest first)
//   3. 'fr'                 — practice default (OQLF copy / Quebec-first)
//
// Why a fallback at all: rows predating migration 0018 don't have a
// user_prefs entry. Reading the latest session's intake_json keeps the
// behaviour of pre-0018 emails until the visitor picks a language (which
// then upserts user_prefs and short-circuits the fallback).
//
// All emails are lowercased before lookup. Callers should pass whatever
// shape they have — this normalises.

export type Lang = 'fr' | 'en'

export function isValidLang(v: unknown): v is Lang {
  return v === 'fr' || v === 'en'
}

// Trim + length-cap a first name. Returns null for empty / whitespace /
// over-cap input rather than throwing — callers (PATCH /api/me/prefs)
// translate null into a 400 with a specific message. The 80-char ceiling
// is generous for compound names while still bounding email-template
// rendering ("Bonjour <name>,\n" stays one line in the inbox preview).
export function normalizeFirstName(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  if (!t) return null
  if (t.length > 80) return null
  return t
}

interface PrefRow {
  lang: string
  first_name: string | null
}

interface IntakeLangRow {
  intake_json: string | null
}

/**
 * Best-effort language lookup. Never throws — falls back to 'fr' on any DB
 * error, malformed JSON, or unknown lang value. Email notifications use
 * this to decide which copy to send.
 */
export async function getLang(db: D1Database, email: string): Promise<Lang> {
  return (await getLangExplicit(db, email)) ?? 'fr'
}

/**
 * Same lookup chain as getLang() but returns `null` when nothing was found
 * (no user_prefs row AND no usable intake_json). Lets callers tell apart
 * "user explicitly chose 'fr'" from "we have no signal and defaulted." The
 * Stripe webhook uses this so a visitor's explicit account pref always
 * beats the lang they happened to be browsing in at Checkout time.
 */
export async function getLangExplicit(db: D1Database, email: string): Promise<Lang | null> {
  const key = email.trim().toLowerCase()
  if (!key) return null

  try {
    const pref = await db
      .prepare(`SELECT lang, first_name FROM user_prefs WHERE email = ?`)
      .bind(key)
      .first<PrefRow>()
    if (pref && isValidLang(pref.lang)) return pref.lang
  } catch (err) {
    console.warn('userPrefs.getLangExplicit: user_prefs lookup failed', err)
  }

  // Legacy fallback: read the most recent live session's intake_json. Only
  // the visitor's own sessions are scanned (admin has no `sessions` row of
  // their own). For Marc's address this query simply returns nothing.
  try {
    const row = await db
      .prepare(
        `SELECT intake_json FROM sessions
         WHERE email = ? AND deleted_at IS NULL
         ORDER BY updated_at DESC LIMIT 1`,
      )
      .bind(key)
      .first<IntakeLangRow>()
    if (row?.intake_json) {
      const parsed = JSON.parse(row.intake_json) as { lang?: unknown }
      if (isValidLang(parsed.lang)) return parsed.lang
    }
  } catch (err) {
    console.warn('userPrefs.getLangExplicit: intake_json fallback failed', err)
  }

  return null
}

/**
 * Upsert. Used by the prefs API and by the magic-link first-touch path
 * (request-link.ts) so that the very first sign-in seeds a preference.
 *
 * Re-upserting an existing email overwrites — callers that want
 * "preserve existing value if any" should call setLangIfAbsent.
 */
export async function setLang(db: D1Database, email: string, lang: Lang): Promise<void> {
  const key = email.trim().toLowerCase()
  if (!key) return
  const now = Math.floor(Date.now() / 1000)
  await db
    .prepare(
      `INSERT INTO user_prefs (email, lang, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(email) DO UPDATE SET lang = excluded.lang, updated_at = excluded.updated_at`,
    )
    .bind(key, lang, now)
    .run()
}

/**
 * First-touch seeding from the magic-link request. If a user has already
 * picked a language explicitly (via /me prefs UI), the explicit choice
 * wins and we don't overwrite. INSERT OR IGNORE is the right primitive —
 * conflict on (email) = no-op.
 */
export async function setLangIfAbsent(db: D1Database, email: string, lang: Lang): Promise<void> {
  const key = email.trim().toLowerCase()
  if (!key) return
  const now = Math.floor(Date.now() / 1000)
  await db
    .prepare(`INSERT OR IGNORE INTO user_prefs (email, lang, updated_at) VALUES (?, ?, ?)`)
    .bind(key, lang, now)
    .run()
}

export interface UserPrefs {
  lang: Lang
  firstName: string | null
}

/**
 * Combined read for the /me prefs surface. Mirrors getLang's fallback for
 * the lang field; firstName is null until the visitor sets it. Never
 * throws — falls back to {lang:'fr', firstName:null} on any DB error.
 */
export async function getPrefs(db: D1Database, email: string): Promise<UserPrefs> {
  const key = email.trim().toLowerCase()
  if (!key) return { lang: 'fr', firstName: null }

  try {
    const row = await db
      .prepare(`SELECT lang, first_name FROM user_prefs WHERE email = ?`)
      .bind(key)
      .first<PrefRow>()
    if (row) {
      return {
        lang: isValidLang(row.lang) ? row.lang : 'fr',
        firstName: row.first_name ?? null,
      }
    }
  } catch (err) {
    console.warn('userPrefs.getPrefs: user_prefs lookup failed', err)
  }
  // Fall back to the lang-only fallback chain (legacy intake_json) so
  // visitors with pre-0018 history still see their language reflected.
  const lang = (await getLangExplicit(db, key)) ?? 'fr'
  return { lang, firstName: null }
}

/**
 * Upsert first_name. Pass `null` to clear. Email must already exist as a
 * user_prefs row in steady state; for first-touch we seed lang first
 * (request-link) which guarantees the row exists by the time the visitor
 * gets to /me to set their name.
 */
export async function setFirstName(
  db: D1Database,
  email: string,
  firstName: string | null,
): Promise<void> {
  const key = email.trim().toLowerCase()
  if (!key) return
  const now = Math.floor(Date.now() / 1000)
  // Use upsert (not UPDATE) so a /me PATCH from a user who somehow lacks
  // a row — old account predating the first-touch seed — still works.
  // Defaulting lang to 'fr' here matches the schema default.
  await db
    .prepare(
      `INSERT INTO user_prefs (email, lang, first_name, updated_at)
       VALUES (?, 'fr', ?, ?)
       ON CONFLICT(email) DO UPDATE SET
         first_name = excluded.first_name,
         updated_at = excluded.updated_at`,
    )
    .bind(key, firstName, now)
    .run()
}
