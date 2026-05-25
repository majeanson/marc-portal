// GET + POST /api/unsubscribe — one-click + browser-click unsubscribe.
//
// Two callers:
//   POST — Gmail / Outlook's native unsubscribe button. RFC 8058 "One-Click"
//          POST. The mail client fires this when the user clicks the
//          "Unsubscribe" affordance baked into their inbox UI, driven by
//          the List-Unsubscribe + List-Unsubscribe-Post headers we attach
//          to every outbound email. No visitor browser is involved; we
//          return 200 + JSON and move on.
//   GET  — Visitor clicked an unsubscribe link in the email body. They
//          land on a small HTML confirmation page (rendered inline below —
//          no SPA route, no JS) so they see something concrete.
//
// Auth: stateless HMAC token over the recipient email (see
// functions/_lib/unsubscribe.ts). No cookie required — the visitor might
// not be signed in and the mail client definitely isn't. CSRF-exempt in
// the middleware for the same reason: there's nothing for an attacker to
// steal — the worst they can do is unsubscribe an address they already
// hold the signing-key-derived token for, which they don't.
//
// Idempotency: a second unsubscribe of the same address is a no-op. We
// still insert a fresh email_events row each time (operator can see the
// click history) but suppression treats one row identically to many.

import type { Env } from '../_lib/env'
import { badRequest, ok, unauthorized } from '../_lib/json'
import { recordUnsubscribe } from '../_lib/emailSuppression'
import { verifyUnsubscribeToken } from '../_lib/unsubscribe'

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  // One-click POST may put email + token in the URL query OR in the form
  // body. Gmail sends them in the query string + a body of
  // `List-Unsubscribe=One-Click`. We tolerate both shapes — RFC 8058 is
  // slightly ambiguous and clients vary.
  const url = new URL(request.url)
  let email = url.searchParams.get('email')
  let token = url.searchParams.get('token')
  if (!email || !token) {
    try {
      const form = await request.formData()
      email = email ?? (form.get('email') as string | null)
      token = token ?? (form.get('token') as string | null)
    } catch {
      // Body wasn't form-encoded — fall through to the missing-args check.
    }
  }
  if (!email || !token) return badRequest('missing email or token')

  const valid = await verifyUnsubscribeToken(env.SESSION_SECRET, email, token)
  if (!valid) return unauthorized('invalid unsubscribe token')

  await recordUnsubscribe(
    env.DB,
    email,
    'one-click',
    JSON.stringify({ source: 'list-unsubscribe-post', ua: request.headers.get('user-agent') }),
    Math.floor(Date.now() / 1000),
  )
  return ok({ unsubscribed: true, email })
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url)
  const email = url.searchParams.get('email')
  const token = url.searchParams.get('token')
  const lang = url.searchParams.get('lang') === 'en' ? 'en' : 'fr'

  if (!email || !token) {
    return new Response(renderHtmlPage(lang, 'error', null), {
      status: 400,
      headers: htmlHeaders(),
    })
  }

  const valid = await verifyUnsubscribeToken(env.SESSION_SECRET, email, token)
  if (!valid) {
    return new Response(renderHtmlPage(lang, 'invalid', email), {
      status: 401,
      headers: htmlHeaders(),
    })
  }

  await recordUnsubscribe(
    env.DB,
    email,
    'browser-click',
    JSON.stringify({ source: 'email-link-get', ua: request.headers.get('user-agent') }),
    Math.floor(Date.now() / 1000),
  )
  return new Response(renderHtmlPage(lang, 'ok', email), {
    status: 200,
    headers: htmlHeaders(),
  })
}

function htmlHeaders(): HeadersInit {
  return {
    'Content-Type': 'text/html; charset=utf-8',
    // Don't cache — the body is per-visitor (their email) and per-state.
    'Cache-Control': 'private, no-store',
  }
}

/** Tiny self-contained HTML page. No SPA, no JS, no external assets — the
 *  visitor came from email, they want one piece of feedback and to close
 *  the tab. Mirrors the palette of marcportal.com so it doesn't feel
 *  divorced from the brand. Bilingual via the `lang` query param. */
function renderHtmlPage(
  lang: 'fr' | 'en',
  state: 'ok' | 'invalid' | 'error',
  email: string | null,
): string {
  const t = COPY[lang]
  const msg = state === 'ok' ? t.ok(email ?? '') : state === 'invalid' ? t.invalid : t.error
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(t.title)}</title>
<style>
  :root { color-scheme: light dark; }
  body { margin: 0; padding: 0; background: #f5efe3; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
  main { max-width: 480px; margin: 24px; padding: 32px; background: #fffaf2; border-radius: 14px; box-shadow: 0 12px 30px rgba(36,30,20,0.08); }
  h1 { margin: 0 0 12px 0; font-size: 22px; color: #1f1d1a; font-weight: 700; letter-spacing: -0.01em; }
  p { margin: 0 0 12px 0; color: #3f3c34; font-size: 15px; line-height: 1.55; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; color: #5a554b; font-size: 13px; }
  .eyebrow { text-transform: uppercase; letter-spacing: 0.14em; font-size: 11px; font-weight: 600; color: #7a7568; margin: 0 0 14px 0; }
  .signoff { margin-top: 24px; color: #8a8478; font-size: 13px; }
  @media (prefers-color-scheme: dark) {
    body { background: #15130f; }
    main { background: #1c1a17; }
    h1, p { color: #f3eede; }
    code { color: #bdb5a3; }
  }
</style>
</head>
<body>
<main>
  <div class="eyebrow">${escapeHtml(t.eyebrow)}</div>
  <h1>${escapeHtml(t.heading[state])}</h1>
  ${msg}
  <p class="signoff">${escapeHtml(t.signoff)}</p>
</main>
</body>
</html>`
}

const COPY = {
  fr: {
    title: 'Désabonnement — Marc',
    eyebrow: 'désabonnement',
    heading: {
      ok: 'C’est fait.',
      invalid: 'Lien invalide ou expiré',
      error: 'Lien incomplet',
    },
    ok: (email: string) =>
      `<p>Tu ne recevras plus de courriels à <code>${escapeHtml(email)}</code> de la part du portail.</p>
       <p>Tes données restent en place — si tu veux aussi les effacer, connecte-toi à <code>/me</code> et clique sur « Effacer mon compte ».</p>`,
    invalid: `<p>Ce lien n’est plus valide. Si tu veux vraiment te désabonner, écris-moi à <code>marc@marcportal.com</code> et je m’en occupe à la main.</p>`,
    error: `<p>Le lien de désabonnement est incomplet. Réessaie depuis le bouton dans le courriel original.</p>`,
    signoff: '— Marc, depuis Montréal',
  },
  en: {
    title: 'Unsubscribed — Marc',
    eyebrow: 'unsubscribe',
    heading: {
      ok: 'Done.',
      invalid: 'Link invalid or expired',
      error: 'Link is incomplete',
    },
    ok: (email: string) =>
      `<p>You won't receive any more emails at <code>${escapeHtml(email)}</code> from the portal.</p>
       <p>Your data stays in place — if you'd like to erase it too, sign in at <code>/en/me</code> and hit "Delete my account".</p>`,
    invalid: `<p>This link is no longer valid. If you really want to unsubscribe, write me at <code>marc@marcportal.com</code> and I'll handle it by hand.</p>`,
    error: `<p>The unsubscribe link is missing its parts. Try again from the button in the original email.</p>`,
    signoff: '— Marc, from Montréal',
  },
} as const

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
