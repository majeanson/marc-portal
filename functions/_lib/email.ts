// Resend wrapper + shared bilingual email shell. Free Resend tier: 100/day,
// 3000/mo. Send errors are logged and swallowed so a transient Resend
// outage doesn't 500 user-facing endpoints — the underlying mutation
// (magic-link token stored, message persisted, etc.) succeeds either way.
//
// Durable sends (AUDIT P1.3): a subset of notices — tier-assigned, refund,
// installment-cleared, status-change, withdrawal — pass `outboxDb` so that
// a Resend failure persists the rendered email into the `email_outbox`
// table. The daily digest cron (digest.ts) sweeps and retries pending rows
// until they deliver or hit `OUTBOX_MAX_ATTEMPTS`. Magic-link and
// admin-internal nudges stay non-durable (re-requestable / visible in the
// admin UI).
//
// Voice & visual:
//   - Warm, terse, written in Marc's own voice ("Bonjour", "Tu", small
//     signature, "— Marc, depuis Montréal").
//   - Cream paper, sage-green accent, terracotta orange for the primary
//     CTA. Mirrors the portal's styles.css palette so the email feels
//     like a postcard from the same world.
//   - Mobile-first single-column layout. No tables, no images embedded —
//     the wordmark is a CSS gradient block that degrades to bold text in
//     ancient clients. Dark-mode tested via `prefers-color-scheme`.
//
// Bilingual:
//   - Every email accepts a `lang: 'fr' | 'en'` parameter. Subjects,
//     leads, CTAs, footer copy are all looked up in renderEmail().
//   - Recipient language is resolved upstream via getLang() in
//     functions/_lib/userPrefs.ts (user_prefs table → session.intake_json
//     fallback → 'fr'). Callers pass whatever lang getLang() returned.
//
// Sender: noreply@marcportal.com. PREREQUISITE before deploying this
// constant:
//   1. Add marcportal.com on Resend Dashboard → Domains → Add.
//   2. Add the 4 records Resend lists into Cloudflare DNS:
//        TXT  resend._domainkey   p=MIGfMA…QIDAQAB
//        MX   send                feedback-smtp.us-east-1.amazonses.com (pri 10)
//        TXT  send                v=spf1 include:amazonses.com ~all
//        TXT  _dmarc              v=DMARC1; p=none;
//      Resend uses the `send` subdomain pattern for bounce handling, so
//      the SPF and MX records do NOT collide with CF Email Routing's
//      records at the apex.
//   3. Wait for Resend to flip the domain status to "verified" (2–10 min).
// Until verified, every send via this FROM fails with 403. To deploy
// BEFORE verification finishes, temporarily revert to
// 'Marc Portal <onboarding@resend.dev>' (Resend's shared domain, no DNS
// required — degrades deliverability but doesn't break sends).
const RESEND_FROM = 'Marc <noreply@marcportal.com>'
const RESEND_URL = 'https://api.resend.com/emails'

export type Lang = 'fr' | 'en'

interface ResendPayload {
  from: string
  to: string
  subject: string
  html: string
  text: string
}

/** Maximum retry attempts before the sweeper gives up. Past this, the row
 *  stays in email_outbox with `attempts >= MAX` and the digest stops
 *  picking it up — surface via D1 queries when investigating. */
export const OUTBOX_MAX_ATTEMPTS = 5

/** Outbox kinds — one label per durable send-site. Used for triage queries
 *  ("which template failed?") and for the digest summary. Not a foreign key. */
export type OutboxKind =
  | 'tier-assigned'
  | 'refund-notice'
  | 'installment-cleared'
  | 'status-change'
  | 'withdrawal-visitor'

interface OutboxContext {
  db: D1Database
  kind: OutboxKind
}

async function send(
  apiKey: string,
  payload: ResendPayload,
  outbox?: OutboxContext,
): Promise<boolean> {
  let lastError: string | null = null
  try {
    const res = await fetch(RESEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      lastError = `${res.status}: ${(await res.text()).slice(0, 200)}`
      console.error('resend send failed', lastError)
    } else {
      return true
    }
  } catch (err) {
    lastError = String(err).slice(0, 200)
    console.error('resend send threw', err)
  }
  // Resend failed (HTTP or threw). For durable sends, persist the rendered
  // payload into the outbox so the digest sweeper can retry. Best-effort:
  // if the outbox write itself fails, we'd already-logged the original
  // Resend error, so just log + return false.
  if (outbox) {
    try {
      await enqueueForRetry(outbox.db, outbox.kind, payload, lastError ?? 'unknown')
    } catch (queueErr) {
      console.error('outbox enqueue failed (continuing)', queueErr)
    }
  }
  return false
}

/** Persist a rendered email into the outbox. Caller has already failed
 *  one Resend send — we record that as `attempts = 1` so the cap is honest. */
async function enqueueForRetry(
  db: D1Database,
  kind: OutboxKind,
  payload: ResendPayload,
  lastError: string,
): Promise<void> {
  const id = `eob_${crypto.randomUUID().slice(0, 16)}`
  const now = Math.floor(Date.now() / 1000)
  await db
    .prepare(
      `INSERT INTO email_outbox
        (id, to_email, subject, html, text_body, kind, created_at,
         attempts, last_attempt, last_error, sent_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, NULL)`,
    )
    .bind(id, payload.to, payload.subject, payload.html, payload.text, kind, now, now, lastError)
    .run()
}

/** Pending row shape for the sweeper. Mirrors the email_outbox schema. */
interface OutboxPendingRow {
  id: string
  to_email: string
  subject: string
  html: string
  text_body: string
  kind: string
  attempts: number
}

/**
 * Sweep the outbox. Called from the daily digest cron. For each pending
 * row whose attempts are below the ceiling, retry the Resend POST. Mark
 * sent_at on success; bump attempts + record last_error on failure. Bounded
 * per-call: only pulls up to `batch` rows so a backed-up outbox doesn't
 * blow the cron's runtime budget.
 *
 * Backoff: a row with N attempts is skipped until at least 2^N minutes
 * have passed since `last_attempt` (1 → 2m, 2 → 4m, 3 → 8m, … cap at the
 * cron's daily cadence anyway). Keeps a transient Resend hiccup from
 * burning all attempts in the same minute.
 */
export async function sweepEmailOutbox(
  apiKey: string,
  db: D1Database,
  now: number,
  batch = 25,
): Promise<{ retried: number; delivered: number; failed: number }> {
  const rows = await db
    .prepare(
      `SELECT id, to_email, subject, html, text_body, kind, attempts
       FROM email_outbox
       WHERE sent_at IS NULL AND attempts < ?
       ORDER BY created_at ASC
       LIMIT ?`,
    )
    .bind(OUTBOX_MAX_ATTEMPTS, batch)
    .all<OutboxPendingRow>()
  const pending = rows.results ?? []
  let retried = 0
  let delivered = 0
  let failed = 0
  for (const row of pending) {
    // Exponential backoff — skip this iteration if we tried too recently.
    const minWait = Math.min(2 ** row.attempts * 60, 3600)
    const lastAttempt = await db
      .prepare(`SELECT last_attempt FROM email_outbox WHERE id = ?`)
      .bind(row.id)
      .first<{ last_attempt: number | null }>()
    if (lastAttempt?.last_attempt != null && now - lastAttempt.last_attempt < minWait) {
      continue
    }
    retried++
    const ok = await sendRaw(apiKey, {
      from: RESEND_FROM,
      to: row.to_email,
      subject: row.subject,
      html: row.html,
      text: row.text_body,
    })
    if (ok.delivered) {
      await db
        .prepare(`UPDATE email_outbox SET sent_at = ?, last_attempt = ? WHERE id = ?`)
        .bind(now, now, row.id)
        .run()
      delivered++
    } else {
      await db
        .prepare(
          `UPDATE email_outbox
           SET attempts = attempts + 1, last_attempt = ?, last_error = ?
           WHERE id = ?`,
        )
        .bind(now, ok.error ?? 'unknown', row.id)
        .run()
      failed++
    }
  }
  return { retried, delivered, failed }
}

/** Pure Resend POST without outbox side-effects. Used by the sweeper —
 *  the row is already in the outbox; we just want to try delivery and
 *  report success/failure separately. */
async function sendRaw(
  apiKey: string,
  payload: ResendPayload,
): Promise<{ delivered: boolean; error?: string }> {
  try {
    const res = await fetch(RESEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      return { delivered: false, error: `${res.status}: ${(await res.text()).slice(0, 200)}` }
    }
    return { delivered: true }
  } catch (err) {
    return { delivered: false, error: String(err).slice(0, 200) }
  }
}

// =============================================================================
// Shared template
// =============================================================================

interface CtaInput {
  href: string
  label: string
  /** Visual tone of the button. 'primary' = sage green (default for visitor
   *  emails); 'accent' = terracotta orange (login + payments — moments
   *  where the button IS the email). */
  tone?: 'primary' | 'accent'
}

interface RenderEmailInput {
  lang: Lang
  /** Small uppercase eyebrow above the headline. e.g. "session · triage". */
  eyebrow?: string
  /** The headline. Short, in the recipient's language. */
  headline: string
  /** One or more paragraphs of body copy (HTML allowed — caller is
   *  responsible for escaping user-supplied strings via escapeHtml). */
  paragraphs: string[]
  /** Optional pull-quote block. Rendered with a sage left-rule on cream.
   *  Used for message previews, vouch bodies, etc. */
  quote?: string
  /** Optional primary call-to-action. Omit for purely informational
   *  notifications. */
  cta?: CtaInput
  /** Optional secondary inline link below the CTA (small grey). Usually
   *  the URL itself, so the recipient can copy/paste if their client
   *  strips buttons. */
  altLink?: string
  /** Sign-off variant. 'marc' = "— Marc, depuis Montréal" (default for
   *  visitor-facing emails); 'system' = no signature (admin internal
   *  digests, where Marc IS the recipient). */
  signoff?: 'marc' | 'system'
}

const FOOTER_COPY = {
  fr: {
    tagline: 'Marc — un projet, fini en une fin de semaine.',
    sentTo: 'Envoyé à',
    why: 'Tu reçois ce message parce que tu as un compte ou une session ouverte sur le portail.',
    prefs: 'Changer ma langue ou mes préférences',
    privacy: 'Confidentialité',
    location: 'depuis Montréal',
    signoffMarc: '— Marc',
    altLinkLabel: 'Si le bouton ne fonctionne pas, copie ce lien :',
  },
  en: {
    tagline: 'Marc — one project, shipped in a weekend.',
    sentTo: 'Sent to',
    why: "You're getting this because you have an account or an open session on the portal.",
    prefs: 'Change my language or preferences',
    privacy: 'Privacy',
    location: 'from Montréal',
    signoffMarc: '— Marc',
    altLinkLabel: "If the button doesn't work, copy this link:",
  },
} as const

/**
 * Build the recipient-facing public origin from any function context. Falls
 * back to the production URL if not provided.
 */
function prefsUrl(origin: string, lang: Lang): string {
  return `${origin}${lang === 'en' ? '/en' : ''}/me#prefs`
}

function privacyUrl(origin: string, lang: Lang): string {
  return `${origin}${lang === 'fr' ? '/confidentialite' : '/en/privacy'}`
}

/**
 * Pure helper. Composes a Marc-flavoured HTML email and a matching plain
 * text body. Same input → same output. Callers don't touch HTML or
 * <style> blocks.
 */
function renderEmail(
  toEmail: string,
  origin: string,
  input: RenderEmailInput,
): { html: string; text: string } {
  const fc = FOOTER_COPY[input.lang]
  const tone = input.cta?.tone ?? 'primary'
  const btnBg = tone === 'accent' ? '#d97706' : '#3d6e4e'
  const btnShadow =
    tone === 'accent' ? '0 6px 18px rgba(217,118,6,0.28)' : '0 6px 18px rgba(61,110,78,0.24)'

  const eyebrowBlock = input.eyebrow
    ? `<div class="mc-eyebrow" style="text-transform:uppercase;letter-spacing:0.14em;font-size:11px;font-weight:600;color:#7a7568;margin:0 0 14px 0;">${escapeHtml(
        input.eyebrow,
      )}</div>`
    : ''

  const paragraphsBlock = input.paragraphs
    .map(
      (p) => `<p style="margin:0 0 14px 0;color:#1f1d1a;font-size:16px;line-height:1.55;">${p}</p>`,
    )
    .join('\n')

  const quoteBlock = input.quote
    ? `<blockquote class="mc-quote" style="margin:18px 0;padding:14px 18px;border-left:3px solid #3d6e4e;background:#fbf7ec;color:#3f3c34;font-size:15px;line-height:1.55;border-radius:0 6px 6px 0;font-style:italic;">${input.quote}</blockquote>`
    : ''

  const ctaBlock = input.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
        <tr><td style="border-radius:8px;background:${btnBg};box-shadow:${btnShadow};">
          <a href="${escapeAttr(input.cta.href)}" style="display:inline-block;padding:14px 26px;background:${btnBg};color:#fffaf2;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;letter-spacing:0.01em;">${escapeHtml(input.cta.label)}</a>
        </td></tr>
      </table>`
    : ''

  const altLinkBlock = input.altLink
    ? `<p class="mc-alt" style="margin:0 0 4px 0;color:#8a8478;font-size:12px;line-height:1.5;">${escapeHtml(
        fc.altLinkLabel,
      )}</p>
<p class="mc-alt" style="margin:0 0 14px 0;color:#8a8478;font-size:12px;line-height:1.5;word-break:break-all;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;">${escapeHtml(
        input.altLink,
      )}</p>`
    : ''

  const signoffBlock =
    input.signoff === 'system'
      ? ''
      : `<p style="margin:28px 0 0 0;color:#3f3c34;font-size:15px;line-height:1.5;">${fc.signoffMarc}<br><span style="color:#8a8478;font-size:13px;">${fc.location}</span></p>`

  // The header is a hand-built wordmark (no images). The gradient is a
  // sunset across cream → terracotta → sage so the email feels like a
  // place rather than a form. Dark-mode clients invert the cream
  // automatically and the gradient still reads.
  const headerBlock = `
    <div style="background:linear-gradient(135deg,#fbf7ec 0%,#fadfb8 45%,#cfdfd1 100%);padding:28px 28px 22px 28px;border-radius:14px 14px 0 0;">
      <div style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:700;letter-spacing:-0.01em;color:#2a2a26;">marc<span style="color:#d97706;">.</span></div>
      <div style="margin-top:6px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#7a7568;font-weight:600;">${escapeHtml(
        fc.tagline,
      )}</div>
    </div>`

  const footerBlock = `
    <div class="mc-foot" style="margin-top:32px;padding-top:18px;border-top:1px dashed #d8d2c4;color:#8a8478;font-size:12px;line-height:1.55;">
      <p style="margin:0 0 6px 0;">${fc.why}</p>
      <p style="margin:0;">
        ${fc.sentTo} <span style="font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#5a554b;">${escapeHtml(toEmail)}</span>
        · <a href="${escapeAttr(prefsUrl(origin, input.lang))}" style="color:#3d6e4e;text-decoration:underline;">${escapeHtml(fc.prefs)}</a>
        · <a href="${escapeAttr(privacyUrl(origin, input.lang))}" style="color:#3d6e4e;text-decoration:underline;">${escapeHtml(fc.privacy)}</a>
      </p>
    </div>`

  const html = `<!doctype html>
<html lang="${input.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(input.headline)}</title>
<style>
  @media (prefers-color-scheme: dark) {
    /* Body wrapper too — without this the card looks like it's floating on
       a bright shelf in dark-mode clients. */
    body.mc-body-bg { background:#15130f !important; }
    .mc-card { background:#1c1a17 !important; color:#f3eede !important; }
    .mc-body { color:#f3eede !important; }
    .mc-eyebrow { color:#bdb5a3 !important; }
    .mc-card p, .mc-card h1 { color:#f3eede !important; }
    .mc-quote { background:#241f17 !important; color:#e2dac6 !important; }
    .mc-alt   { color:#8a8478 !important; }
    .mc-foot  { color:#8a8478 !important; border-top-color:#3a3530 !important; }
  }
  @media (max-width: 520px) {
    .mc-shell { padding:12px !important; }
    .mc-card  { padding:0 !important; }
    .mc-inner { padding:22px !important; }
  }
</style>
</head>
<body class="mc-body-bg" style="margin:0;padding:0;background:#f5efe3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;">
  <div class="mc-shell" style="max-width:560px;margin:0 auto;padding:24px;">
    <div class="mc-card" style="background:#fffaf2;border-radius:14px;overflow:hidden;box-shadow:0 12px 30px rgba(36,30,20,0.08);">
      ${headerBlock}
      <div class="mc-inner" style="padding:28px;">
        ${eyebrowBlock}
        <h1 class="mc-body" style="margin:0 0 16px 0;color:#1f1d1a;font-size:22px;font-weight:700;line-height:1.3;letter-spacing:-0.01em;">${escapeHtml(input.headline)}</h1>
        ${paragraphsBlock}
        ${quoteBlock}
        ${ctaBlock}
        ${altLinkBlock}
        ${signoffBlock}
        ${footerBlock}
      </div>
    </div>
  </div>
</body>
</html>`

  // Plain-text version. Hand-shaped so it reads like a note, not a
  // stripped-HTML dump. Includes the bullet-pointed footer at the end.
  const textParagraphs = input.paragraphs
    .map((p) => stripHtml(p))
    .filter(Boolean)
    .join('\n\n')
  const textQuote = input.quote ? `\n\n  « ${stripHtml(input.quote)} »\n` : ''
  const textCta = input.cta ? `\n\n${input.cta.label}:\n${input.cta.href}` : ''
  const textSignoff = input.signoff === 'system' ? '' : `\n\n${fc.signoffMarc}\n${fc.location}`
  const textFooter = `\n\n— — —\n${fc.why}\n${fc.prefs}: ${prefsUrl(origin, input.lang)}\n${fc.privacy}: ${privacyUrl(origin, input.lang)}`

  const text = `${input.headline}\n\n${textParagraphs}${textQuote}${textCta}${textSignoff}${textFooter}`

  return { html, text }
}

// =============================================================================
// Magic link
// =============================================================================

export async function sendMagicLink(
  apiKey: string,
  email: string,
  url: string,
  lang: Lang,
): Promise<boolean> {
  const origin = new URL(url).origin
  const headline = lang === 'fr' ? 'Ton lien de connexion' : 'Your sign-in link'
  const p1 =
    lang === 'fr'
      ? 'Clique sur le bouton ci-dessous pour entrer dans ton espace. Aucun mot de passe — le lien fait toute la job.'
      : 'Hit the button below to walk into your space. No password — the link does the work.'
  const p2 =
    lang === 'fr'
      ? 'Le lien expire dans <strong>30 minutes</strong>. Si tu n’as rien demandé, ignore ce courriel et il disparaîtra de lui-même.'
      : 'The link expires in <strong>30 minutes</strong>. If you didn’t ask for this, ignore the email and it’ll fade away on its own.'
  const { html, text } = renderEmail(email, origin, {
    lang,
    eyebrow: lang === 'fr' ? 'connexion' : 'sign-in',
    headline,
    paragraphs: [p1, p2],
    cta: { href: url, label: lang === 'fr' ? 'Se connecter' : 'Sign in', tone: 'accent' },
    altLink: url,
  })
  return send(apiKey, {
    from: RESEND_FROM,
    to: email,
    subject: headline,
    html,
    text,
  })
}

// =============================================================================
// Visitor → Marc: someone posted in their session
// =============================================================================

export async function sendVisitorMessageNotification(
  apiKey: string,
  marcEmail: string,
  visitorEmail: string,
  sessionId: string,
  origin: string,
  preview: string,
  lang: Lang,
): Promise<boolean> {
  // Loi 25 / lock-screen privacy: keep the visitor's email out of the
  // subject line so a glance at Marc's notifications doesn't leak which
  // client is talking. The body still carries the full identifying info.
  const subject = lang === 'fr' ? 'Nouveau message dans le portail' : 'New message in the portal'
  const url = `${origin}/admin/inbox/${sessionId}`
  const headline =
    lang === 'fr' ? 'Quelqu’un t’a écrit dans une session' : 'Someone wrote to you in a session'
  const p1 =
    lang === 'fr'
      ? `<strong>${escapeHtml(visitorEmail)}</strong> a posté un message dans son fil.`
      : `<strong>${escapeHtml(visitorEmail)}</strong> just posted in their thread.`
  const { html, text } = renderEmail(marcEmail, origin, {
    lang,
    eyebrow: lang === 'fr' ? 'inbox · visiteur' : 'inbox · visitor',
    headline,
    paragraphs: [p1],
    quote: clip(preview, 400),
    cta: {
      href: url,
      label: lang === 'fr' ? 'Ouvrir dans l’inbox' : 'Open in inbox',
    },
    signoff: 'system',
  })
  return send(apiKey, { from: RESEND_FROM, to: marcEmail, subject, html, text })
}

// =============================================================================
// Marc → visitor: Marc replied in the session thread
// =============================================================================

export async function sendMarcMessageNotification(
  apiKey: string,
  visitorEmail: string,
  sessionId: string,
  origin: string,
  preview: string,
  lang: Lang,
): Promise<boolean> {
  const subject = lang === 'fr' ? 'Marc a répondu à ta session' : 'Marc replied to your session'
  const url = `${origin}${lang === 'en' ? '/en' : ''}/session/${sessionId}`
  const headline = lang === 'fr' ? 'J’ai répondu à ta session' : 'I replied to your session'
  const p1 =
    lang === 'fr'
      ? 'Voici l’essentiel — le fil complet vit sur la page de ta session.'
      : 'Here’s the gist — the full thread lives on your session page.'
  const { html, text } = renderEmail(visitorEmail, origin, {
    lang,
    eyebrow: lang === 'fr' ? 'session · message' : 'session · message',
    headline,
    paragraphs: [p1],
    quote: clip(preview, 400),
    cta: { href: url, label: lang === 'fr' ? 'Ouvrir la session' : 'Open the session' },
    altLink: url,
  })
  return send(apiKey, { from: RESEND_FROM, to: visitorEmail, subject, html, text })
}

// =============================================================================
// Status change
// =============================================================================

export async function sendStatusChangeNotification(
  apiKey: string,
  visitorEmail: string,
  sessionId: string,
  fromStatus: string,
  toStatus: string,
  origin: string,
  lang: Lang,
  outboxDb?: D1Database,
): Promise<boolean> {
  const url = `${origin}${lang === 'en' ? '/en' : ''}/session/${sessionId}`
  const fromLabel = statusLabel(fromStatus, lang)
  const toLabel = statusLabel(toStatus, lang)
  const subject =
    lang === 'fr' ? `Ta session est maintenant : ${toLabel}` : `Your session is now: ${toLabel}`
  const headline =
    lang === 'fr' ? `Ta session passe à « ${toLabel} »` : `Your session moved to “${toLabel}”`
  const p1 =
    lang === 'fr'
      ? `J’ai déplacé ta session de <strong>${escapeHtml(fromLabel)}</strong> à <strong>${escapeHtml(toLabel)}</strong>.`
      : `I moved your session from <strong>${escapeHtml(fromLabel)}</strong> to <strong>${escapeHtml(toLabel)}</strong>.`
  const p2 = statusSubcopy(toStatus, lang)
  const { html, text } = renderEmail(visitorEmail, origin, {
    lang,
    eyebrow: lang === 'fr' ? `session · ${toLabel}` : `session · ${toLabel}`,
    headline,
    paragraphs: [p1, p2],
    cta: { href: url, label: lang === 'fr' ? 'Voir ma session' : 'Open my session' },
    altLink: url,
  })
  return send(
    apiKey,
    { from: RESEND_FROM, to: visitorEmail, subject, html, text },
    outboxDb ? { db: outboxDb, kind: 'status-change' } : undefined,
  )
}

// =============================================================================
// Visitor → Marc: visitor edited their intake mid-flight
// =============================================================================

export async function sendIntakeEditedNotification(
  apiKey: string,
  marcEmail: string,
  visitorEmail: string,
  sessionId: string,
  origin: string,
  lang: Lang,
): Promise<boolean> {
  // Generic subject — body carries the identifying info. See the
  // lock-screen privacy comment in sendVisitorMessageNotification.
  const subject =
    lang === 'fr' ? 'Un visiteur a modifié son intake' : 'A visitor edited their intake'
  const url = `${origin}/admin/inbox/${sessionId}`
  const headline = lang === 'fr' ? 'Un intake vient d’être réécrit' : 'An intake was just rewritten'
  const p1 =
    lang === 'fr'
      ? `<strong>${escapeHtml(visitorEmail)}</strong> a mis à jour ses réponses d’intake.`
      : `<strong>${escapeHtml(visitorEmail)}</strong> updated their intake answers.`
  const p2 =
    lang === 'fr'
      ? 'Relis avant le triage — la demande s’est peut-être déplacée.'
      : 'Give it another read before triage — the ask may have shifted.'
  const { html, text } = renderEmail(marcEmail, origin, {
    lang,
    eyebrow: lang === 'fr' ? 'inbox · intake' : 'inbox · intake',
    headline,
    paragraphs: [p1, p2],
    cta: { href: url, label: lang === 'fr' ? 'Ouvrir dans l’inbox' : 'Open in inbox' },
    signoff: 'system',
  })
  return send(apiKey, { from: RESEND_FROM, to: marcEmail, subject, html, text })
}

// =============================================================================
// Withdrawal — symmetric (admin-side or visitor-side audience)
// =============================================================================

export async function sendWithdrawalNotification(
  apiKey: string,
  toEmail: string,
  byEmail: string,
  sessionId: string,
  origin: string,
  lang: Lang,
  audience: 'admin' | 'visitor',
  outboxDb?: D1Database,
): Promise<boolean> {
  // Subjects: admin side is generic (no email leak on lock screen); visitor
  // side is already non-identifying.
  const subject =
    audience === 'admin'
      ? lang === 'fr'
        ? 'Une session a été retirée'
        : 'A session was withdrawn'
      : lang === 'fr'
        ? 'Ta session a été retirée du portail'
        : 'Your session was withdrawn from the portal'

  const url =
    audience === 'admin'
      ? `${origin}/admin/inbox/${sessionId}`
      : `${origin}${lang === 'en' ? '/en' : ''}/me`

  const headline =
    audience === 'admin'
      ? lang === 'fr'
        ? 'Une session vient d’être retirée'
        : 'A session just got withdrawn'
      : lang === 'fr'
        ? 'Ta session a été retirée'
        : 'Your session was withdrawn'

  const p1 =
    audience === 'admin'
      ? lang === 'fr'
        ? `<strong>${escapeHtml(byEmail)}</strong> a retiré sa session. La ligne est en corbeille — visible dans le trash admin si tu veux la restaurer.`
        : `<strong>${escapeHtml(byEmail)}</strong> withdrew their session. The row is soft-deleted but still visible in the admin trash.`
      : lang === 'fr'
        ? 'J’ai retiré une de tes sessions du portail. Si c’est une erreur, écris-moi — la session existe encore en arrière-plan, je peux la remettre en ligne.'
        : 'I withdrew one of your sessions from the portal. If that was a mistake, write back — the session still exists behind the scenes and I can put it back.'

  const { html, text } = renderEmail(toEmail, origin, {
    lang,
    eyebrow: lang === 'fr' ? 'session · retirée' : 'session · withdrawn',
    headline,
    paragraphs: [p1],
    cta: {
      href: url,
      label:
        audience === 'admin'
          ? lang === 'fr'
            ? 'Ouvrir dans l’admin'
            : 'Open in admin'
          : lang === 'fr'
            ? 'Voir mes sessions'
            : 'Open my sessions',
    },
    signoff: audience === 'admin' ? 'system' : 'marc',
  })
  // Only the visitor-facing path is durable — the admin-side is internal
  // (the row stays in /admin/inbox trash; Marc sees it on next visit).
  return send(
    apiKey,
    { from: RESEND_FROM, to: toEmail, subject, html, text },
    outboxDb && audience === 'visitor' ? { db: outboxDb, kind: 'withdrawal-visitor' } : undefined,
  )
}

// =============================================================================
// Build installment cleared (a leg of a 2- or 3-installment build)
// =============================================================================

export async function sendInstallmentClearedPrompt(
  apiKey: string,
  visitorEmail: string,
  sessionId: string,
  paidIndex: number,
  totalOf: number,
  origin: string,
  lang: Lang,
  outboxDb?: D1Database,
): Promise<boolean> {
  const sessionUrl = `${origin}${lang === 'en' ? '/en' : ''}/session/${sessionId}`
  const remaining = totalOf - paidIndex
  const subject =
    lang === 'fr'
      ? `Versement ${paidIndex}/${totalOf} reçu — prochain disponible`
      : `Installment ${paidIndex}/${totalOf} received — next one available`
  const headline =
    lang === 'fr' ? 'Ton versement est rentré, merci' : 'Your installment landed — thank you'
  const p1 =
    lang === 'fr'
      ? `Le versement ${paidIndex} de ${totalOf} est confirmé du côté de Stripe et du portail.`
      : `Installment ${paidIndex} of ${totalOf} is confirmed on Stripe and in the portal.`
  const p2 =
    lang === 'fr'
      ? `Quand tu seras prêt à régler le ${remaining > 1 ? 'prochain versement' : 'dernier versement'}, retourne sur la page de ta session — le bouton est déjà actif et t’attend.`
      : `When you’re ready to pay the ${remaining > 1 ? 'next installment' : 'final installment'}, head back to your session page — the button is already live and waiting.`
  const { html, text } = renderEmail(visitorEmail, origin, {
    lang,
    eyebrow: lang === 'fr' ? 'paiement' : 'payment',
    headline,
    paragraphs: [p1, p2],
    cta: { href: sessionUrl, label: lang === 'fr' ? 'Ouvrir ma session' : 'Open my session' },
    altLink: sessionUrl,
  })
  return send(
    apiKey,
    { from: RESEND_FROM, to: visitorEmail, subject, html, text },
    outboxDb ? { db: outboxDb, kind: 'installment-cleared' } : undefined,
  )
}

// =============================================================================
// Tier assigned (or first Tier-3 quote landed)
// =============================================================================

export async function sendTierAssignedNotification(
  apiKey: string,
  visitorEmail: string,
  sessionId: string,
  tier: 0 | 1 | 2 | 3 | 4,
  amountCadCents: number | null,
  origin: string,
  lang: Lang,
  /** True when this email fires from a Tier-4 *quote* that landed AFTER the
   *  session was already active. Lets the subject read "Quote ready" rather
   *  than "Marc accepted." */
  isLateQuote: boolean = false,
  outboxDb?: D1Database,
): Promise<boolean> {
  const sessionUrl = `${origin}${lang === 'en' ? '/en' : ''}/session/${sessionId}`
  const priceLine = amountCadCents != null ? formatCadCents(amountCadCents, lang) : null

  let subject: string
  let headline: string
  let eyebrow: string
  let paragraphs: string[]

  if (tier === 0) {
    subject = lang === 'fr' ? 'Réponse de Marc — Tier 0 (gratuit)' : 'Marc replied — Tier 0 (free)'
    eyebrow = lang === 'fr' ? 'tier 0 · gratuit' : 'tier 0 · free'
    headline = lang === 'fr' ? 'Ton problème tient en Tier 0' : 'Your problem fits Tier 0'
    paragraphs =
      lang === 'fr'
        ? [
            'C’est trop petit pour engager un dev — et c’est une bonne nouvelle. Je te redirige vers un patron prêt à utiliser ou un template.',
            'Les détails sont dans le fil de ta session. Lis, applique, garde le portail ouvert si tu veux que je regarde le résultat.',
          ]
        : [
            'Too small to hire a dev for — and that’s good news. I’m pointing you at a ready-made pattern or template.',
            'The details are in your session thread. Read, apply, keep the portal open if you’d like me to glance at the result.',
          ]
  } else if (tier === 1) {
    subject =
      lang === 'fr'
        ? `J’embarque — Tier 1${priceLine ? ` (${priceLine})` : ''}`
        : `I’m in — Tier 1${priceLine ? ` (${priceLine})` : ''}`
    eyebrow = lang === 'fr' ? 'tier 1 · accepté' : 'tier 1 · accepted'
    headline =
      lang === 'fr'
        ? `J’ai accepté ton projet en Tier 1${priceLine ? ` (${priceLine})` : ''}`
        : `I accepted your project at Tier 1${priceLine ? ` (${priceLine})` : ''}`
    paragraphs =
      lang === 'fr'
        ? [
            'Le bouton <strong>Payer Tier 1</strong> est actif sur la page de ta session. Dès que le paiement rentre, j’ouvre la boîte à outils.',
            'Si tu as une question avant de payer, écris-la dans le fil — je réponds là.',
          ]
        : [
            'The <strong>Pay Tier 1</strong> button is live on your session page. The moment payment lands, I open the toolbox.',
            'If you have a question before paying, drop it in the thread — that’s where I answer.',
          ]
  } else if (tier === 2) {
    const halfLine = priceLine
      ? lang === 'fr'
        ? `Dépôt de ${formatCadCents(amountCadCents! / 2, lang)} pour démarrer (50 %), solde à la livraison.`
        : `${formatCadCents(amountCadCents! / 2, lang)} deposit to start (50%), balance at delivery.`
      : ''
    subject =
      lang === 'fr'
        ? `J’embarque — Tier 2 (~1 800 $) · dépôt pour démarrer`
        : `I’m in — Tier 2 (~$1,800) · deposit to start`
    eyebrow = lang === 'fr' ? 'tier 2 · accepté' : 'tier 2 · accepted'
    headline =
      lang === 'fr'
        ? `J’ai accepté ton projet en Tier 2${priceLine ? ` (≈ ${priceLine})` : ''}`
        : `I accepted your project at Tier 2${priceLine ? ` (≈ ${priceLine})` : ''}`
    paragraphs =
      lang === 'fr'
        ? [
            halfLine,
            'Le bouton <strong>Payer le dépôt</strong> est actif sur la page de ta session. Le solde s’ouvre à la livraison.',
          ]
        : [
            halfLine,
            'The <strong>Pay the deposit</strong> button is live on your session page. The balance unlocks at delivery.',
          ]
  } else if (tier === 3) {
    subject =
      lang === 'fr'
        ? `J’embarque — Tier 3${priceLine ? ` (${priceLine})` : ''}`
        : `I’m in — Tier 3${priceLine ? ` (${priceLine})` : ''}`
    eyebrow = lang === 'fr' ? 'tier 3 · accepté' : 'tier 3 · accepted'
    headline =
      lang === 'fr'
        ? `J’ai accepté ton projet en Tier 3${priceLine ? ` (${priceLine})` : ''}`
        : `I accepted your project at Tier 3${priceLine ? ` (${priceLine})` : ''}`
    paragraphs =
      lang === 'fr'
        ? [
            'Tier 3 se règle en versements. Le premier bouton de paiement est actif sur la page de ta session.',
            'Si tu as une question avant de payer, écris-la dans le fil — je réponds là.',
          ]
        : [
            'Tier 3 is paid in installments. The first payment button is live on your session page.',
            'If you have a question before paying, drop it in the thread — that’s where I answer.',
          ]
  } else {
    // tier 4 — quoted after triage
    if (isLateQuote) {
      subject =
        lang === 'fr'
          ? `Devis Tier 4 prêt${priceLine ? ` (${priceLine})` : ''}`
          : `Tier 4 quote ready${priceLine ? ` (${priceLine})` : ''}`
      eyebrow = lang === 'fr' ? 'tier 4 · devis prêt' : 'tier 4 · quote ready'
      headline =
        lang === 'fr'
          ? priceLine
            ? `Devis Tier 4 fixé à ${priceLine}`
            : 'Devis Tier 4 fixé'
          : priceLine
            ? `Tier 4 quote set at ${priceLine}`
            : 'Tier 4 quote set'
      paragraphs =
        lang === 'fr'
          ? [
              'Le bouton <strong>Payer (sur devis)</strong> est maintenant actif sur ta session.',
              'Des questions avant de régler ? Écris-les dans le fil — je réponds là, pas par courriel.',
            ]
          : [
              'The <strong>Pay (quoted)</strong> button is now live on your session.',
              'Questions before you settle? Drop them in the thread — I answer there, not by email.',
            ]
    } else {
      subject =
        lang === 'fr'
          ? `J’embarque — devis Tier 4${priceLine ? ` (${priceLine})` : ''}`
          : `I’m in — Tier 4 quote${priceLine ? ` (${priceLine})` : ''}`
      eyebrow = lang === 'fr' ? 'tier 4 · accepté' : 'tier 4 · accepted'
      headline =
        lang === 'fr'
          ? priceLine
            ? `J’ai accepté ton projet en Tier 4, fixé à ${priceLine}`
            : 'J’ai accepté ton projet en Tier 4'
          : priceLine
            ? `I accepted your project at Tier 4, set at ${priceLine}`
            : 'I accepted your project at Tier 4'
      paragraphs =
        lang === 'fr'
          ? [
              'Le bouton <strong>Payer (sur devis)</strong> est actif sur ta session.',
              'Si tu veux clarifier un détail du devis, écris dans le fil — c’est là que ça se passe.',
            ]
          : [
              'The <strong>Pay (quoted)</strong> button is live on your session.',
              'If a detail of the quote needs clarifying, write in the thread — that’s where it happens.',
            ]
    }
  }

  const { html, text } = renderEmail(visitorEmail, origin, {
    lang,
    eyebrow,
    headline,
    paragraphs,
    cta: { href: sessionUrl, label: lang === 'fr' ? 'Ouvrir ma session' : 'Open my session' },
    altLink: sessionUrl,
  })
  return send(
    apiKey,
    { from: RESEND_FROM, to: visitorEmail, subject, html, text },
    outboxDb ? { db: outboxDb, kind: 'tier-assigned' } : undefined,
  )
}

// =============================================================================
// New vouch awaiting moderation (admin-side)
// =============================================================================

export async function sendNewVouchNotification(
  apiKey: string,
  marcEmail: string,
  vouchId: string,
  authorName: string,
  authorEmail: string,
  relationship: string,
  bodyPreview: string,
  origin: string,
  lang: Lang,
): Promise<boolean> {
  const subject =
    lang === 'fr' ? 'Un nouveau vouch attend la modération' : 'A new vouch is awaiting moderation'
  const url = `${origin}/admin/vouches`
  const headline =
    lang === 'fr' ? 'Quelqu’un vient de te recommander' : 'Someone just vouched for you'
  const p1 =
    lang === 'fr'
      ? `<strong>${escapeHtml(authorName)}</strong> <span style="color:#7a7568;">(${escapeHtml(
          relationship,
        )})</span> a soumis un vouch.`
      : `<strong>${escapeHtml(authorName)}</strong> <span style="color:#7a7568;">(${escapeHtml(
          relationship,
        )})</span> just submitted a vouch.`
  const meta =
    lang === 'fr'
      ? `De <code style="font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#5a554b;">${escapeHtml(
          authorEmail,
        )}</code> · id <code style="font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#5a554b;">${escapeHtml(
          vouchId,
        )}</code>`
      : `From <code style="font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#5a554b;">${escapeHtml(
          authorEmail,
        )}</code> · id <code style="font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#5a554b;">${escapeHtml(
          vouchId,
        )}</code>`
  const { html, text } = renderEmail(marcEmail, origin, {
    lang,
    eyebrow: lang === 'fr' ? 'vouches · modération' : 'vouches · moderation',
    headline,
    paragraphs: [p1, meta],
    quote: clip(bodyPreview, 280),
    cta: { href: url, label: lang === 'fr' ? 'Modérer' : 'Moderate' },
    signoff: 'system',
  })
  return send(apiKey, { from: RESEND_FROM, to: marcEmail, subject, html, text })
}

// =============================================================================
// Generic admin alert (Stripe sub-cancel, invoice-failed, etc.). Returns
// true on successful Resend delivery so the caller can fall back to
// admin_alerts when the network is unhappy.
// =============================================================================

export async function sendAdminAlert(
  apiKey: string,
  marcEmail: string,
  origin: string,
  body: string,
  lang: Lang,
): Promise<boolean> {
  const subject =
    lang === 'fr'
      ? 'Alerte Stripe — quelque chose mérite ton attention'
      : 'Stripe alert — something needs your eyes'
  const headline =
    lang === 'fr' ? 'Une alerte Stripe vient d’arriver' : 'A Stripe alert just landed'
  const p1 = escapeHtml(body)
  const p2 =
    lang === 'fr'
      ? 'Si ce n’est pas livré et marqué non résolu, le digest quotidien va te le rappeler. Tu peux aussi marquer comme résolu via D1.'
      : 'If this isn’t delivered and stays unresolved, the daily digest will re-surface it. You can also mark it resolved via D1.'
  const url = `${origin}/admin`
  const { html, text } = renderEmail(marcEmail, origin, {
    lang,
    eyebrow: lang === 'fr' ? 'alerte · stripe' : 'alert · stripe',
    headline,
    paragraphs: [p1, p2],
    cta: { href: url, label: lang === 'fr' ? 'Ouvrir l’admin' : 'Open admin' },
    signoff: 'system',
  })
  return send(apiKey, { from: RESEND_FROM, to: marcEmail, subject, html, text })
}

// =============================================================================
// Visitor confirmed "Tout à toi" (opted out of Custodian) — admin heads-up
// =============================================================================

export async function sendAllYoursAckNotification(
  apiKey: string,
  marcEmail: string,
  visitorEmail: string,
  sessionId: string,
  origin: string,
  lang: Lang,
): Promise<boolean> {
  const subject =
    lang === 'fr'
      ? 'Visiteur a confirmé « Tout à toi »'
      : "Visitor confirmed 'All yours' (opted out of Custodian)"
  const url = `${origin}/admin/inbox/${sessionId}`
  const headline =
    lang === 'fr' ? 'Tout à toi : confirmation reçue' : 'All yours: confirmation received'
  const p1 =
    lang === 'fr'
      ? `<strong>${escapeHtml(visitorEmail)}</strong> a coché la checklist des compétences et a confirmé Tout à toi.`
      : `<strong>${escapeHtml(visitorEmail)}</strong> ticked the skills checklist and confirmed All yours.`
  const p2 =
    lang === 'fr'
      ? 'Ils prennent les commandes du stack ops à la livraison. Planifie le transfert des accès en conséquence.'
      : 'They take ownership of the ops stack at handoff. Plan the asset transfer accordingly.'
  const { html, text } = renderEmail(marcEmail, origin, {
    lang,
    eyebrow: lang === 'fr' ? 'handoff · tout à toi' : 'handoff · all yours',
    headline,
    paragraphs: [p1, p2],
    cta: { href: url, label: lang === 'fr' ? 'Ouvrir dans l’admin' : 'Open in admin' },
    signoff: 'system',
  })
  return send(apiKey, { from: RESEND_FROM, to: marcEmail, subject, html, text })
}

// =============================================================================
// Refund notice — sent to the visitor when charge.refunded lands. Stripe
// already emails its own receipt; this one tells them in Marc's voice
// (not a billing-platform tone) and links them back to /me so the new
// status is visible immediately. Fires only on FIRST refund transition —
// the webhook handler gates on isFirstRefund so partial-then-full doesn't
// double-send.
// =============================================================================

export async function sendRefundNotice(
  apiKey: string,
  visitorEmail: string,
  refundedCents: number,
  totalCents: number,
  origin: string,
  lang: Lang,
  outboxDb?: D1Database,
): Promise<boolean> {
  const meUrl = `${origin}${lang === 'en' ? '/en' : ''}/me`
  const refundedFormatted = formatCadCents(refundedCents, lang)
  const isFull = refundedCents >= totalCents
  const subject =
    lang === 'fr'
      ? isFull
        ? `Remboursement de ${refundedFormatted} effectué`
        : `Remboursement partiel de ${refundedFormatted}`
      : isFull
        ? `Refund of ${refundedFormatted} issued`
        : `Partial refund of ${refundedFormatted}`
  const headline =
    lang === 'fr'
      ? isFull
        ? 'Ton remboursement est parti'
        : 'Remboursement partiel envoyé'
      : isFull
        ? 'Your refund is on its way'
        : 'Partial refund sent'
  const p1 =
    lang === 'fr'
      ? `J’ai émis un remboursement de <strong>${refundedFormatted}</strong> via Stripe. Selon ta banque, il apparaît sur ta carte entre 5 et 10 jours ouvrables.`
      : `I issued a refund of <strong>${refundedFormatted}</strong> via Stripe. Depending on your bank, it shows up on your card in 5–10 business days.`
  const p2 = isFull
    ? lang === 'fr'
      ? 'Le portail reflète déjà le changement — tu peux voir la nouvelle ligne sous « Mes paiements ».'
      : 'The portal already reflects the change — you can see the updated row under "My payments".'
    : lang === 'fr'
      ? `C’est un remboursement partiel : le solde de ce paiement (${formatCadCents(totalCents - refundedCents, lang)}) reste tel quel. Ta page Mes paiements montre les deux montants côte à côte.`
      : `It's a partial refund — the remaining balance (${formatCadCents(totalCents - refundedCents, lang)}) stays as paid. Your My-payments page shows both side by side.`
  const { html, text } = renderEmail(visitorEmail, origin, {
    lang,
    eyebrow: lang === 'fr' ? 'paiement · remboursement' : 'payment · refund',
    headline,
    paragraphs: [p1, p2],
    cta: { href: meUrl, label: lang === 'fr' ? 'Ouvrir Mes paiements' : 'Open My payments' },
    altLink: meUrl,
  })
  return send(
    apiKey,
    { from: RESEND_FROM, to: visitorEmail, subject, html, text },
    outboxDb ? { db: outboxDb, kind: 'refund-notice' } : undefined,
  )
}

// =============================================================================
// Helpers
// =============================================================================

/** Format CAD cents per OQLF (FR) / standard locale (EN). Mirrors the
 *  client-side formatter in PaymentActions.tsx. Round amounts drop cents
 *  so subjects read "$300" / "300 $" rather than "$300.00" / "300,00 $". */
function formatCadCents(cents: number, lang: Lang): string {
  const isRound = cents % 100 === 0
  return new Intl.NumberFormat(lang === 'fr' ? 'fr-CA' : 'en-CA', {
    style: 'currency',
    currency: 'CAD',
    currencyDisplay: lang === 'fr' ? 'symbol' : 'narrowSymbol',
    minimumFractionDigits: isRound ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}

function statusLabel(status: string, lang: Lang): string {
  const FR: Record<string, string> = {
    draft: 'brouillon',
    triage: 'en triage',
    active: 'active',
    shipped: 'livrée',
    rejected: 'refusée',
  }
  const EN: Record<string, string> = {
    draft: 'draft',
    triage: 'in triage',
    active: 'active',
    shipped: 'shipped',
    rejected: 'rejected',
  }
  return (lang === 'fr' ? FR[status] : EN[status]) ?? status
}

/** Per-status second paragraph for the status-change email. Keeps the tone
 *  warm even when the news is "refusée." */
function statusSubcopy(toStatus: string, lang: Lang): string {
  switch (toStatus) {
    case 'triage':
      return lang === 'fr'
        ? 'Je lis et je te reviens dans les 72 heures — oui, non, ou raconte-moi plus.'
        : "I'll read and reply within 72 hours — yes, no, or tell-me-more."
    case 'active':
      return lang === 'fr'
        ? 'On embarque. Le fil de la session devient le poste de commande.'
        : 'We’re on. The session thread is our command post.'
    case 'shipped':
      return lang === 'fr'
        ? 'Livrée. Va voir — si quelque chose grince, écris-le dans le fil de ta session.'
        : 'Shipped. Go take a look — if anything creaks, drop it in your session thread.'
    case 'rejected':
      return lang === 'fr'
        ? 'Pas un fit ce coup-ci. J’ai laissé un mot dans le fil pour expliquer pourquoi.'
        : 'Not a fit this time. I left a note in the thread explaining why.'
    case 'draft':
      return lang === 'fr'
        ? 'Je l’ai remise en brouillon le temps d’en regarder une autre.'
        : 'I moved it back to draft while I look at another one.'
    default:
      return lang === 'fr'
        ? 'Ouvre la session pour voir la suite.'
        : "Open the session to see what's next."
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Escape a URL for an HTML attribute (href, src). Same primitive as
 * escapeHtml — `&` becomes `&amp;` so spec-strict parsers (and some
 * spam filters) don't choke on raw ampersands in query strings like
 * `?token=X&lang=fr`. The browser/email client URL-decodes the entity
 * when navigating, so the destination is unchanged.
 */
function escapeAttr(url: string): string {
  return url.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

/**
 * Trim a user-supplied preview to a length cap, then escape. Doing the
 * slice BEFORE escapeHtml guarantees we never cut inside an HTML entity
 * (e.g., chopping `&am` out of `&amp;` would produce broken HTML).
 */
function clip(s: string, max: number): string {
  return escapeHtml(s.length > max ? s.slice(0, max - 1) + '…' : s)
}

/** Drop tags from a fragment for the plain-text rendering. Not a security
 *  primitive — only used on copy we built ourselves. */
function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}
