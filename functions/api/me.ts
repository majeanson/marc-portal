// GET /api/me — returns the current identity from the session cookie.
// 200 with {email, isAdmin} when authenticated, 200 with {email: null} when
// not. Returning 200 (not 401) keeps the SPA's bootstrap simpler: it always
// gets a JSON body, never a redirect or error.
//
// DELETE /api/me — Loi 25 self-serve erasure. Hard-deletes all data the
// signed-in visitor owns: sessions (cascades to messages + attachments via
// FK), magic-link tokens for their email, and best-effort R2 attachment
// objects. The session cookie is cleared on response.

import {
  clearSessionCookieHeader,
  currentEmail,
  newCsrfToken,
  setCsrfCookieHeader,
} from '../_lib/auth'
import type { Env } from '../_lib/env'
import { isAdmin } from '../_lib/env'
import { ok, unauthorized } from '../_lib/json'

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const email = await currentEmail(request, env.SESSION_SECRET)
  if (!email) return ok({ email: null, isAdmin: false })

  // Self-heal the CSRF cookie. Sessions issued before the CSRF rollout (or
  // anyone whose browser drops a cookie) get a fresh token on their next
  // bootstrap call. Side-effect-free for callers that already have one.
  const hasCsrf = (request.headers.get('Cookie') ?? '').includes('mp_csrf=')
  const headers = new Headers({ 'content-type': 'application/json; charset=utf-8' })
  if (!hasCsrf) {
    headers.append('Set-Cookie', setCsrfCookieHeader(newCsrfToken()))
  }
  return new Response(JSON.stringify({ email, isAdmin: isAdmin(env, email) }), {
    status: 200,
    headers,
  })
}

interface AttachmentR2Row {
  r2_key: string
}

export const onRequestDelete: PagesFunction<Env> = async ({ request, env }) => {
  const email = await currentEmail(request, env.SESSION_SECRET)
  if (!email) return unauthorized()

  // Best-effort R2 cleanup BEFORE we drop the rows — once the rows are gone,
  // we can't enumerate the objects. A failure here is logged but doesn't
  // block the DB deletion (orphaned R2 objects are recoverable manually).
  try {
    if (env.MEDIA) {
      const r2Rows = await env.DB.prepare(
        `SELECT a.r2_key
           FROM attachments a
           JOIN sessions s ON s.id = a.session_id
          WHERE s.email = ?`,
      )
        .bind(email)
        .all<AttachmentR2Row>()
      for (const row of r2Rows.results ?? []) {
        try {
          await env.MEDIA.delete(row.r2_key)
        } catch (err) {
          console.error('r2 delete failed for', row.r2_key, err)
        }
      }
    }
  } catch (err) {
    console.error('r2 enumeration failed', err)
  }

  // Hard-delete the visitor's data. Belt-and-suspenders: every child table
  // declares ON DELETE CASCADE on sessions(id), AND we delete the children
  // explicitly here. D1 enables foreign keys by default so the cascade
  // fires today, but the application never sets `PRAGMA foreign_keys = ON`
  // — so a runtime swap, a Miniflare default change, or a future "let's
  // disable FK for write perf" could silently turn cascade off and leave
  // orphan rows that a Loi 25 erasure was supposed to obliterate. Doing
  // both costs ~4 extra D1 statements per erasure (rare op) and removes
  // the dependency on FK enforcement entirely.
  //
  // Order matters when there are FKs between children: messages references
  // sessions; attachments references both sessions and messages. We do
  // attachments → messages → operator_notes → intake_drafts → payments →
  // sessions, then magic_link_tokens (no FK).
  await env.DB.prepare(
    `DELETE FROM attachments WHERE session_id IN (SELECT id FROM sessions WHERE email = ?)`,
  )
    .bind(email)
    .run()
  await env.DB.prepare(
    `DELETE FROM messages WHERE session_id IN (SELECT id FROM sessions WHERE email = ?)`,
  )
    .bind(email)
    .run()
  await env.DB.prepare(
    `DELETE FROM operator_notes WHERE session_id IN (SELECT id FROM sessions WHERE email = ?)`,
  )
    .bind(email)
    .run()
  await env.DB.prepare(`DELETE FROM intake_drafts WHERE email = ?`).bind(email).run()
  await env.DB.prepare(
    `DELETE FROM payments WHERE session_id IN (SELECT id FROM sessions WHERE email = ?)`,
  )
    .bind(email)
    .run()
  await env.DB.prepare(`DELETE FROM sessions WHERE email = ?`).bind(email).run()
  await env.DB.prepare(`DELETE FROM magic_link_tokens WHERE email = ?`).bind(email).run()

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'Set-Cookie': clearSessionCookieHeader(),
    },
  })
}
